import {expect, it} from 'vitest';
import type {components} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {bulletinSectionIndex} from './section-index';

type Block = components['schemas']['OnlineBulletinBlock'];
function fixture() {
  const document = {...readerFixture('zh-Hant', 'v10').document.content, contentLocale:'zh-Hant' as const, sourcePageCount:4};
  const block = (id: string, text: string): Block => ({id, style: {fontSize: 14, lineHeight: 18, indent:0, firstLineIndent:0, spaceBefore:0, spaceAfter:0}, sentences: [{id: `${id}-sentence`, source: {page: 2, box: {x: .1, y: .4, width: .3, height: .02}}, spans: [{text, fontRole: 'body'}]}]});
  const section = (id: string, name?: string): components['schemas']['OnlineBulletinComponent'] => ({id, type: 'bodySection', bodySection: {kind: 'unknown', title: block(id, `Title ${id}`), contributors: name ? [{role: 'speaker', name: block(`${id}-name`, name)}] : [], blocks: [block(`${id}-body`, 'Body')]}});
  document.components.push(section('first'), section('second', 'Beta'), section('third', 'Alpha'), section('fourth', ' Beta '));
  for (const id of ['first', 'second', 'third', 'fourth']) document.layoutManifest.pages[1].slots.push({id: `${id}-slot`, componentId: id, blockId: id, box: {x: .1, y: .4, width: .7, height: .1}, fragments: [{sentenceId: `${id}-sentence`, start: 0, end: 4}]});
  const first = document.components.find(component => component.id === 'first')!;
  if (first.type !== 'bodySection') throw new Error('fixture');
  first.bodySection.header = {lectureDate: block('date', '2026-10-18'), contributors: [{role: 'speaker', name: block('header-name', 'Alpha')}, {role: 'editor', name: block('editor', 'Editor')}]};
  Object.assign(document, {headerSpeakerStartComponentId: 'first'});
  return {document, first, block};
}
it('indexes only body sections regardless of optional kind and keeps source unchanged', () => {
  const {document} = fixture(), before = structuredClone(document), index = bulletinSectionIndex(document);
  expect(index.sections.map(section => section.id)).toEqual(['first', 'second', 'third', 'fourth']);
  expect(index.sections.map(section => section.names)).toEqual([['Alpha'], ['Beta'], ['Alpha'], ['Beta']]);
  expect(index.speakers).toEqual([{name: 'Alpha', anchor: {kind: 'sentence', id: 'first-sentence'}}, {name: 'Beta', anchor: {kind: 'sentence', id: 'second-sentence'}}]);
  expect(document).toEqual(before);
});
it('uses explicit section credits when the article header disagrees', () => {
  const {document, first, block} = fixture();
  first.bodySection.contributors = [{role: 'speaker', name: block('first-name', 'Beta')}];
  const index = bulletinSectionIndex(document);
  expect(index.sections[0].names).toEqual(['Beta']);
  expect(index.speakers.map(speaker => [speaker.name, speaker.anchor?.id])).toEqual([['Alpha', 'third-sentence'], ['Beta', 'first-sentence']]);
});
it('retains an unresolved name without guessing a start or making a dead link', () => {
  const {document, first, block} = fixture();
  first.bodySection.contributors = [{role: 'speaker', name: block('first-name', 'Beta')}];
  document.components = document.components.filter(component => component.id !== 'third');
  expect(bulletinSectionIndex(document).speakers[0]).toEqual({name: 'Alpha', anchor: undefined});
  first.bodySection.contributors = [];
  Reflect.deleteProperty(document, 'headerSpeakerStartComponentId');
  expect(bulletinSectionIndex(document).sections[0].names).toEqual([]);
  document.layoutManifest.pages.forEach(page => {page.slots = [];});
  expect(bulletinSectionIndex(document).speakers.every(speaker => !speaker.anchor)).toBe(true);
});

it('uses the source-verified start after member source coordinates are redacted', () => {
 const {document}=fixture();
 const member=JSON.parse(JSON.stringify(document, (key,value)=>key==='source'?undefined:value));
 expect(bulletinSectionIndex(member).sections[0].names).toEqual(['Alpha']);
 delete member.headerSpeakerStartComponentId;
 expect(bulletinSectionIndex(member).sections[0].names).toEqual([]);
});
