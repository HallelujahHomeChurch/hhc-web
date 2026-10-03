import {describe, expect, it, vi} from 'vitest';
import {fitPaperLines} from './paper-lines';

describe('single-line paper fields', () => {
  it('fits only titles and credits without changing text, anchors or body paragraphs', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-bulletin-mode="paper"><p data-body-title data-block-id="title" style="width:100px;line-height:20px;min-height:40px"><span data-sentence-id="title-s">Long title</span></p><p data-block-id="credit" style="width:100px;line-height:16px">Credits</p><p data-block-id="body">Body</p></div>';
    for (const el of root.querySelectorAll('p')) {
      Object.defineProperty(el, 'clientWidth', {value: 100});
      el.getBoundingClientRect = () => ({width: 50}) as DOMRect;
    }
    const original = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = vi.fn(() => ({width: 100}) as DOMRect);
    try {
      const restore = fitPaperLines(root, new Map([['credit', 'editorLabel']]));
      const title = root.querySelector<HTMLElement>('[data-body-title]')!;
      expect(title.style.whiteSpace).toBe('nowrap');
      expect(title.style.minHeight).toBe('20px');
      expect(title.style.transform).toBe('scaleX(0.5)');
      expect(title.style.width).toBe('200px');
      expect(title.textContent).toBe('Long title');
      expect(root.querySelector('[data-sentence-id="title-s"]')).not.toBeNull();
      expect(root.querySelector<HTMLElement>('[data-block-id="body"]')!.style.whiteSpace).toBe('');
      restore();
      expect(title.style.minHeight).toBe('40px');
      expect(title.style.transform).toBe('');
    } finally {Range.prototype.getBoundingClientRect = original;}
  });
});
