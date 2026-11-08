import type {MemberRecordingCard} from '@hallelujahhomechurch/hhc-web-client';
export type CardProgress = NonNullable<MemberRecordingCard['playbackProgress']> & {recordingId:string};

export function createCardProgressStore() {
  let writer: object | null = null, snapshot: CardProgress | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CardProgress | null) => {
    if (snapshot === next) return;
    snapshot = next; listeners.forEach(notify=>notify());
  };
  return {
    subscribe(notify: () => void) {listeners.add(notify); return () => {listeners.delete(notify);};},
    get(id: string, version: string | undefined) {return snapshot?.recordingId === id && snapshot.mediaVersion === version ? snapshot : null;},
    bind() {
      const token = {}; writer = token; publish(null);
      return {
        publish(next: CardProgress | null) {if (writer === token) publish(next);},
        dispose() {if (writer === token) {writer = null; publish(null);}},
      };
    },
  };
}
