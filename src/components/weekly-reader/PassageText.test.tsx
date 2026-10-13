import {createRef} from 'react';
import {render, screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {PassageText} from './PassageText';

const sentences = [{id: 'a', componentId: 'c', text: '甲😀乙'}];
it('renders controlled mobile selection and Unicode fragment bounds with caller-owned ref and focus', () => {
  const root = createRef<HTMLDivElement>();
  const view = render(<PassageText root={root} sentences={sentences} selection={{ids: ['a']}} mobile tabIndex={0}/>);
  const sentence = screen.getByRole('button', {name: '甲😀乙'});
  expect(root.current).toHaveAttribute('tabindex', '0');
  expect(root.current).toHaveClass('reader-recovery-anchors', 'reader-recovery-text');
  expect(sentence).toHaveAttribute('aria-pressed', 'true');
  expect(sentence).toHaveAttribute('data-fragment-start', '0');
  expect(sentence).toHaveAttribute('data-fragment-end', '3');
  view.rerender(<PassageText root={root} sentences={sentences} selection={{ids: []}} mobile tabIndex={0}/>);
  expect(sentence).toHaveAttribute('aria-pressed', 'false');
  expect(sentence).not.toHaveAttribute('data-selected');
});
it('preserves native-text markup and the recovery caller root without tabIndex', () => {
  const root = createRef<HTMLDivElement>();
  render(<PassageText root={root} sentences={sentences} selection={{ids: ['a']}} mobile={false}/>);
  expect(root.current).not.toHaveAttribute('tabindex');
  expect(root.current).not.toHaveAttribute('data-sentence-selection');
  const sentence = screen.getByText('甲😀乙');
  expect(sentence).not.toHaveAttribute('role');
  expect(sentence).not.toHaveAttribute('tabindex');
  expect(sentence).not.toHaveAttribute('aria-pressed');
  expect(sentence).not.toHaveAttribute('data-selected');
});
