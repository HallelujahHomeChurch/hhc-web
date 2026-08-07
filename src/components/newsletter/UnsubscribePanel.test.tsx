import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {UnsubscribePanel} from './UnsubscribePanel';

const labels = {
  title: '取消電子報訂閱',
  description: '取消後將不再收到電子報。',
  confirm: '取消訂閱',
  pending: '處理中',
  successTitle: '已取消訂閱',
  successBody: '您將不再收到電子報。',
  invalid: '連結無效',
  error: '目前無法取消訂閱',
  home: '返回首頁'
};

afterEach(() => vi.restoreAllMocks());

describe('UnsubscribePanel', () => {
  it('submits the opaque token and shows the success state', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {status: 200}));
    render(<UnsubscribePanel homeHref="/zh-Hant" labels={labels} token="opaque-token" />);

    await userEvent.click(screen.getByRole('button', {name: '取消訂閱'}));

    expect(request).toHaveBeenCalledWith('/api/engagement/v1/newsletter/unsubscribe', {
      body: JSON.stringify({token: 'opaque-token'}),
      headers: {'Content-Type': 'application/json'},
      method: 'POST'
    });
    expect(await screen.findByRole('heading', {name: '已取消訂閱'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '返回首頁'})).toHaveAttribute('href', '/zh-Hant');
  });

  it('does not submit when the link has no token', () => {
    render(<UnsubscribePanel homeHref="/zh-Hant" labels={labels} token="" />);

    expect(screen.getByText('連結無效')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '取消訂閱'})).not.toBeInTheDocument();
  });
});
