export function parseDownloadFilename(header: string | null, fallback = 'bulletin.pdf') {
  if (!header) return fallback;
  const encoded = header.match(/filename\*\s*=\s*(?:UTF-8'')?"?([^";]+)/i)?.[1];
  const plain = header.match(/(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  let value = encoded;
  if (value) {
    try { value = decodeURIComponent(value); } catch { value = undefined; }
  }
  value ??= plain?.[1] ?? plain?.[2];
  const safe = value?.trim().replace(/[\\/\u0000-\u001f\u007f]/g, '_');
  return safe || fallback;
}
