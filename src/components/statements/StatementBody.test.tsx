import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import type {StatementDocument} from '@/features/news/types';
import {StatementBody} from './StatementBody';

describe('StatementBody', () => {
  it('renders the approved rich document without interpreting HTML', () => {
    render(<StatementBody locale="zh-Hant" body="fallback" imageLabels={{open: '放大圖片', close: '關閉圖片'}} bodyJson={{schemaVersion: 1, blocks: [
      {id: 'heading', type: 'heading', level: 2, alignment: 'center', content: [{type: 'text', text: '重要聲明'}]},
      {id: 'copy', type: 'paragraph', alignment: 'start', content: [{type: 'text', text: '<script>安全文字</script>', marks: ['strong']}, {type: 'lineBreak'}, {type: 'link', href: 'https://example.com', content: [{type: 'text', text: '詳情'}]}]},
      {id: 'points', type: 'list', ordered: false, items: [{content: [{type: 'text', text: '第一點'}]}]},
      {id: 'photo', type: 'image', url: '/assets/statement/photo', size: 'small', alignment: 'end', alt: {mode: 'text', text: '活動照片'}, caption: [{type: 'text', text: '圖片說明'}]}
    ]}} />);

    expect(screen.getByRole('heading', {name: '重要聲明'})).toHaveClass('text-center');
    expect(screen.getByText('<script>安全文字</script>').closest('strong')).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: '詳情'})).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByRole('list')).toHaveTextContent('第一點');
    expect(screen.getByRole('img', {name: '活動照片'})).toHaveAttribute('src', '/assets/statement/photo');
    expect(screen.getByText('圖片說明')).toBeInTheDocument();
  });

  it('keeps legacy plain text as a fallback', () => {
    render(<StatementBody locale="zh-Hant" body={'第一行\n第二行'} imageLabels={{open: '放大圖片', close: '關閉圖片'}} />);
    expect(screen.getByText(/第一行/)).toHaveClass('whitespace-pre-wrap');
  });

  it('renders a published statement with an empty paragraph', () => {
    const bodyJson = JSON.parse('{"schemaVersion":1,"blocks":[{"id":"copy","type":"paragraph","content":[{"type":"text","text":"內文"}]},{"id":"blank","type":"paragraph"}]}') as StatementDocument;
    render(<StatementBody locale="zh-Hant" body="內文" bodyJson={bodyJson} imageLabels={{open: '放大圖片', close: '關閉圖片'}} />);
    expect(screen.getByText('內文')).toBeInTheDocument();
    expect(document.querySelectorAll('p')).toHaveLength(2);
  });

  it('enlarges an image and returns focus without changing its alt or caption', async () => {
    HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open', '');};
    HTMLDialogElement.prototype.close = function() {this.removeAttribute('open'); this.dispatchEvent(new Event('close'));};
    const user = userEvent.setup();
    render(<StatementBody locale="zh-Hant" body="fallback" imageLabels={{open: '放大圖片', close: '關閉圖片'}} bodyJson={{schemaVersion: 1, blocks: [
      {id: 'photo', type: 'image', url: '/assets/statement/photo', alt: {mode: 'text', text: '活動照片'}, caption: [{type: 'text', text: '原有說明'}]}
    ]}} />);

    const trigger = screen.getByRole('button', {name: '放大圖片'});
    expect(trigger).toContainElement(screen.getByRole('img', {name: '活動照片'}));
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', {name: '放大圖片'});
    expect(dialog).toContainElement(screen.getAllByRole('img', {name: '活動照片'})[1]);
    await user.click(screen.getByRole('button', {name: '關閉圖片'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(screen.getByText('原有說明')).toBeInTheDocument();
  });
});
