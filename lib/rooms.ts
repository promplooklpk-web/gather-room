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

export function getRoomHostId(roomId: string): string {
  return `gather-${roomId}-host`;
}

export function findRoom(roomId: string | null | undefined): VoiceRoom | undefined {
  if (!roomId) return undefined;
  return VOICE_ROOMS.find((r) => r.id === roomId || r.slug === roomId);
}

export function parseRoomFromUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ROOM_ID;
  const param = new URLSearchParams(window.location.search).get("room");
  return findRoom(param)?.id ?? DEFAULT_ROOM_ID;
}

export function setRoomInUrl(roomId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.delete("host");
  window.history.replaceState({}, "", url.toString());
}
