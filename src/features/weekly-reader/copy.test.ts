import {expect, it, vi} from 'vitest';
import {copySentences} from './copy';
import {readerFixture} from './test-fixture';

it('copies only ordered selected text with component gaps and the issue suffix', async () => {
  const clipboard = {writeText: vi.fn().mockResolvedValue(undefined)};
  await copySentences(readerFixture().document, ['s3', 's0', 's3'], () => true, clipboard);
  expect(clipboard.writeText).toHaveBeenCalledWith('內容0。\n\n內容3。\n\n— 第 1739 期《Private weekly》');
});
it('rechecks authorization immediately before copying and never copies a foreign/empty selection', async () => {
  const clipboard = {writeText: vi.fn()};
  await expect(copySentences(readerFixture().document, ['s0'], () => false, clipboard)).rejects.toThrow();
  await expect(copySentences(readerFixture().document, ['foreign'], () => true, clipboard)).rejects.toThrow();
  expect(clipboard.writeText).not.toHaveBeenCalled();
});
