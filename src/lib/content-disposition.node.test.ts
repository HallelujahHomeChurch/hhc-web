import {describe, expect, it} from 'vitest';
import {parseDownloadFilename} from './content-disposition';

describe('parseDownloadFilename', () => {
  it('decodes UTF-8 and falls back safely', () => {
    expect(parseDownloadFilename("attachment; filename*=UTF-8''1737-%E8%A9%A9%E7%AF%87%E5%BB%BF%E4%B8%83%E7%AF%87.pdf")).toBe('1737-詩篇廿七篇.pdf');
    expect(parseDownloadFilename('attachment; filename="weekly.pdf"')).toBe('weekly.pdf');
    expect(parseDownloadFilename("attachment; filename*=UTF-8''%ZZ; filename=weekly.pdf")).toBe('weekly.pdf');
    expect(parseDownloadFilename('attachment; filename="../bad\u0000.pdf"')).toBe('.._bad_.pdf');
    expect(parseDownloadFilename(null)).toBe('bulletin.pdf');
  });
});
