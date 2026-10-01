import type {ReaderMessages} from './ReaderToolbar';

export function ResumeReadingPrompt({messages: m, onContinue, onStartOver}: {messages: ReaderMessages; onContinue: () => void; onStartOver: () => void}) {
  return <div className="reader-toolbar" role="group" aria-label={m.resumeReading}>
    <span>{m.resumeReading}</span><button type="button" onClick={onContinue}>{m.continueReading}</button><button type="button" onClick={onStartOver}>{m.startOver}</button>
  </div>;
}
