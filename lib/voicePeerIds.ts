import { getGuestScope, getRoomHostId } from "@/lib/rooms";

/** Old mesh ids: mtlclick-{roomId}-{random} without session in the scope segment. */
export function isLegacyGuestPeerId(peerId: string, roomId: string): boolean {
  const escaped = roomId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^mtlclick-${escaped}-[a-z0-9]{2,12}$`, "i").test(peerId);
}

/** Current guest ids: mtlclick-{roomId}-{session}-{random}. */
export function isCurrentGuestPeerId(
  peerId: string,
  roomId: string,
  session: string
): boolean {
  const scope = getGuestScope(roomId, session);
  const prefix = `mtlclick-${scope}-`;
  if (!peerId.startsWith(prefix)) return false;
  const suffix = peerId.slice(prefix.length);
  return /^[a-z0-9]{2,12}$/i.test(suffix);
}

export function isCurrentHostPeerId(
  peerId: string,
  roomId: string,
  session: string
): boolean {
  return peerId === getRoomHostId(roomId, session);
}

/**
 * Peers we should open a PeerJS data channel to for this room session.
 * Excludes legacy broker ids and the synthetic host id (presence mesh dials guests only).
 */
export function isDialableMeshPeerId(
  peerId: string,
  roomId: string,
  session: string
): boolean {
  if (!peerId || isLegacyGuestPeerId(peerId, roomId)) return false;
  if (isCurrentHostPeerId(peerId, roomId, session)) return false;
  return isCurrentGuestPeerId(peerId, roomId, session);
}

/** Sidebar occupancy: ignore legacy ids that cannot be live on the broker. */
export function isOccupancyPeerId(peerId: string, roomId: string): boolean {
  if (!peerId.startsWith("mtlclick-")) return false;
  if (isLegacyGuestPeerId(peerId, roomId)) return false;
  const escaped = roomId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^mtlclick-${escaped}-`, "i").test(peerId);
}
