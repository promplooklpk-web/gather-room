import type {
  MediaConnection,
  PeerConnectOption,
  PeerError,
  PeerJSOption,
} from "peerjs";
import type { ConnectionQuality } from "@/lib/types";

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

/** If STUN never yields a server-reflexive candidate, UDP is likely blocked (VPN). */
export function probeUdpBlocked(timeoutMs = 2000): Promise<boolean> {
  if (typeof RTCPeerConnection === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const finish = (blocked: boolean) => {
      if (settled) return;
      settled = true;
      try {
        pc.close();
      } catch {
        /* already closed */
      }
      resolve(blocked);
    };
    pc.addEventListener("icecandidate", (ev) => {
      const cand = ev.candidate;
      if (!cand) return;
      const typ =
        cand.type || / typ ([a-z]+)/.exec(cand.candidate || "")?.[1];
      if (typ === "srflx" || typ === "relay") finish(false);
    });
    try {
      pc.createDataChannel("vpn-probe");
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(false));
    } catch {
      finish(false);
      return;
    }
    window.setTimeout(() => finish(true), timeoutMs);
  });
}

/** Keep screen-share bitrate low enough to survive TCP TURN. */
export function constrainScreenSenders(pc: RTCPeerConnection | undefined): void {
  if (!pc) return;
  const apply = () => {
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind !== "video") return;
      const params = sender.getParameters() as RTCRtpSendParameters;
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{ rid: "0" }];
      }
      params.encodings[0].maxBitrate = 600_000;
      params.encodings[0].maxFramerate = 12;
      void sender.setParameters(params).catch(() => {
        /* Safari may reject encodings before negotiation */
      });
    });
  };
  apply();
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected" || pc.connectionState === "connecting") {
      apply();
    }
  });
}

const watchedIce = new WeakSet<RTCPeerConnection>();

/**
 * Restart ICE once on failure. Data-channel callers should recreate the Peer
 * with `iceTransportPolicy: "relay"` after this fires. Media callers should
 * retry the call instead of tearing down the Peer.
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
      scheduleGiveUp(4000);
    } else if (ice === "disconnected" || conn === "disconnected") {
      // Brief disconnects are normal during candidate switching — wait longer.
      scheduleGiveUp(12000);
    }
  };

  pc.addEventListener("iceconnectionstatechange", onChange);
  pc.addEventListener("connectionstatechange", onChange);
}

export function isMediaCallLive(call?: MediaConnection | null): boolean {
  if (!call) return false;
  const pc = call.peerConnection as RTCPeerConnection | undefined;
  if (!pc) return true;
  const connState = pc.connectionState;
  const iceState = pc.iceConnectionState;
  // "disconnected" is a brief ICE blip — tearing down the call makes the
  // viewer flash black. Only treat hard failures as dead.
  if (connState === "failed" || connState === "closed") return false;
  if (iceState === "failed" || iceState === "closed") return false;
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

function guestIdStorageKey(roomId: string) {
  return `mtlclick-guest-id:${roomId}`;
}

function randomGuestPeerId(roomId: string) {
  return `mtlclick-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Stable per-tab guest id so a brief disconnect can rejoin the same mesh slot. */
export function makeGuestPeerId(roomId: string): string {
  if (typeof sessionStorage === "undefined") return randomGuestPeerId(roomId);
  try {
    const key = guestIdStorageKey(roomId);
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = randomGuestPeerId(roomId);
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return randomGuestPeerId(roomId);
  }
}

export function rotateGuestPeerId(roomId: string): string {
  const id = randomGuestPeerId(roomId);
  if (typeof sessionStorage === "undefined") return id;
  try {
    sessionStorage.setItem(guestIdStorageKey(roomId), id);
  } catch {
    /* private mode / quota */
  }
  return id;
}

export async function inspectIceQuality(
  pc?: RTCPeerConnection
): Promise<{ candidateType: string; rtt?: number } | null> {
  if (!pc) return null;
  try {
    const stats = await pc.getStats();
    let selected: RTCStats | undefined;
    stats.forEach((report) => {
      const pair = report as RTCIceCandidatePairStats & { nominated?: boolean };
      if (pair.type !== "candidate-pair" || pair.state !== "succeeded") return;
      if (pair.nominated) selected = pair;
      else if (!selected) selected = pair;
    });
    if (!selected) return null;
    const remoteId = (selected as RTCIceCandidatePairStats).remoteCandidateId;
    const remote = remoteId ? stats.get(remoteId) : undefined;
    const candidateType =
      (remote as { candidateType?: string } | undefined)?.candidateType ??
      "unknown";
    const rtt = (selected as RTCIceCandidatePairStats).currentRoundTripTime;
    return { candidateType, rtt };
  } catch {
    return null;
  }
}

export function qualityFromIce(
  samples: Array<{ candidateType: string; rtt?: number } | null>,
  forcedRelay: boolean
): ConnectionQuality {
  if (forcedRelay) return "relay";
  const ok = samples.filter(
    (s): s is { candidateType: string; rtt?: number } => s != null
  );
  if (ok.length === 0) return "fair";
  if (ok.some((s) => s.candidateType === "relay")) return "relay";
  const rtts = ok
    .map((s) => s.rtt)
    .filter((n): n is number => typeof n === "number");
  const maxRtt = rtts.length ? Math.max(...rtts) : 0;
  if (maxRtt >= 0.4) return "poor";
  if (maxRtt >= 0.15) return "fair";
  if (ok.some((s) => s.candidateType === "srflx" || s.candidateType === "prflx")) {
    return "fair";
  }
  return "good";
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Line\/|FBAN|FBAV|Instagram|MicroMessenger|Twitter|Snapchat/i.test(ua);
}

/** iPhone/iPad, including iPadOS that reports itself as Macintosh. */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
