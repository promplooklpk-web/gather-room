import type { PeerConnectOption, PeerError } from "peerjs";

export const PEER_OPTIONS = {
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: [
          "turn:eu-0.turn.peerjs.com:3478",
          "turn:us-0.turn.peerjs.com:3478",
        ],
        username: "peerjs",
        credential: "peerjsp",
      },
    ],
    sdpSemantics: "unified-plan",
  },
};

export const CONNECT_OPTIONS: PeerConnectOption = {
  reliable: true,
  serialization: "json",
};

export const SCREEN_CALL_META = { type: "screen" as const };

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
  return `mtlclick-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Line\/|FBAN|FBAV|Instagram|MicroMessenger|Twitter|Snapchat/i.test(ua);
}
