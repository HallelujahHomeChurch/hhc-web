import type {BulletinRenderableDocument} from '@hallelujahhomechurch/ui';
import type {components} from '@hallelujahhomechurch/hhc-web-client';

type Block = components['schemas']['OnlineBulletinBlock'];
export type SectionAnchor = {kind: 'sentence' | 'component'; id: string};
const text = (block: Block) => block.sentences.flatMap(sentence => sentence.spans.map(span => span.text)).join('').trim();
const nameKey = (name: string) => name.trim().replace(/\s+/gu, ' ');

export function bulletinSectionIndex(document: BulletinRenderableDocument) {
  const speakers = new Map<string, {name: string; anchor?: SectionAnchor}>();
  const sections: {id: string; title: string; names: string[]; anchor?: SectionAnchor}[] = [];
  for (const component of document.components) {
    if (component.type !== 'bodySection') continue;
    const body = component.bodySection;
    const sentence = body.title.sentences.find(sentence => sentence.spans.some(span => span.text.trim()));
    const located = sentence && document.layoutManifest.pages.some(page => page.slots.some(slot => slot.fragments.some(fragment => fragment.sentenceId === sentence.id)));
    const anchor: SectionAnchor | undefined = located ? {kind: 'sentence', id: sentence.id} : undefined;
    const inline = (body.contributors ?? []).filter(person => person.role === 'speaker').map(person => text(person.name)).filter(Boolean);
    const header = (body.header?.contributors ?? []).filter(person => person.role === 'speaker');
    // Member payloads intentionally omit PDF coordinates. The producer verifies
    // the original mapping and supplies only the reliable semantic start.
    const headerStartsHere = sections.length === 0 && !inline.length && 'headerSpeakerStartComponentId' in document && document.headerSpeakerStartComponentId === component.id;
    const names = [...new Map((inline.length ? inline : headerStartsHere ? header.map(person => text(person.name)).filter(Boolean) : []).map(name => [nameKey(name), name])).values()];
    for (const name of header.map(person => text(person.name)).filter(Boolean)) {
      const key = nameKey(name);
      if (!speakers.has(key)) speakers.set(key, {name, anchor: headerStartsHere ? anchor : undefined});
    }
    for (const name of names) {
      const key = nameKey(name), previous = speakers.get(key);
      if (!previous) speakers.set(key, {name, anchor});
      else if (!previous.anchor && anchor) previous.anchor = anchor;
    }
    sections.push({id: component.id, title: text(body.title), names, anchor});
  }
  return {sections, speakers: [...speakers.values()]};
}
