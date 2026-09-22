export interface VoiceRoom {
  id: string;
  slug: string;
  label: string;
  labelTh: string;
}

export const VOICE_ROOMS: VoiceRoom[] = [
  { id: "meeting-1", slug: "meeting-1", label: "Meeting 1", labelTh: "ประชุม 1" },
  { id: "meeting-2", slug: "meeting-2", label: "Meeting 2", labelTh: "ประชุม 2" },
  { id: "meeting-3", slug: "meeting-3", label: "Meeting 3", labelTh: "ประชุม 3" },
  { id: "meeting-4", slug: "meeting-4", label: "Meeting 4", labelTh: "ประชุม 4" },
  { id: "meeting-5", slug: "meeting-5", label: "Meeting 5", labelTh: "ประชุม 5" },
];

export const DEFAULT_ROOM_ID = VOICE_ROOMS[0].id;

/** Query param that isolates PeerJS host ids per invite / voice session. */
export const ROOM_SESSION_QUERY = "session";

const SESSION_STORAGE_PREFIX = "mtlclick-session:";

/** Prefix on PeerJS ids so we do not collide with unrelated apps on 0.peerjs.com. */
export function getPeerRealm(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PEER_REALM?.trim();
  if (fromEnv) return fromEnv.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "lpk";
  return "lpk";
}

export function isValidRoomSession(session: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/.test(session);
}

function randomRoomSession(): string {
  return Math.random().toString(36).slice(2, 10);
}

function sessionStorageKey(roomId: string): string {
  return `${SESSION_STORAGE_PREFIX}${roomId}`;
}

/** Read session from ?session= or hash `roomId~session` (shareable across browser contexts). */
export function readRoomSessionFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(ROOM_SESSION_QUERY);
  if (fromQuery && isValidRoomSession(fromQuery)) return fromQuery;

  const hash = window.location.hash.replace(/^#/, "").trim();
  const tilde = hash.indexOf("~");
  if (tilde > 0) {
    const fromHash = hash.slice(tilde + 1);
    if (isValidRoomSession(fromHash)) return fromHash;
  }
  return null;
}

export function syncRoomSessionToUrl(roomId: string, session: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set(ROOM_SESSION_QUERY, session);
  url.searchParams.delete("host");
  url.hash = `${roomId}~${session}`;
  window.history.replaceState({}, "", url.toString());
}

/**
 * Resolve the voice session for this room: URL (authoritative) → tab storage → new random id.
 * Always mirrors session into the URL so incognito + normal can share one link.
 */
export function ensureRoomSession(roomId: string): string {
  const fromUrl = readRoomSessionFromUrl();
  if (fromUrl) {
    try {
      sessionStorage.setItem(sessionStorageKey(roomId), fromUrl);
    } catch {
      /* private mode */
    }
    syncRoomSessionToUrl(roomId, fromUrl);
    return fromUrl;
  }

  if (typeof sessionStorage !== "undefined") {
    try {
      const stored = sessionStorage.getItem(sessionStorageKey(roomId));
      if (stored && isValidRoomSession(stored)) {
        syncRoomSessionToUrl(roomId, stored);
        return stored;
      }
    } catch {
      /* private mode */
    }
  }

  const session = randomRoomSession();
  try {
    sessionStorage.setItem(sessionStorageKey(roomId), session);
  } catch {
    /* private mode */
  }
  syncRoomSessionToUrl(roomId, session);
  return session;
}

export function getRoomHostId(roomId: string, session: string): string {
  const realm = getPeerRealm();
  return `mtlclick-${realm}-${roomId}-${session}-host`;
}

export function getGuestScope(roomId: string, session: string): string {
  return `${roomId}-${session}`;
}

export function findRoom(roomId: string | null | undefined): VoiceRoom | undefined {
  if (!roomId) return undefined;
  const cleaned = roomId.replace(/^#/, "").trim().split("~")[0];
  return VOICE_ROOMS.find((r) => r.id === cleaned || r.slug === cleaned);
}

export function parseRoomFromUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ROOM_ID;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = findRoom(params.get("room"));
  if (fromQuery) return fromQuery.id;
  const hashRoom = window.location.hash.replace(/^#/, "").trim().split("~")[0];
  const fromHash = findRoom(hashRoom);
  return fromHash?.id ?? DEFAULT_ROOM_ID;
}

export function setRoomInUrl(roomId: string) {
  ensureRoomSession(roomId);
}

export function getShareUrl(roomId: string): string {
  const session = ensureRoomSession(roomId);
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set(ROOM_SESSION_QUERY, session);
  url.searchParams.delete("host");
  url.hash = `${roomId}~${session}`;
  return url.toString();
}
