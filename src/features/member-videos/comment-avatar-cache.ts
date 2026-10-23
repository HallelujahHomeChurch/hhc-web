import type {RecordingComment} from '@hallelujahhomechurch/hhc-web-client';

const maxImages = 64;
const imageWaitMs = 2000;
type Entry = {image: HTMLImageElement; ready: boolean; expires: number; pending: Promise<boolean>};
// Only public image URLs/decoded images live here, never comments or account IDs.
const images = new Map<string, Entry>();

export function commentAvatarURL(comment: RecordingComment): string | undefined {
  if (comment.deleted || comment.hidden || !('avatarUrl' in comment) || typeof comment.avatarUrl !== 'string' || !comment.avatarUrl) return;
  try {
    const url = new URL(comment.avatarUrl, window.location.origin);
    if (url.protocol === 'https:' || url.origin === window.location.origin) return url.href;
  } catch { /* Malformed optional profile data uses the normal fallback. */ }
}

export function preparedCommentAvatar(comment: RecordingComment): string | undefined {
  const url = commentAvatarURL(comment);
  return url && images.get(url)?.ready ? url : undefined;
}

function prepare(url: string): Promise<boolean> {
  const existing = images.get(url);
  if (existing && Date.now() < existing.expires) {
    images.delete(url);
    images.set(url, existing);
    return existing.pending;
  }
  const image = new Image(36, 36);
  let finish!: (ready: boolean) => void;
  const pending = new Promise<boolean>(resolve => { finish = resolve; });
  const entry: Entry = {image, pending, ready: false, expires: Infinity};
  images.delete(url);
  while (images.size >= maxImages) images.delete(images.keys().next().value!);
  images.set(url, entry);
  let settled = false;
  const complete = (ready: boolean) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    image.onload = image.onerror = null;
    entry.ready = ready;
    entry.expires = Date.now() + (ready ? 20 * 60_000 : 30_000);
    if (!ready) image.src = '';
    finish(ready);
  };
  const timer = setTimeout(() => complete(false), imageWaitMs);
  image.onerror = () => complete(false);
  image.onload = () => {
    if (typeof image.decode === 'function') void image.decode().then(() => complete(true), () => complete(false));
    else complete(true);
  };
  image.decoding = 'async';
  image.src = url;
  return pending;
}

export async function prepareCommentAvatars(comments: RecordingComment[]): Promise<RecordingComment[]> {
  const urls = new Set(comments.map(commentAvatarURL).filter((url): url is string => Boolean(url)));
  // This batch owns its results even when another batch evicts the shared cache.
  const ready = new Map(await Promise.all(Array.from(urls, async url => [url, await prepare(url)] as const)));
  return comments.map(comment => {
    const url = commentAvatarURL(comment);
    return {...comment, avatarUrl: url && ready.get(url) ? url : undefined};
  });
}
