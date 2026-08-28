import type { PeerError } from "peerjs";
import { ROOM_HOST_ID, ROOM_ID } from "@/lib/types";

export const PEER_OPTIONS = {
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
};

export const SCREEN_CALL_META = { type: "screen" as const };

export { ROOM_HOST_ID };

/** Errors that are expected during normal join / flaky mobile networks. */
export function isTransientPeerError(err: PeerError<string>): boolean {
  return [
    "unavailable-id",
    "peer-unavailable",
    "network",
    "socket-error",
    "socket-closed",
    "webrtc",
  ].includes(err.type);
}

export function makeGuestPeerId(roomId: string): string {
  return `gather-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
}
