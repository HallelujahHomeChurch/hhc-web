import {useEffect, useState} from 'react';
import type {Theme} from '@hallelujahhomechurch/preferences';

const storageKey = 'hhc-reader-theme';
/** Seed once from the website; subsequent reader choices stay local to the reader. */
export function useReaderTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    let initial: Theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') initial = saved;
      localStorage.setItem(storageKey, initial);
    } catch { /* Storage is optional; in-memory switching still works. */ }
    // Hydrate browser-only storage after the server-compatible initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
  }, []);
  return {theme, toggle: () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {localStorage.setItem(storageKey, next);} catch { /* Keep the current session usable. */ }
    setTheme(next);
  }};
}
