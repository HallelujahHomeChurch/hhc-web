'use client';

import {createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode} from 'react';
import {useAccountAuth, useVideoAccess} from './AccountControl';

// A locale layout can remount within the same browser document.
const documentModes = new WeakMap<Document, 'analytics' | 'private'>();

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function readMode() {
  return documentModes.get(document);
}

function setMode(mode: 'analytics' | 'private') {
  if (readMode() === mode) return;
  documentModes.set(document, mode);
  for (const listener of listeners) listener();
}

function markAnalyticsStarted() {
  setMode('analytics');
}

const MediaDocumentContext = createContext({
  analyticsAllowed: true,
  privateMediaReady: true,
  markAnalyticsStarted: () => {},
});

export function useMediaDocument() {
  return useContext(MediaDocumentContext);
}

export function MediaDocumentProvider({children}: {children: ReactNode}) {
  const auth = useAccountAuth();
  const access = useVideoAccess();
  const eligible = auth.status === 'authenticated' && access === 'available';
  const mode = useSyncExternalStore(subscribe, readMode, () => undefined);
  const navigating = useRef(false);

  useLayoutEffect(() => {
    if (!eligible || navigating.current) return;
    if (readMode() === 'analytics') {
      navigating.current = true;
      window.location.replace(window.location.href);
      return;
    }
    setMode('private');
  }, [eligible, mode]);

  const analyticsAllowed = mode !== 'private' && (
    auth.status === 'anonymous' || auth.status === 'authenticated' && access === 'denied'
  );
  return (
    <MediaDocumentContext.Provider value={{
      analyticsAllowed,
      privateMediaReady: eligible && mode === 'private',
      markAnalyticsStarted,
    }}>
      {children}
    </MediaDocumentContext.Provider>
  );
}
