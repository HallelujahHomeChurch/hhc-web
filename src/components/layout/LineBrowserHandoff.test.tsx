import {fireEvent, render, screen, within} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import zhHant from '@/i18n/locales/zh-Hant.json';
import en from '@/i18n/locales/en.json';
import {LineBrowserHandoff} from './LineBrowserHandoff';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {this.open = true;});
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {this.open = false;});
  window.history.replaceState({}, '', '/zh-Hant/member-videos/11111111-1111-1111-1111-111111111111?t=90&source=line#player');
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.removeItem('hhc:line-browser-notice:dismissed');
  window.history.replaceState({}, '', '/');
});

function show() {
  return render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}><LineBrowserHandoff /></NextIntlClientProvider>);
}

describe('LINE browser handoff', () => {
  it('shows the English church name once', () => {
    render(<NextIntlClientProvider locale="en" messages={en}><LineBrowserHandoff /></NextIntlClientProvider>);
    expect(screen.getAllByText('Hallelujah Home Church')).toHaveLength(1);
  });

  it('opens an accessible modal and preserves the complete original deep link', () => {
    show();
    const dialog = screen.getByRole('dialog', {name: '使用預設瀏覽器開啟'});
    expect(dialog).toHaveAttribute('aria-describedby', 'line-browser-description');
    expect(within(dialog).getByRole('link', {name: '開啟預設瀏覽器'})).toHaveAttribute('href', 'http://localhost:3000/zh-Hant/member-videos/11111111-1111-1111-1111-111111111111?t=90&source=line&openExternalBrowser=1#player');
    expect(screen.getByRole('heading', {name: '哈利路亞家教會'})).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '登入'})).not.toBeInTheDocument();
  });

  it.each(['button', 'escape', 'open'])('leaves the branded page available after %s and only reopens on retry', action => {
    show();
    const dialog = screen.getByRole('dialog');
    if (action === 'escape') fireEvent(dialog, new Event('cancel', {cancelable: true}));
    else if (action === 'open') {
      const link = within(dialog).getByRole('link');
      link.addEventListener('click', event => event.preventDefault());
      fireEvent.click(link);
    } else fireEvent.click(within(dialog).getByRole('button', {name: '取消'}));
    expect(dialog).not.toHaveAttribute('open');
    const retry = screen.getByRole('button', {name: '重新開啟提示'});
    expect(retry).toHaveFocus();
    expect(screen.getByText(zhHant.site.lineBrowser.manual)).toBeInTheDocument();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    fireEvent.click(retry);
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(within(dialog).getByRole('link')).toHaveAttribute('href', expect.stringContaining('t=90&source=line&openExternalBrowser=1#player'));
  });

  it('does not depend on browser storage or previous banner dismissals', () => {
    sessionStorage.setItem('hhc:line-browser-notice:dismissed', '1');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {throw new Error('Blocked');});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('Blocked');});
    const {unmount} = show();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    unmount();
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });
});
