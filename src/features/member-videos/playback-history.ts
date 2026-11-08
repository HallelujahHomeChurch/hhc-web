type Entry = {href: string; length: number; tag: string | undefined};
type Pair = {library: string; watch: string; listTag: string; watchTag: string; at: 'list' | 'watch'; expected?: 'list' | 'watch'};

// Only evidence collected in this document can authorize back/forward.
export function createPlaybackHistory(read: () => Entry, mark: () => string) {
  let pending: {library: string; watch: string; length: number; tag: string} | undefined;
  let pair: Pair | undefined;
  let fallback: {library: string; watch: string; length: number; at: 'list' | 'watch'; tag: string; expected?: 'list' | 'watch'} | undefined;
  const reset = () => { pending = undefined; pair = undefined; fallback = undefined; };
  return {
    reset,
    remember(library: string, watch: string) {
      reset();
      if (read().href === library) pending = {library, watch, length: read().length, tag: mark()};
    },
    arrived() {
      const entry = read();
      if (pending) {
        if (entry.href === pending.library && entry.tag === pending.tag) return;
        if (entry.href === pending.watch && entry.tag !== pending.tag && entry.length <= pending.length + 1) {
          pair = {library: pending.library, watch: pending.watch, listTag: pending.tag, watchTag: mark(), at: 'watch'};
          pending = undefined;
          return;
        }
        reset();
      } else if (pair) {
        const at = pair.expected ?? pair.at;
        const href = at === 'list' ? pair.library : pair.watch;
        const tag = at === 'list' ? pair.listTag : pair.watchTag;
        if (entry.href === href && entry.tag === tag) { pair.at = at; pair.expected = undefined; }
        else reset();
      } else if (fallback) {
        const at = fallback.expected ?? fallback.at;
        if (entry.href !== (at === 'list' ? fallback.library : fallback.watch) || entry.length !== fallback.length) reset();
        else if (fallback.expected) { fallback.at = at; fallback.tag = mark(); fallback.expected = undefined; }
        else if (entry.tag !== fallback.tag) reset();
      }
    },
    minimize(library: string, watch: string): 'back' | 'replace' {
      const entry = read();
      if (pair?.at === 'watch' && !pair.expected && entry.href === pair.watch && entry.tag === pair.watchTag && watch === pair.watch) {
        pair.expected = 'list'; return 'back';
      }
      reset();
      fallback = {library, watch, length: entry.length, at: 'watch', tag: mark(), expected: 'list'};
      return 'replace';
    },
    expand(watch: string): 'forward' | 'replace' | 'push' {
      const entry = read();
      if (pair?.at === 'list' && !pair.expected && watch === pair.watch && entry.href === pair.library && entry.tag === pair.listTag) {
        pair.expected = 'watch'; return 'forward';
      }
      if (fallback?.at === 'list' && !fallback.expected && watch === fallback.watch && entry.href === fallback.library && entry.tag === fallback.tag) {
        fallback.expected = 'watch'; return 'replace';
      }
      reset(); return 'push';
    },
  };
}
