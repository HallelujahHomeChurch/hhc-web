import {describe, expect, it, vi} from 'vitest';
import {fitPaperLines} from './paper-lines';

describe('single-line paper fields', () => {
  it('places the issue immediately after the date regardless of the original column gap', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-bulletin-mode="paper"><section data-bulletin-page="cover"><p data-fixed-element="date" style="left:10%;top:28%;width:20%">Sep.27.2026</p><p data-fixed-element="issueNumber" style="left:40%;top:29%;width:15%">第1740期</p></section></div>';
    const date = root.querySelector<HTMLElement>('[data-fixed-element="date"]')!;
    const issue = root.querySelector<HTMLElement>('[data-fixed-element="issueNumber"]')!;
    Object.defineProperty(date, 'offsetLeft', {value: 60});
    Object.defineProperty(date, 'offsetWidth', {value: 100});
    const restore = fitPaperLines(root, new Set());
    expect(date.style.width).toBe('max-content');
    expect(issue.style.left).toBe('160px');
    expect(issue.style.top).toBe('28%');
    expect(issue.textContent).toBe('第1740期');
    restore();
    expect(issue.style.left).toBe('40%');
    expect(date.style.width).toBe('20%');
  });
  it('omits the production band and moves only the same page body up without changing text or widths', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-bulletin-mode="paper"><section data-bulletin-page="p1"><p data-block-id="date" style="top:28%;width:15%">Date</p><p data-block-id="credit" style="top:30%">Credit</p><p data-fixed-element="bodyIssueSummary" style="top:28%">Issue</p><p data-fixed-element="topRule" style="top:35%"></p><p data-block-id="body" style="top:36%;width:80%">First page only</p><p data-fixed-element="speakerSeparator" style="top:36%">～</p></section><section data-bulletin-page="p2"><p data-block-id="next" style="top:10%">Next page only</p></section></div>';
    const restore = fitPaperLines(root, new Set(['date', 'credit']));
    expect(root.querySelector<HTMLElement>('[data-block-id="date"]')!.style.display).toBe('none');
    expect(root.querySelector<HTMLElement>('[data-fixed-element="bodyIssueSummary"]')!.style.display).toBe('none');
    const body = root.querySelector<HTMLElement>('[data-block-id="body"]')!;
    expect(body.style.top).toBe('28%');
    expect(body.style.width).toBe('80%');
    expect(body.textContent).toBe('First page only');
    expect(root.querySelector<HTMLElement>('[data-block-id="next"]')!.style.top).toBe('10%');
    expect(root.querySelectorAll('[data-bulletin-page]')).toHaveLength(2);
    restore();
    expect(body.style.top).toBe('36%');
  });
  it('fits only titles without changing text, anchors or body paragraphs', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-bulletin-mode="paper"><p data-body-title data-block-id="title" style="width:100px;line-height:20px;min-height:40px"><span data-sentence-id="title-s">Long title</span></p><p data-block-id="credit" style="width:100px;line-height:16px">Credits</p><p data-block-id="body">Body</p></div>';
    for (const el of root.querySelectorAll('p')) {
      Object.defineProperty(el, 'clientWidth', {value: 100});
      el.getBoundingClientRect = () => ({width: 50}) as DOMRect;
    }
    const original = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = vi.fn(() => ({width: 100}) as DOMRect);
    try {
      const restore = fitPaperLines(root, new Set());
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
