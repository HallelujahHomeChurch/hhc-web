import type {BulletinRenderableDocument} from '@hallelujahhomechurch/ui';
import {bulletinSectionIndex, type SectionAnchor} from '@/features/weekly-reader/section-index';
import type {ReaderMessages} from './ReaderToolbar';
export function SectionNavigator({document, onSection, messages: m}: {document: BulletinRenderableDocument; onSection: (anchor: SectionAnchor) => void; messages: ReaderMessages}) {
  const {sections, speakers} = bulletinSectionIndex(document);
  return <>
    <details className="reader-sections"><summary>{m.sections}</summary><nav aria-label={m.sections}>{sections.map(section => {
      const label = `${section.title}${section.names.length ? ` ～ ${section.names.join('、')}` : ''}`;
      return section.anchor ? <button key={section.id} type="button" onClick={() => onSection(section.anchor!)}>{label}</button> : <p key={section.id}>{label} · {m.speakerStartUnknown}</p>;
    })}</nav></details>
    <details className="reader-sections"><summary>{m.speakers}</summary><nav aria-label={m.speakers}>{speakers.length ? speakers.map(speaker => speaker.anchor ? <button key={speaker.name} type="button" onClick={() => onSection(speaker.anchor!)}>{speaker.name}</button> : <p key={speaker.name}>{speaker.name} · {m.speakerStartUnknown}</p>) : <p>{m.noSpeakers}</p>}</nav></details>
  </>;
}
