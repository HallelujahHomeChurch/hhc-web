export type ResumeIdentity = {recordingId: string; mediaVersion: string; generation?: string; sessionId?: string};
type Entry = ResumeIdentity & {expiresAt: number};
type Stored = {member: string; items: Entry[]};
export const resumeDismissalKey = 'hhc:resume-dismissals:v1';
const retention = 30 * 86400000;
let memory: Stored | undefined;
let storageFailed = false;
let legacyCleared = false;

function read(member: string): Entry[] {
  if (!storageFailed) {
    try {
      const value = JSON.parse(localStorage.getItem(resumeDismissalKey) ?? 'null') as Stored | null;
      memory = value && typeof value.member === 'string' && Array.isArray(value.items) ? value : undefined;
    } catch { /* Keep the current-document fallback if storage is unavailable. */ }
  }
  return memory?.member === member ? memory.items.filter(item => item &&
    typeof item.recordingId === 'string' && typeof item.mediaVersion === 'string' &&
    (typeof item.generation === 'string' || typeof item.sessionId === 'string') &&
    Number.isFinite(item.expiresAt) && item.expiresAt > Date.now()) : [];
}

export function dismissResume(member: string, identity: ResumeIdentity) {
  if (!identity.generation && !identity.sessionId) return;
  const items = read(member).filter(item => item.recordingId !== identity.recordingId);
  memory = {member, items: [...items, {...identity, expiresAt: Date.now() + retention}]};
  try { localStorage.setItem(resumeDismissalKey, JSON.stringify(memory)); }
  catch { storageFailed = true; }
}

export function isResumeDismissed(member: string, identity: ResumeIdentity) {
  try {
    const legacy = legacyCleared ? null : JSON.parse(sessionStorage.getItem('hhc:continue-watching-dismissal') ?? 'null');
    if (legacy?.member === member && identity.generation && legacy.generation === identity.generation) {
      dismissResume(member, identity);
      sessionStorage.removeItem('hhc:continue-watching-dismissal');
      return true;
    }
  } catch { /* Storage failure must not prevent playback. */ }
  return read(member).some(item => item.recordingId === identity.recordingId && item.mediaVersion === identity.mediaVersion &&
    (Boolean(identity.generation && item.generation === identity.generation) || Boolean(identity.sessionId && item.sessionId === identity.sessionId)));
}

export function clearResumeDismissals() {
  memory = undefined;
  storageFailed = false;
  legacyCleared = true;
  try { localStorage.removeItem(resumeDismissalKey); }
  catch { storageFailed = true; }
  try { sessionStorage.removeItem('hhc:continue-watching-dismissal'); legacyCleared = false; }
  catch { /* Do not revive legacy metadata in this document after logout. */ }
}

export function isResumeEligible(item: {positionSeconds: number; claimedAt: string; updatedAt: string}) {
  const claimed = Date.parse(item.claimedAt), updated = Date.parse(item.updatedAt);
  return Number.isFinite(item.positionSeconds) && item.positionSeconds > 0 && updated > claimed && updated + retention > Date.now();
}

export function bindResumeDismissalAccount(member: string) {
  read(member);
  let legacyMember: unknown;
  if (!legacyCleared) {
    try { legacyMember = JSON.parse(sessionStorage.getItem('hhc:continue-watching-dismissal') ?? 'null')?.member; }
    catch { /* Storage failure must not prevent playback. */ }
  }
  if ((memory && memory.member !== member) || (typeof legacyMember === 'string' && legacyMember !== member)) clearResumeDismissals();
}
