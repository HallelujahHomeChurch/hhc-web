import type {BulletinRenderableDocument} from '@hallelujahhomechurch/ui';
import type {ReaderMessages} from './ReaderToolbar';
export function SectionNavigator({document, onSection, messages: m}: {document: BulletinRenderableDocument; onSection: (id: string) => void; messages: ReaderMessages}) {
  return <details className="reader-sections"><summary>{m.sections}</summary><nav aria-label={m.sections}>{document.components.map(component => {
    const title = component.type === 'bodySection' ? component.bodySection.title.sentences.flatMap(sentence => sentence.spans.map(span => span.text)).join('') : m[component.type];
    return <button key={component.id} type="button" onClick={() => onSection(component.id)}>{title}</button>;
  })}</nav></details>;
}
