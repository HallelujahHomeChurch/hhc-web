import {cache} from 'react';

const memberOnlyAccess = {enabled: false} as const;

export const getBulletinAccess = cache(async () => memberOnlyAccess);
export async function isBulletinEnabled(): Promise<boolean> { return false; }
