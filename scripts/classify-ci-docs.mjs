import {execFileSync} from 'node:child_process';

// Only inert docs/ Markdown may skip application verification; uncertainty runs it all.
function docsOnly(base, head) {
  if (!/^[a-f0-9]{40}$/.test(base ?? '') || !/^[a-f0-9]{40}$/.test(head ?? '')) return false;
  const git = (...args) => execFileSync('git', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024});
  try {
    git('merge-base', '--is-ancestor', base, head);
    const records = git('diff', '--raw', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', base, head, '--').split('\0');
    if (records.pop() !== '' || records.length === 0 || records.length % 2 !== 0) return false;
    for (let index = 0; index < records.length; index += 2) {
      const change = /^:(\d{6}) (\d{6}) [a-f0-9]+ [a-f0-9]+ ([AM])$/.exec(records[index]);
      if (!change || change[2] !== '100644' || change[1] !== (change[3] === 'A' ? '000000' : '100644')) return false;
      if (!/^docs\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9][A-Za-z0-9_.-]*\.md$/.test(records[index + 1])) return false;
    }
    return true;
  } catch {
    return false;
  }
}

console.log(`docs_only=${docsOnly(process.argv[2], process.argv[3])}`);
