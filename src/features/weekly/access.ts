import {cache} from 'react';
import {publicContentClient} from '@/features/content/client';
import {captureHandledError} from '@/lib/observability';

// React cache deduplicates within a server render, never across requests.
export const getBulletinAccess = cache(() => publicContentClient(true).getBulletinAccess());

// Entry points fail closed; direct page requests keep the original error.
export async function isBulletinEnabled(): Promise<boolean> {
  try {
    return (await getBulletinAccess()).enabled;
  } catch (error) {
    captureHandledError(error, {operation: 'bulletin.access_config', level: 'warning'});
    return false;
  }
}
