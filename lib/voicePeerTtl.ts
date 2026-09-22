/** Only dial peers whose registry row was refreshed within this window. */
export const VOICE_PEER_DIAL_MAX_AGE_MS = 60_000;

/** Delete voice_peers rows older than this (clients run periodic cleanup). */
export const VOICE_PEER_DB_TTL_MS = 90_000;

/** Keep our own row fresh so others do not treat us as stale. */
export const VOICE_PEER_HEARTBEAT_MS = 2_000;

export const VOICE_PEER_POLL_MS = 3_000;

export const VOICE_PEER_STALE_PURGE_INTERVAL_MS = 30_000;

export function dialCutoffIso(maxAgeMs = VOICE_PEER_DIAL_MAX_AGE_MS): string {
  return new Date(Date.now() - maxAgeMs).toISOString();
}

export function dbTtlCutoffIso(maxAgeMs = VOICE_PEER_DB_TTL_MS): string {
  return new Date(Date.now() - maxAgeMs).toISOString();
}

export function isRowFresh(
  updatedAt: string | null | undefined,
  maxAgeMs = VOICE_PEER_DIAL_MAX_AGE_MS
): boolean {
  if (!updatedAt) return false;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= maxAgeMs;
}
