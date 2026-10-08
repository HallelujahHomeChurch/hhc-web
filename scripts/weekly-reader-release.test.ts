import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {describe, expect, it} from 'vitest';

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');

function releaseScript(name: string) {
  const step = workflow.split(`      - name: ${name}\n`)[1]?.split('\n      - ')[0];
  const script = step?.split('        run: |\n')[1];
  if (!script) throw new Error(`Missing release step: ${name}`);
  return script.replace(/^          /gm, '').replace(/\$\{\{[^}]*\}\}/g, '');
}

function readerFlag(configured?: string) {
  const expression = workflow.match(/^      WEEKLY_READER_ENABLED: (.+)$/m)?.[1];
  if (!expression) return '';
  const binding = expression.match(/^\$\{\{ vars\.WEEKLY_READER_ENABLED \|\| '([^']+)' \}\}$/);
  if (!binding) throw new Error('Unsupported reader release variable binding');
  return configured || binding[1];
}

function releaseEnvironment(flag: string) {
  return {...process.env, GITHUB_REF: 'refs/heads/main', RELEASE_CONFIRMATION: 'deploy-hhc-web-production',
    AZURE_CLIENT_ID: 'test-client', AZURE_TENANT_ID: 'test-tenant', AZURE_SUBSCRIPTION_ID: 'test-subscription',
    MEMBER_VIDEO_NAV_ENABLED: 'false', WEEKLY_READER_ENABLED: flag};
}

describe('weekly reader release gate', () => {
  it.each([undefined, 'false', 'true'])('passes the configured %s gate into the image build', configured => {
    const root = mkdtempSync(path.join(tmpdir(), 'hhc-reader-release-'));
    try {
      const flag = readerFlag(configured);
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', `
docker() { if [[ "$1" == build ]]; then printf '%s\\n' "$@"; fi; }
az() { return 0; }
${releaseScript('Build and push image')}`], {encoding: 'utf8', env: {...releaseEnvironment(flag),
        RUNNER_TEMP: root, GITHUB_TOKEN: 'test-only-not-a-credential', SENTRY_AUTH_TOKEN: '',
        ACR_NAME: 'test-acr', ACR_LOGIN_SERVER: 'registry.test', IMAGE_REPOSITORY: 'test/web', IMAGE_TAG: 'test'}});
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.split('\n')).toContain(`NEXT_PUBLIC_WEEKLY_READER_ENABLED=${configured ?? 'false'}`);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it.each(['false', 'true'])('accepts the explicit %s release gate', flag => {
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', releaseScript('Validate release configuration')],
      {encoding: 'utf8', env: releaseEnvironment(flag)});
    expect(result.status, result.stderr).toBe(0);
  });

  it.each(['TRUE', 'yes', ''])('rejects invalid reader gate %s before any deployment command', flag => {
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', releaseScript('Validate release configuration')],
      {encoding: 'utf8', env: releaseEnvironment(flag)});
    expect(result.status).not.toBe(0);
  });
});
