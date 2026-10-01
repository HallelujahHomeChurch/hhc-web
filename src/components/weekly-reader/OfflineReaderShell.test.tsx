import {render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {OfflineReaderShell} from './OfflineReaderShell';
import {getMessages} from '@/i18n/messages';
vi.mock('./WeeklyReader', () => ({WeeklyReader: ({issueNumber, contentLocale}: {issueNumber: number; contentLocale: string}) => <output>{issueNumber}:{contentLocale}</output>}));
afterEach(() => {history.replaceState(null, '', '/');});
it('reads only the exact requested URL rather than substituting a saved or cached issue', async () => {
  history.replaceState(null, '', '/en/literature-ministry/1740/read/general/zh-Hant');
  render(<OfflineReaderShell locale="en" messages={getMessages('en').weeklyReader}/>);
  expect(await screen.findByText('1740:zh-Hant')).toBeInTheDocument();
});
it('rejects a malformed or different UI-locale route', async () => {
  history.replaceState(null, '', '/ja/literature-ministry/1739/read/general/zh-Hant');
  render(<OfflineReaderShell locale="en" messages={getMessages('en').weeklyReader}/>);
  expect(await screen.findByText('This bulletin is unavailable.')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toHaveTextContent('1739');
});
