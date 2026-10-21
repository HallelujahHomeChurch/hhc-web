import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

function job(name) {
  const match = workflow.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [\\w-]+:\\n|(?![\\s\\S]))`, 'm'));
  assert.ok(match, `missing ${name} job`);
  return match[1];
}

function step(body, name) {
  const block = body.split(/^      - /m).find((part) => part.startsWith(`name: ${name}\n`));
  assert.ok(block, `missing ${name} step`);
  return block;
}

test('prepare runs alongside full verify; deploy requires both successful jobs', () => {
  const prepare = job('prepare_image');
  const deploy = job('deploy');
  for (const producer of [prepare, job('verify')]) {
    assert.match(producer, /^    needs: agent_docs$/m);
    assert.match(producer, /needs\.agent_docs\.result == 'success'/);
    assert.match(producer, /needs\.agent_docs\.outputs\.docs_only != 'true'/);
  }
  assert.match(deploy, /^    needs: \[verify, prepare_image\]$/m);
  // Default needs success gating must not be bypassed when verify fails or is cancelled.
  assert.doesNotMatch(deploy, /^    if:/m);
  assert.match(prepare, /github\.ref == 'refs\/heads\/main'/);
  assert.match(prepare, /github\.repository == 'HallelujahHomeChurch\/hhc-web'/);
  assert.match(prepare, /^    environment: production$/m);
  assert.match(prepare, /id-token: write/);
  for (const command of ['test:run', 'lint', 'build', 'perf:static']) {
    assert.ok(job('verify').includes(`corepack pnpm ${command}`));
  }
  assert.match(job('verify'), /fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1/);
});

test('main release builds one production image and scans that same immutable image', () => {
  assert.equal((workflow.match(/--target runtime -t/g) || []).length, 1);
  assert.equal((workflow.match(/--target source_maps -t/g) || []).length, 1);
  assert.doesNotMatch(job('verify'), /docker build|hhc-web:verify/);
  assert.doesNotMatch(job('deploy'), /docker build|docker push/);
  const prepare = job('prepare_image');
  assert.match(prepare, /\[\[ "\$digest" =~ \^sha256:\[0-9a-f\]\{64\}\$ \]\]/);
  assert.match(prepare, /image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "\$IMAGE_REF"/);
  assert.ok(prepare.indexOf('name: Scan immutable image') < prepare.indexOf('name: Export verified immutable image'));
  assert.match(step(prepare, 'Export verified immutable image'), /echo "commit=\$GITHUB_SHA" >> "\$GITHUB_OUTPUT"/);
  assert.match(step(prepare, 'Export verified immutable image'), /echo "image=\$IMAGE_REF" >> "\$GITHUB_OUTPUT"/);
});

test('production flags and npm/Sentry secret mounts survive without secret artifacts', () => {
  const prepare = job('prepare_image');
  for (const flag of ['MEMBER_VIDEO_NAV_ENABLED', 'WEEKLY_READER_ENABLED']) {
    const declaration = new RegExp(`^      ${flag}: (.+)$`, 'm');
    assert.equal(prepare.match(declaration)?.[1], job('deploy').match(declaration)?.[1], `missing/mismatched ${flag}`);
  }
  const build = step(prepare, 'Build and push image');
  for (const flag of ['NEXT_PUBLIC_SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_RELEASE', 'NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED', 'SENTRY_ORG', 'SENTRY_PROJECT']) {
    assert.ok(build.includes(`--build-arg ${flag}=`), `missing production ${flag}`);
  }
  assert.match(build, /--build-arg NEXT_PUBLIC_SENTRY_RELEASE="\$GITHUB_SHA"/);
  assert.match(build, /--build-arg NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED="\$MEMBER_VIDEO_NAV_ENABLED"/);
  assert.match(build, /--secret id=npmrc,src="\$RUNNER_TEMP\/npmrc"/);
  assert.match(build, /--secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN/);
  assert.match(build, /trap .*npmrc.* EXIT/);
  assert.doesNotMatch(prepare, /upload-artifact|--build-arg (?:GITHUB_TOKEN|SENTRY_AUTH_TOKEN)=/);
  const outputs = prepare.split('    outputs:\n')[1].split('    permissions:')[0];
  assert.deepEqual(outputs.trim().split('\n').map((line) => line.trim().split(':')[0]), ['commit', 'image', 'sourcemaps']);
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /--mount=type=secret,id=npmrc/);
  assert.match(dockerfile, /--mount=type=secret,id=sentry_auth_token/);
});

test('deploy executes the actual prepared-artifact guard before any Azure action', () => {
  const deploy = job('deploy');
  const guard = step(deploy, 'Validate prepared image');
  assert.ok(deploy.indexOf('name: Validate prepared image') < deploy.indexOf('name: Sign in to Azure'));
  assert.match(guard, /needs\.prepare_image\.outputs\.image/);
  assert.match(guard, /needs\.prepare_image\.outputs\.commit/);
  const script = guard.split('        run: |\n')[1].replace(/^          /gm, '');
  const folder = mkdtempSync(join(tmpdir(), 'hhc-image-guard-'));
  try {
    const envFile = join(folder, 'env');
    const env = { PATH: process.env.PATH, GITHUB_REF: 'refs/heads/main', GITHUB_SHA: 'a'.repeat(40),
      BUILD_COMMIT: 'a'.repeat(40), ACR_LOGIN_SERVER: 'alive.azurecr.io', IMAGE_REPOSITORY: 'alive/hhc-web',
      PREPARED_IMAGE: `alive.azurecr.io/alive/hhc-web@sha256:${'b'.repeat(64)}`, GITHUB_ENV: envFile };
    for (const change of [{ BUILD_COMMIT: 'c'.repeat(40) }, { GITHUB_REF: 'refs/heads/feature' },
      { PREPARED_IMAGE: 'alive.azurecr.io/alive/hhc-web:main-tag' },
      { PREPARED_IMAGE: `alive.azurecr.io/alive/other@sha256:${'b'.repeat(64)}` },
      { PREPARED_IMAGE: `alive.azurecr.io/alive/hhc-web@sha256:${'b'.repeat(63)}` },
      { PREPARED_IMAGE: `${env.PREPARED_IMAGE}\nINJECTED=value` }]) {
      const result = spawnSync('/bin/bash', ['-e', '-c', script], { env: { ...env, ...change }, encoding: 'utf8' });
      assert.notEqual(result.status, 0, JSON.stringify(change));
    }
    const result = spawnSync('/bin/bash', ['-e', '-c', script], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(envFile, 'utf8'), `IMAGE_REF=${env.PREPARED_IMAGE}\n`);
  } finally {
    rmSync(folder, { recursive: true });
  }
});

test('runtime changes stay after verify/image preparation with existing preview smoke and rollback', () => {
  assert.doesNotMatch(job('prepare_image'), /az deployment group|az containerapp/);
  const deploy = job('deploy');
  for (const name of ['Capture current state', 'Preview infrastructure change', 'Deploy', 'Wait for revision', 'Verify through gateway Dapr', 'Roll back failed update']) {
    step(deploy, name);
  }
  assert.match(deploy, /--parameters image="\$IMAGE_REF" provisionPermissions="\$PROVISION_PERMISSIONS"/);
  assert.match(deploy, /--image "\$PREVIOUS_IMAGE_REF"/);
});


test('Sentry provider failure is visible in an independent retryable job, not a deployment dependency', () => {
  const upload=job('upload_sourcemaps');
  assert.match(upload, /^    needs: prepare_image$/m);
  assert.doesNotMatch(job('deploy'), /upload_sourcemaps/);
  assert.match(upload, /needs\.prepare_image\.outputs\.sourcemaps/);
  assert.match(upload, /sentry-cli sourcemaps upload/);
  assert.doesNotMatch(upload, /continue-on-error|docker build|docker push|az deployment|az containerapp/);
  const dockerfile=readFileSync(new URL('../Dockerfile',import.meta.url),'utf8');
  assert.doesNotMatch(dockerfile,/sentry-cli sourcemaps upload/);
  assert.match(dockerfile,/FROM scratch AS source_maps/);
  assert.match(dockerfile,/COPY --from=stripped_build --chown=nonroot:nonroot/);
  assert.match(upload,/org\.opencontainers\.image\.revision/);
});


test('source-map retry refuses another commit, repository or mutable tag', () => {
  const guard=step(job('upload_sourcemaps'),'Validate source-map artifact');
  const script=guard.split('        run: |\n')[1].replace(/^          /gm,'');
  const env={PATH:process.env.PATH,GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),BUILD_COMMIT:'a'.repeat(40),SOURCE_MAPS_IMAGE:`alive.azurecr.io/alive/hhc-web@sha256:${'b'.repeat(64)}`};
  for(const change of [{BUILD_COMMIT:'c'.repeat(40)},{GITHUB_REF:'refs/heads/feature'},{SOURCE_MAPS_IMAGE:'alive.azurecr.io/alive/hhc-web:mutable'},{SOURCE_MAPS_IMAGE:`alive.azurecr.io/alive/other@sha256:${'b'.repeat(64)}`},{SOURCE_MAPS_IMAGE:env.SOURCE_MAPS_IMAGE+'\nINJECTED=value'}]){
    assert.notEqual(spawnSync('/bin/bash',['-e','-c',script],{env:{...env,...change}}).status,0,JSON.stringify(change));
  }
  assert.equal(spawnSync('/bin/bash',['-e','-c',script],{env}).status,0);
});

test('a provider 502 fails only the independent upload command and retains deployment gates', () => {
  const upload=job('upload_sourcemaps'),body=step(upload,'Upload exact private source maps');
  const script=body.split('        run: |\n')[1].replace(/^          /gm,'');
  const folder=mkdtempSync(join(tmpdir(),'hhc-sentry-502-')),bin=join(folder,'bin');mkdirSync(bin);
  try{
    writeFileSync(join(bin,'az'),'#!/bin/sh\nexit 0\n',{mode:0o700});
    writeFileSync(join(bin,'docker'),'#!/bin/sh\ncase "$1" in image) printf "%s\\n" "$GITHUB_SHA" ;; create) echo fixture-container ;; esac\n',{mode:0o700});
    writeFileSync(join(bin,'corepack'),'#!/bin/sh\necho "Sentry HTTP 502 fixture" >&2\nexit 1\n',{mode:0o700});
    const result=spawnSync('/bin/bash',['-e','-c',script],{env:{PATH:bin+':'+process.env.PATH,RUNNER_TEMP:folder,GITHUB_SHA:'a'.repeat(40),SOURCE_MAPS_IMAGE:`alive.azurecr.io/alive/hhc-web@sha256:${'b'.repeat(64)}`,SENTRY_ORG:'fixture',SENTRY_PROJECT:'fixture'},encoding:'utf8'});
    assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/Sentry HTTP 502 fixture/);
    assert.doesNotMatch(upload,/continue-on-error/);
    assert.match(job('deploy'),/^    needs: \[verify, prepare_image\]$/m);
  }finally{rmSync(folder,{recursive:true});}
});
