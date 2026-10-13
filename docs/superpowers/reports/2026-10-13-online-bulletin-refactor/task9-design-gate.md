# Task 9 pre-code ownership gate

Candidate Web after Task4 and Task8; `WeeklyReader.tsx` remains byte-identical to baseline b4cf650. Proposal below is a reviewed design candidate, not an implemented public interface.

Recommendation: retain the existing position code. The concrete hook below would relocate the same mutually dependent closure and require multiple behavior callbacks and shared refs. It does not remove duplicate policy or introduce a smaller independent owner. Do not add a hook solely to shorten WeeklyReader.

## Exact candidate interface

```ts
import type {RefObject} from 'react';
import type {BulletinReaderState, OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {verifyReaderAccess, ReaderSelector} from '@/features/weekly-reader/api';
import type {ReaderSyncStatus} from '@/features/weekly-reader/sync';
import type {useReaderProgress} from '@/features/weekly-reader/progress';
import type {ReadingDirection} from '@/components/weekly-reader/PaperViewport';
import type {bulletinChapters} from '@hallelujahhomechurch/ui';

type Anchor = {kind: 'component' | 'sentence'; id: string};
type UseReaderPositionInput = {
  value: OnlineBulletinAccess;
  document: ReturnType<typeof verifyReaderAccess>;
  selector: ReaderSelector;
  mobile: boolean;
  suspended: boolean;
  fontsReady: boolean;
  direction: ReadingDirection;
  notesOpen: boolean;
  cloudProgress: BulletinReaderState['progress'] | undefined;
  cloudStatePresent: boolean;
  cloudStatus: ReaderSyncStatus;
  viewportRef: RefObject<HTMLDivElement | null>;
  paperRef: RefObject<HTMLDivElement | null>;
  chapterHeading: RefObject<HTMLDivElement | null>;
  chapters: ReturnType<typeof bulletinChapters>;
  productionSentenceIds: Set<string>;
  readingInset: () => number;
  allowAction: () => boolean;
  closeNotes: () => boolean;
  clearSelection: () => void;
  revealChrome: () => void;
  recordProgress: ReturnType<typeof useReaderProgress>['record'];
  flushProgress: ReturnType<typeof useReaderProgress>['flush'];
};
type ReaderPosition = {
  storageKey: string;
  page: number;
  chapter: string;
  resumeResolved: boolean;
  onPage: (index: number, record?: boolean) => boolean;
  onAnchor: (anchor: Anchor, record?: boolean, preferredPage?: number) => void;
  onChapter: (index: number) => void;
  recordVisiblePaper: () => void;
};
```

`document` is the already verified content returned by `verifyReaderAccess`, not a second validation path. `value.document` supplies the existing MemberOnlineDocument for source-page mapping and the original account/document/revision storage key. No new domain model is needed.

## State/ref/effect ownership if extraction were attempted

| Existing state/ref/effect | Proposed owner | Coupling / preserved rule |
| --- | --- | --- |
| storageKey, restoredPage/restoredAnchor lazy reads | position | account + document + revision; optional storage errors unchanged |
| page, chapter, resumeResolved, paperJump | position | manual navigation resolves restoration before late cloud response |
| pendingAnchor, sourceJump, chapterStart, previousMobile | position | focus flag false for restoration; manual navigation focus preserved |
| onPage / onAnchor / onChapter | position | caller still supplies clearSelection, revealChrome, closeNotes; order cannot change |
| scrollToPage effect event + rAF | position | runs only fontsReady/resumeResolved; chapter/rotation geometry needs mounted DOM |
| desktop visible-page listener + 150ms timer | position | original notes/suspended/allowAction gates; hide flushes pending observation |
| mobile visible sentence listener + 250ms timer | position | original mobile/font/notes gate, Unicode source mapping, hide flush |
| sourceJump rAF + mobile enterReflow | position | source-page jump excludes production sentences; restoration never steals focus |
| restorePosition effect event | position | local position precedence; wait cloud only while syncing without local state |
| paperRef/viewportRef/chapterHeading | caller creates; position reads | same refs also consumed by rendering, selection, typography, gesture and chrome |
| selection + clear/clearIf | existing caller / useReaderSelection | hook callback only; preserve conflict and action-response ownership |
| notes / editor dirty state / closeNotes | existing caller | prompts, busy lock, focus return and dirty draft clearing stay caller-owned |
| fontsReady/fontsFailed/fontAttempt | existing caller | actual FontFaceSet promise and 20s retry deadline retained |
| viewport/mobile/nativeZoomed and observers | existing caller | geometry, keyboard visual viewport and gesture dimensions feed UI and position |
| captureAnchor / preservePaperPosition | existing caller / usePaperGestures | needs position resumeResolved; resize observer invokes gesture capture before setViewport |
| readingInset / revealChrome | existing caller / useScrollChrome | depends on selection, notes, panel and mobile geometry; navigation feeds it back |
| zoom/direction/view preferences | existing caller | same storageKey from position; gesture implementation and preference writes stay outside |
| progress pending mutation/timer | useReaderProgress | original mutation IDs, commit callback and 500ms flush lifetime unchanged |
| search debounce/binding | useReaderSearchNavigation | account/document/revision and onAnchor callback unchanged |
| exit/return recovery | existing caller / useReaderExitGuard | calls recordVisiblePaper then flush; do not move dirty editor or recovery state |

The returned `resumeResolved` feeds gesture capture; gestures need viewport refs and layout; position itself needs the same refs, mobile/fonts and notes. Navigation mutates chrome/selection/notes via callbacks while those owners gate position effects. Keeping those relationships explicit inside the existing component avoids another coordination interface and effect-order migration risk.

## Existing regression mapping

Read the actual tests, not merely their names: WeeklyReader tests cover late cloud progress after manual jump (~912), font loading/deadline (~1029), account switching (~1075), bound page/anchor revision (~1145), dirty note navigation (~720), visual viewport zoom (~775), responsive note sidebar (~811), hidden-tab desktop/mobile progress (~550/~861). `progress`, `useReaderSearchNavigation`, `usePaperGestures`, and `useReaderExitGuard` retain their own tests. Physical rotation/keyboard/device behavior remains a separate unverified acceptance gate.

No new implementation or mirror tests should be added if the advisor accepts no extraction. Run the existing focused integration set on the final candidate; do not claim old baseline tests as candidate proof. Task8 only changes sibling recovery tools, not WeeklyReader state ownership.

## Decision

Independent review approved retaining existing code; see task9-review.md. The candidate input value type was corrected to OnlineBulletinAccess during review; remaining Critical/Important=0. No position hook has been written. If retained, no state/ref/effect is moved and the original restoration timing is preserved by an empty production diff, not by an assertion that a newly extracted closure is equivalent.
