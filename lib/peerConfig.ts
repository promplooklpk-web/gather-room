import type {
  MediaConnection,
  PeerConnectOption,
  PeerError,
  PeerJSOption,
} from "peerjs";

/**
 * ICE servers for mesh P2P (data + media).
 *
 * PeerJS `config` *replaces* the built-in STUN list — it does not merge.
 * Corporate / Mac VPN (utun) often blocks UDP, so UDP-only TURN never
 * produces a working candidate and the room looks "dead": no chat, no
 * screen share. Always advertise TCP + TLS TURN on 80/443 as well.
 */
export function iceServers(): RTCIceServer[] {
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    {
      urls: [
        "turn:eu-0.turn.peerjs.com:3478",
        "turn:eu-0.turn.peerjs.com:3478?transport=tcp",
        "turn:us-0.turn.peerjs.com:3478",
        "turn:us-0.turn.peerjs.com:3478?transport=tcp",
      ],
      username: "peerjs",
      credential: "peerjsp",
    },
    // Open Relay: ports 80/443 survive most VPN / firewall policies.
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];
}

export function getPeerOptions(forceRelay = false): PeerJSOption {
  return {
    host: "0.peerjs.com",
    port: 443,
    path: "/",
    secure: true,
    config: {
      iceServers: iceServers(),
      iceCandidatePoolSize: 8,
      iceTransportPolicy: forceRelay ? "relay" : "all",
    },
  };
}

export const PEER_OPTIONS = getPeerOptions(false);

export const CONNECT_OPTIONS: PeerConnectOption = {
  reliable: true,
  serialization: "json",
};

export const SCREEN_CALL_META = { type: "screen" as const };

const watchedIce = new WeakSet<RTCPeerConnection>();

/**
 * Restart ICE once on failure, then give up so the room can recreate
 * the Peer with `iceTransportPolicy: "relay"` (VPN / UDP-blocked path).
 */
export function watchRtcIce(
  pc: RTCPeerConnection | undefined,
  onUnrecoverable: () => void
): void {
  if (!pc || watchedIce.has(pc)) return;
  watchedIce.add(pc);

  let restarted = false;
  let giveUpTimer: number | undefined;

  const clearGiveUp = () => {
    if (giveUpTimer != null) {
      window.clearTimeout(giveUpTimer);
      giveUpTimer = undefined;
    }
  };

  const scheduleGiveUp = (delayMs: number) => {
    if (giveUpTimer != null) return;
    giveUpTimer = window.setTimeout(() => {
      giveUpTimer = undefined;
      const ice = pc.iceConnectionState;
      const conn = pc.connectionState;
      if (
        ice === "failed" ||
        ice === "disconnected" ||
        conn === "failed" ||
        conn === "disconnected"
      ) {
        onUnrecoverable();
      }
    }, delayMs);
  };

  const onChange = () => {
    const ice = pc.iceConnectionState;
    const conn = pc.connectionState;
    if (
      ice === "connected" ||
      ice === "completed" ||
      conn === "connected"
    ) {
      clearGiveUp();
      return;
    }
    if (ice === "failed" || conn === "failed") {
      if (!restarted) {
        restarted = true;
        try {
          pc.restartIce();
        } catch {
          /* older WebKit */
        }
      }
      scheduleGiveUp(2500);
    } else if (ice === "disconnected" || conn === "disconnected") {
      if (!restarted) {
        restarted = true;
        try {
          pc.restartIce();
        } catch {
          /* older WebKit */
        }
      }
      scheduleGiveUp(5000);
    }
  };

  pc.addEventListener("iceconnectionstatechange", onChange);
  pc.addEventListener("connectionstatechange", onChange);
  onChange();
}

export function isMediaCallLive(call?: MediaConnection | null): boolean {
  if (!call) return false;
  const pc = call.peerConnection as RTCPeerConnection | undefined;
  const connState = pc?.connectionState;
  const iceState = pc?.iceConnectionState;
  if (connState === "failed" || connState === "closed" || connState === "disconnected") {
    return false;
  }
  if (iceState === "failed" || iceState === "closed" || iceState === "disconnected") {
    return false;
  }
  return true;
}

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
