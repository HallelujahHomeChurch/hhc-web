import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

const classifier = path.resolve('scripts/classify-ci-docs.mjs');

test('classifies actual Git changes conservatively', (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'hhc-ci-docs-'));
  t.after(() => rmSync(cwd, {recursive: true, force: true}));
  const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const write = (file, content = 'content\n') => {
    mkdirSync(path.dirname(path.join(cwd, file)), {recursive: true});
    writeFileSync(path.join(cwd, file), content);
  };
  const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  const classify = (base, head) => execFileSync(process.execPath, [classifier, base, head], {cwd, encoding: 'utf8'}).trim();
  git('init', '-q');
  git('config', 'user.email', 'ci@example.invalid');
  git('config', 'user.name', 'CI Test');
  git('config', 'core.fileMode', 'true');
  write('docs/reviews/existing.md');
  write('src/code.ts');
  const base = commit();
  const check = (name, change, expected = false) => {
    git('reset', '--hard', base);
    git('clean', '-fdq');
    change();
    const head = commit();
    assert.equal(classify(base, head), `docs_only=${expected}`, name);
  };
  check('Markdown addition', () => write('docs/plans/new-plan.md'), true);
  check('Markdown modification', () => write('docs/reviews/existing.md', 'changed\n'), true);
  check('mixed code and docs', () => { write('docs/new.md'); write('src/code.ts', 'changed\n'); });
  for (const file of ['README.md', 'package.json', '.github/workflows/ci.yml', 'docs/config.json', 'public/SOURCE.md', 'docs/.hidden.md', 'docs/a\nb.md', 'docs/../outside.md']) {
    check(file, () => write(file));
  }
  check('code renamed into docs', () => renameSync(path.join(cwd, 'src/code.ts'), path.join(cwd, 'docs/code.md')));
  check('docs rename', () => renameSync(path.join(cwd, 'docs/reviews/existing.md'), path.join(cwd, 'docs/renamed.md')));
  check('docs deletion', () => rmSync(path.join(cwd, 'docs/reviews/existing.md')));
  check('executable Markdown', () => chmodSync(path.join(cwd, 'docs/reviews/existing.md'), 0o755));
  check('new symlink', () => symlinkSync('../src/code.ts', path.join(cwd, 'docs/link.md')));
  check('regular file becomes symlink', () => { rmSync(path.join(cwd, 'docs/reviews/existing.md')); symlinkSync('../../src/code.ts', path.join(cwd, 'docs/reviews/existing.md')); });
  assert.equal(classify(base, base), 'docs_only=false', 'empty diff');
  assert.equal(classify('', base), 'docs_only=false', 'missing base');
  assert.equal(classify(base, ''), 'docs_only=false', 'missing head');
  assert.equal(classify('0'.repeat(40), base), 'docs_only=false', 'unknown commit');
  assert.equal(classify('--help', base), 'docs_only=false', 'invalid ref');
  const descendant = git('rev-parse', 'HEAD');
  assert.equal(classify(descendant, base), 'docs_only=false', 'base not ancestor');
});
