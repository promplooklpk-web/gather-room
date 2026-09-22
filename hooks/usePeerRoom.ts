"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import {
  attachRemoteAudioStream,
  createRemoteAudioElement,
  getMicStream,
  getMicTrack,
  playRemoteAudio,
  removeRemoteAudioElement,
  unlockAllRemoteAudio,
  monitorAudioStream,
  setPeerVolume as setAudioPeerVolume,
} from "@/lib/audio";
import {
  CONNECT_OPTIONS,
  SCREEN_CALL_META,
  constrainScreenSenders,
  getPeerOptions,
  inspectIceQuality,
  isMediaCallLive,
  callHasLiveVideo,
  isTransientPeerError,
  makeGuestPeerId,
  qualityFromIce,
  rotateGuestPeerId,
  unavailablePeerId,
  isIosDevice,
  watchRtcIce,
} from "@/lib/peerConfig";
import {
  playJoinSound,
  playLeaveSound,
  playMuteSound,
  playUnmuteSound,
  playMessageSound,
} from "@/lib/soundEffects";
import { pickColor } from "@/lib/colors";
import {
  ensureRoomSession,
  getGuestScope,
  getRoomHostId,
  getShareUrl as buildShareUrl,
} from "@/lib/rooms";
import type {
  ChatMessage,
  ConnectionQuality,
  ConnectionStatus,
  PeerInfo,
  PlayerState,
  SignalingMessage,
} from "@/lib/types";

const HOST_CONNECT_MAX_ATTEMPTS = 36;
const HOST_CONNECT_INTERVAL_MS = 700;
const HOST_TAKEOVER_RETRY_AFTER = 3;
const HOST_TAKEOVER_PROBE_MS = 3500;
const HOST_PEER_UNAVAILABLE_TAKEOVER = 2;
const RELAY_FALLBACK_AFTER = 4;
const RELAY_RECREATE_DELAY_MS = 1000;
const PEER_LEAVE_GRACE_MS = 5_000;
const STALE_PEER_MS = 8_000;
const DATA_RECONNECT_DELAY_MS = 400;
const STUCK_CONN_MS = 2000;

function isConnInFlight(conn?: DataConnection, startedAt?: number) {
  if (!conn) return false;
  if (conn.open) return true;
  if (startedAt && Date.now() - startedAt > STUCK_CONN_MS) return false;
  const state = (conn.peerConnection as RTCPeerConnection | undefined)
    ?.connectionState;
  return !state || state === "new" || state === "connecting" || state === "connected";
}

function shouldOfferAudio(myId: string | null, remoteId: string) {
  if (!myId) return false;
  return myId < remoteId;
}

function isRtcHealthy(pc?: RTCPeerConnection) {
  if (!pc) return false;
  const ice = pc.iceConnectionState;
  const conn = pc.connectionState;
  return ice === "connected" || ice === "completed" || conn === "connected";
}

interface RemotePeer {
  info: PeerInfo;
  conn?: DataConnection;
  connStartedAt?: number;
  disconnectedAt?: number;
  lastHeardAt?: number;
  audioCall?: MediaConnection;
  screenCall?: MediaConnection;
  audioEl?: HTMLAudioElement;
  audioMonitor?: { stop: () => void };
}

interface UsePeerRoomOptions {
  name: string;
  roomId: string;
  enabled: boolean;
}

export function usePeerRoom({ name, roomId, enabled }: UsePeerRoomOptions) {
  const roomHostIdRef = useRef("");
  const [myId, setMyId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [connectionQuality, setConnectionQuality] =
    useState<ConnectionQuality>("fair");
  const [retryNonce, setRetryNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [remoteScreen, setRemoteScreen] = useState<{
    peerId: string;
    name: string;
    stream: MediaStream;
  } | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);

  // Enhancements: Chat, Speaking Indicator, Per-User Volume
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remotesRef = useRef<Map<string, RemotePeer>>(new Map());
  const myColorRef = useRef("");
  const hostIdRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const myIdRef = useRef<string | null>(null);
  const nameRef = useRef(name);
  const isMutedRef = useRef(false);
  const localMonitorRef = useRef<{ stop: () => void } | null>(null);
  const hasPlayedJoinSoundRef = useRef(false);

  const connectToPeerRef = useRef<(remoteId: string) => void>(() => {});
  const stopScreenShareRef = useRef<() => void>(() => {});
  const startScreenCallToPeerRef = useRef<(remoteId: string, force?: boolean) => void>(
    () => {}
  );
  const setupDataConnectionRef = useRef<(conn: DataConnection) => void>(() => {});
  const setupScreenReceiveCallRef = useRef<(call: MediaConnection) => void>(() => {});
  const stopHostConnectRetryRef = useRef<() => void>(() => {});
  const startHostConnectRetryRef = useRef<() => void>(() => {});
  const tryTakeoverRef = useRef<() => void>(() => {});
  const switchToRelayRef = useRef<() => void>(() => {});
  const onIceFailureRef = useRef<(kind: "data" | "media") => void>(() => {});
  const removePlayerRef = useRef<(peerId: string) => void>(() => {});
  const hostConnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hostTakeoverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hostMissCountRef = useRef(0);
  const takeoverInFlightRef = useRef(false);
  const markGuestConnectedRef = useRef<() => void>(() => {});
  const startHostTakeoverProbeRef = useRef<() => void>(() => {});
  const stopHostTakeoverProbeRef = useRef<() => void>(() => {});
  const forceRelayRef = useRef(false);
  const switchingRelayRef = useRef(false);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    if (!myColorRef.current) {
      const savedColor = typeof window !== "undefined" ? localStorage.getItem("mtlclick-usercolor") : null;
      myColorRef.current = savedColor || pickColor(Math.floor(Math.random() * 8));
    }
  }, []);

  const broadcast = useCallback((msg: SignalingMessage) => {
    remotesRef.current.forEach((remote) => {
      if (remote.conn?.open) {
        try {
          remote.conn.send(msg);
        } catch {
          /* connection closing */
        }
      }
    });
  }, []);

  const updatePlayer = useCallback((peerId: string, patch: Partial<PlayerState>) => {
    setPlayers((prev) => {
      const current = prev[peerId];
      if (!current) {
        return {
          ...prev,
          [peerId]: {
            id: peerId,
            name: patch.name || "???",
            color: patch.color || pickColor(peerId.length),
            isSharingScreen: patch.isSharingScreen || false,
            disconnected: patch.disconnected || false,
            ...patch,
          },
        };
      }
      return { ...prev, [peerId]: { ...current, ...patch } };
    });
  }, []);

  const attachRemoteScreen = useCallback(
    (peerId: string, stream: MediaStream) => {
      const remote = remotesRef.current.get(peerId);
      const peerName = remote?.info.name || "???";
      setRemoteScreen({ peerId, name: peerName, stream });
      updatePlayer(peerId, { isSharingScreen: true });
    },
    [updatePlayer]
  );

  const clearRemoteScreen = useCallback(
    (peerId: string) => {
      setRemoteScreen((prev) => (prev?.peerId === peerId ? null : prev));
      updatePlayer(peerId, { isSharingScreen: false });
    },
    [updatePlayer]
  );

  const removePlayer = useCallback((peerId: string) => {
    setPlayers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    setSpeakingPeers((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });

    const remote = remotesRef.current.get(peerId);
    remotesRef.current.delete(peerId);
    remote?.audioMonitor?.stop();

    if (remote?.audioEl) {
      removeRemoteAudioElement(remote.audioEl, peerId);
    }
    try {
      remote?.audioCall?.close();
    } catch {
      /* already closed */
    }
    try {
      remote?.screenCall?.close();
    } catch {
      /* already closed */
    }
    try {
      remote?.conn?.close();
    } catch {
      /* already closed */
    }
    setRemoteScreen((prev) => (prev?.peerId === peerId ? null : prev));
  }, []);

  const setupAudioCall = useCallback(
    (call: MediaConnection) => {
      const remoteId = call.peer;
      let remote = remotesRef.current.get(remoteId);
      if (!remote) {
        remote = {
          info: {
            id: remoteId,
            name: "???",
            color: pickColor(remoteId.length),
          },
        };
        remotesRef.current.set(remoteId, remote);
      }

      if (remote.audioCall && remote.audioCall !== call && isMediaCallLive(remote.audioCall)) {
        try {
          call.close();
        } catch {
          /* duplicate glare call */
        }
        return;
      }

      remote.audioCall = call;
      watchRtcIce(call.peerConnection as RTCPeerConnection | undefined, () => {
        onIceFailureRef.current("media");
      });

      call.on("stream", (remoteStream) => {
        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length === 0) return;
        const localTrackId = localStreamRef.current?.getAudioTracks()[0]?.id;
        if (localTrackId && audioTracks.some((track) => track.id === localTrackId)) {
          return;
        }

        if (!remote!.audioEl) {
          remote!.audioEl = createRemoteAudioElement(remoteId);
        }
        attachRemoteAudioStream(remote!.audioEl, remoteStream);
        void playRemoteAudio(remote!.audioEl!);

        // Audio monitoring for remote speaking indicator
        remote!.audioMonitor?.stop();
        remote!.audioMonitor = monitorAudioStream(remoteStream, (speaking) => {
          setSpeakingPeers((prev) => {
            if (prev[remoteId] === speaking) return prev;
            return { ...prev, [remoteId]: speaking };
          });
        });
      });

      const clearIfCurrent = () => {
        if (remote!.audioCall === call) {
          remote!.audioCall = undefined;
          remote!.audioMonitor?.stop();
          setSpeakingPeers((prev) => {
            if (!prev[remoteId]) return prev;
            const next = { ...prev };
            delete next[remoteId];
            return next;
          });
        }
      };
      call.on("close", clearIfCurrent);
      call.on("error", clearIfCurrent);
    },
    []
  );

  const setupScreenReceiveCall = useCallback(
    (call: MediaConnection) => {
      const remoteId = call.peer;
      let remote = remotesRef.current.get(remoteId);
      if (!remote) {
        remote = {
          info: {
            id: remoteId,
            name: "???",
            color: pickColor(remoteId.length),
          },
        };
        remotesRef.current.set(remoteId, remote);
      }

      if (remote.screenCall && remote.screenCall !== call && isMediaCallLive(remote.screenCall)) {
        if (callHasLiveVideo(remote.screenCall)) {
          try {
            call.close();
          } catch {
            /* duplicate incoming screen call */
          }
          return;
        }
        try {
          remote.screenCall.close();
        } catch {
          /* replace stale call that has no video */
        }
      }

      remote.screenCall = call;

      const requestScreenAgain = () => {
        const current = remotesRef.current.get(remoteId);
        if (!current?.info.isSharingScreen) return;
        if (current.screenCall && callHasLiveVideo(current.screenCall)) return;
        const conn = current.conn;
        if (conn?.open) {
          conn.send({ type: "need-screen" } satisfies SignalingMessage);
        }
      };

      const onScreenCallLost = () => {
        if (remote!.screenCall === call) remote!.screenCall = undefined;
        const current = remotesRef.current.get(remoteId);
        if (!current?.info.isSharingScreen) {
          clearRemoteScreen(remoteId);
          return;
        }
        clearRemoteScreen(remoteId);
        requestScreenAgain();
      };

      call.on("stream", (remoteStream) => {
        const videoTracks = remoteStream.getVideoTracks();
        if (videoTracks.length === 0) return;
        attachRemoteScreen(remoteId, remoteStream);
        videoTracks.forEach((track) => {
          track.onended = () => {
            clearRemoteScreen(remoteId);
            requestScreenAgain();
          };
        });
      });

      watchRtcIce(call.peerConnection as RTCPeerConnection | undefined, () => {
        onIceFailureRef.current("media");
      });
      call.on("close", onScreenCallLost);
      call.on("error", onScreenCallLost);
    },
    [attachRemoteScreen, clearRemoteScreen]
  );

  const myPeerInfo = useCallback((): PeerInfo | null => {
    if (!myIdRef.current) return null;
    return {
      id: myIdRef.current,
      name: nameRef.current,
      color: myColorRef.current,
      isSharingScreen: Boolean(screenStreamRef.current),
    };
  }, []);

  const collectRoster = useCallback((): PeerInfo[] => {
    const seen = new Set<string>();
    const peers: PeerInfo[] = [];
    for (const remote of remotesRef.current.values()) {
      if (remote.info.name === "???" || remote.disconnectedAt) continue;
      if (remote.info.id === myIdRef.current || seen.has(remote.info.id)) continue;
      seen.add(remote.info.id);
      peers.push(remote.info);
    }
    const me = myPeerInfo();
    if (me && !seen.has(me.id)) peers.push(me);
    return peers;
  }, [myPeerInfo]);

  const applyRemotePeers = useCallback(
    (peers: PeerInfo[], authoritative = false) => {
      const ids = new Set(peers.map((p) => p.id));
      peers.forEach((p) => {
        if (p.id === myIdRef.current) return;
        const existing = remotesRef.current.get(p.id);
        if (!existing) {
          remotesRef.current.set(p.id, { info: p });
        } else {
          existing.info = { ...existing.info, ...p };
        }
        updatePlayer(p.id, { ...p, disconnected: false });
        if (!p.isSharingScreen) {
          clearRemoteScreen(p.id);
        }
        connectToPeerRef.current(p.id);
      });

      if (authoritative) {
        remotesRef.current.forEach((remote, peerId) => {
          if (!ids.has(peerId) && peerId !== roomHostIdRef.current) {
            removePlayer(peerId);
          }
        });
      }
    },
    [updatePlayer, removePlayer, clearRemoteScreen]
  );

  const requestScreenFrom = useCallback((peerId: string) => {
    const remote = remotesRef.current.get(peerId);
    if (!remote?.conn?.open) return;
    try {
      remote.conn.send({ type: "need-screen" } satisfies SignalingMessage);
    } catch {
      /* channel may not be ready */
    }
  }, []);

  const handleSignalingMessage = useCallback(
    (msg: SignalingMessage, fromConn?: DataConnection) => {
      switch (msg.type) {
        case "hello": {
          if (msg.peer.id === myIdRef.current) break;
          const firstHello =
            !remotesRef.current.has(msg.peer.id) ||
            remotesRef.current.get(msg.peer.id)?.info.name === "???";
          let remote = remotesRef.current.get(msg.peer.id);
          const wasDisconnected = Boolean(remote?.disconnectedAt);
          if (!remote) {
            remote = {
              info: msg.peer,
              lastHeardAt: Date.now(),
            };
            remotesRef.current.set(msg.peer.id, remote);
          } else {
            remote.info = msg.peer;
            remote.lastHeardAt = Date.now();
            remote.disconnectedAt = undefined;
          }
          updatePlayer(msg.peer.id, { ...msg.peer, disconnected: false });
          if (!msg.peer.isSharingScreen) {
            clearRemoteScreen(msg.peer.id);
          }
          connectToPeerRef.current(msg.peer.id);
          if (screenStreamRef.current && (firstHello || wasDisconnected)) {
            startScreenCallToPeerRef.current(msg.peer.id, true);
          }
          if (fromConn?.open && myIdRef.current) {
            const roster = collectRoster();
            try {
              fromConn.send({
                type: "welcome",
                peers: roster,
                hostId: hostIdRef.current ?? myIdRef.current,
              } satisfies SignalingMessage);
              fromConn.send({
                type: "roster",
                peers: roster,
                hostId: hostIdRef.current ?? myIdRef.current,
              } satisfies SignalingMessage);
            } catch {
              /* channel may not be ready yet */
            }
            if (screenStreamRef.current) {
              fromConn.send({
                type: "screen-share",
                peerId: myIdRef.current,
                isSharing: true,
              } satisfies SignalingMessage);
            }
          }
          if (isHostRef.current && myIdRef.current) {
            const roster = collectRoster();
            if (firstHello) {
              broadcast({ type: "peer-joined", peer: msg.peer });
            }
            broadcast({
              type: "roster",
              peers: roster,
              hostId: myIdRef.current,
            });
          }
          break;
        }
        case "welcome":
        case "roster": {
          hostIdRef.current = msg.hostId;
          const fromHost =
            fromConn?.peer === roomHostIdRef.current ||
            fromConn?.peer === msg.hostId;
          applyRemotePeers(msg.peers, fromHost);
          if (
            !isHostRef.current &&
            fromConn?.open &&
            (fromHost ||
              msg.peers.some((p) => p.id !== myIdRef.current))
          ) {
            markGuestConnectedRef.current();
          }
          msg.peers.forEach((p) => {
            if (p.id === myIdRef.current || !p.isSharingScreen) return;
            requestScreenFrom(p.id);
          });
          break;
        }
        case "peer-joined": {
          if (msg.peer.id === myIdRef.current) return;
          updatePlayer(msg.peer.id, { ...msg.peer, disconnected: false });
          connectToPeerRef.current(msg.peer.id);
          if (msg.peer.isSharingScreen) requestScreenFrom(msg.peer.id);
          if (screenStreamRef.current) {
            startScreenCallToPeerRef.current(msg.peer.id, true);
          }
          playJoinSound();
          break;
        }
        case "peer-left":
          if (msg.peerId === myIdRef.current) break;
          removePlayer(msg.peerId);
          playLeaveSound();
          if (isHostRef.current) {
            broadcast({ type: "peer-left", peerId: msg.peerId });
          }
          break;
        case "screen-share": {
          const remote = remotesRef.current.get(msg.peerId);
          if (remote) {
            remote.info = { ...remote.info, isSharingScreen: msg.isSharing };
          }
          updatePlayer(msg.peerId, { isSharingScreen: msg.isSharing });
          if (!msg.isSharing) {
            clearRemoteScreen(msg.peerId);
            try {
              remote?.screenCall?.close();
            } catch {
              /* already closed */
            }
            if (remote) remote.screenCall = undefined;
          } else if (msg.peerId !== myIdRef.current) {
            requestScreenFrom(msg.peerId);
          }
          break;
        }
        case "need-screen":
          if (screenStreamRef.current && fromConn) {
            startScreenCallToPeerRef.current(fromConn.peer, true);
          }
          break;
        case "need-relay":
          switchToRelayRef.current();
          break;
        case "chat":
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.message.id)) return prev;
            return [...prev, msg.message];
          });
          if (msg.message.senderId !== myIdRef.current) {
            playMessageSound();
          }
          break;
        case "profile-update": {
          const remote = remotesRef.current.get(msg.peerId);
          if (remote) {
            remote.info = { ...remote.info, name: msg.name, color: msg.color };
          }
          updatePlayer(msg.peerId, { name: msg.name, color: msg.color });
          break;
        }
      }
    },
    [broadcast, updatePlayer, removePlayer, clearRemoteScreen, collectRoster, applyRemotePeers, requestScreenFrom]
  );

  const setupDataConnection = useCallback(
    (conn: DataConnection) => {
      const remoteId = conn.peer;
      let remote = remotesRef.current.get(remoteId);
      if (!remote) {
        remote = {
          info: {
            id: remoteId,
            name: "???",
            color: pickColor(remoteId.length),
          },
        };
        remotesRef.current.set(remoteId, remote);
      }
      remote.conn = conn;
      remote.connStartedAt = Date.now();

      watchRtcIce(conn.peerConnection as RTCPeerConnection | undefined, () => {
        onIceFailureRef.current("data");
      });

      const sendHello = () => {
        const me = myPeerInfo();
        if (!me || !conn.open) return;
        try {
          conn.send({ type: "hello", peer: me } satisfies SignalingMessage);
        } catch {
          /* channel may not be ready yet */
        }
      };

      const sendRoster = () => {
        if (!conn.open || !myIdRef.current) return;
        try {
          conn.send({
            type: "roster",
            peers: collectRoster(),
            hostId: hostIdRef.current ?? myIdRef.current,
          } satisfies SignalingMessage);
        } catch {
          /* channel may not be ready yet */
        }
      };

      conn.on("open", () => {
        remote.disconnectedAt = undefined;
        remote.lastHeardAt = Date.now();
        updatePlayer(remoteId, { disconnected: false });
        if (!isHostRef.current && conn.peer === roomHostIdRef.current) {
          markGuestConnectedRef.current();
        } else if (isHostRef.current && conn.peer === roomHostIdRef.current) {
          stopHostConnectRetryRef.current();
          setConnectionStatus("connected");
          setError((prev) =>
            prev?.startsWith("เชื่อมต่อไม่สำเร็จ") ? null : prev
          );
          if (!hasPlayedJoinSoundRef.current) {
            hasPlayedJoinSoundRef.current = true;
            playJoinSound();
          }
        }
        sendHello();
        sendRoster();
        if (screenStreamRef.current) {
          startScreenCallToPeerRef.current(remoteId, true);
        }
        if (remote.info.isSharingScreen) {
          try {
            conn.send({ type: "need-screen" } satisfies SignalingMessage);
          } catch {
            /* channel may not be ready */
          }
        }
        window.setTimeout(sendHello, 200);
        window.setTimeout(sendRoster, 200);
        window.setTimeout(sendHello, 800);
        window.setTimeout(sendRoster, 800);
      });

      conn.on("data", (data) => {
        handleSignalingMessage(data as SignalingMessage, conn);
      });

      const onDataLost = () => {
        if (remotesRef.current.get(remoteId) !== remote) return;
        if (remote.conn && remote.conn !== conn) return;
        if (remote.conn === conn) remote.conn = undefined;
        if (!remote.disconnectedAt) remote.disconnectedAt = Date.now();
        updatePlayer(remoteId, { disconnected: true });
        if (remoteId === roomHostIdRef.current) {
          setConnectionStatus((prev) =>
            prev === "failed" ? prev : "reconnecting"
          );
          startHostConnectRetryRef.current();
        }
        window.setTimeout(() => {
          if (remotesRef.current.get(remoteId) !== remote) return;
          connectToPeerRef.current(remoteId);
        }, DATA_RECONNECT_DELAY_MS);
      };

      conn.on("error", onDataLost);
      conn.on("close", onDataLost);

      if (conn.open) {
        remote.disconnectedAt = undefined;
        sendHello();
        sendRoster();
      }
    },
    [handleSignalingMessage, collectRoster, myPeerInfo, updatePlayer]
  );

  const startScreenCallToPeer = useCallback((remoteId: string, force = false) => {
    const peer = peerRef.current;
    const screenStream = screenStreamRef.current;
    if (!peer || !screenStream) return;

    const remote = remotesRef.current.get(remoteId);
    if (!remote) return;
    if (!force && isMediaCallLive(remote.screenCall)) return;

    remote.screenCall?.close();
    const call = peer.call(remoteId, screenStream, { metadata: SCREEN_CALL_META });
    if (!call) return;

    remote.screenCall = call;
    constrainScreenSenders(call.peerConnection as RTCPeerConnection | undefined);
    watchRtcIce(call.peerConnection as RTCPeerConnection | undefined, () => {
      onIceFailureRef.current("media");
    });
    call.on("close", () => {
      if (remote.screenCall === call) remote.screenCall = undefined;
    });
    call.on("error", () => {
      if (remote.screenCall === call) remote.screenCall = undefined;
    });
  }, []);

  const startScreenCallsToAll = useCallback(() => {
    remotesRef.current.forEach((remote) => {
      startScreenCallToPeer(remote.info.id);
    });
  }, [startScreenCallToPeer]);

  const connectToPeer = useCallback(
    (remoteId: string) => {
      if (!peerRef.current || remoteId === myIdRef.current) return;
      const peer = peerRef.current;
      const remote = remotesRef.current.get(remoteId);

      if (!isConnInFlight(remote?.conn, remote?.connStartedAt)) {
        if (remote?.conn && !remote.conn.open) {
          try {
            remote.conn.close();
          } catch {
            /* already closed */
          }
          remote.conn = undefined;
        }
        setupDataConnection(peer.connect(remoteId, CONNECT_OPTIONS));
      }
      if (localStreamRef.current && !isMediaCallLive(remote?.audioCall) && shouldOfferAudio(myIdRef.current, remoteId)) {
        const call = peer.call(remoteId, localStreamRef.current);
        if (call) setupAudioCall(call);
      }
      if (screenStreamRef.current && !isMediaCallLive(remote?.screenCall)) {
        startScreenCallToPeer(remoteId, true);
      }
    },
    [setupDataConnection, setupAudioCall, startScreenCallToPeer]
  );

  const announceJoin = useCallback((peerId: string) => {
    setPlayers((prev) => ({
      ...prev,
      [peerId]: {
        id: peerId,
        name: nameRef.current,
        color: myColorRef.current,
        isSharingScreen: Boolean(screenStreamRef.current),
      },
    }));
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    remotesRef.current.forEach((remote) => {
      remote.screenCall?.close();
      remote.screenCall = undefined;
    });

    setIsSharing(false);
    setLocalScreen(null);
    if (myIdRef.current) {
      broadcast({
        type: "screen-share",
        peerId: myIdRef.current,
        isSharing: false,
      });
      updatePlayer(myIdRef.current, { isSharingScreen: false });
    }
  }, [broadcast, updatePlayer]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 24 },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
        },
        audio: false,
      });
      screenStreamRef.current = screenStream;
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.contentHint = "detail";
        videoTrack.onended = () => stopScreenShareRef.current();
      }

      startScreenCallsToAll();

      setLocalScreen(screenStream);
      setIsSharing(true);
      if (myIdRef.current) {
        broadcast({
          type: "screen-share",
          peerId: myIdRef.current,
          isSharing: true,
        });
        updatePlayer(myIdRef.current, { isSharingScreen: true });
      }
    } catch {
      setError(
        "ไม่สามารถแชร์หน้าจอได้ — กรุณาอนุญาตการแชร์หน้าจอ / Screen share denied. Please allow screen sharing."
      );
    }
  }, [broadcast, startScreenCallsToAll, updatePlayer]);

  useEffect(() => {
    setupDataConnectionRef.current = setupDataConnection;
    setupScreenReceiveCallRef.current = setupScreenReceiveCall;
    connectToPeerRef.current = connectToPeer;
    stopScreenShareRef.current = stopScreenShare;
    startScreenCallToPeerRef.current = startScreenCallToPeer;
    removePlayerRef.current = removePlayer;
    onIceFailureRef.current = (kind) => {
      if (kind === "media") {
        remotesRef.current.forEach((remote) => {
          if (screenStreamRef.current && !isMediaCallLive(remote.screenCall)) {
            startScreenCallToPeerRef.current(remote.info.id, true);
          }
          if (
            remote.info.isSharingScreen &&
            !isMediaCallLive(remote.screenCall) &&
            remote.conn?.open
          ) {
            try {
              remote.conn.send({ type: "need-screen" } satisfies SignalingMessage);
            } catch {
              /* channel may not be ready */
            }
          }
        });
        return;
      }
      if (forceRelayRef.current || switchingRelayRef.current) return;
      const remotes = Array.from(remotesRef.current.values());
      if (remotes.length === 0) return;
      const hasHealthyData = remotes.some((remote) => {
        const pc = remote.conn?.peerConnection as RTCPeerConnection | undefined;
        return Boolean(remote.conn?.open && isRtcHealthy(pc));
      });
      if (hasHealthyData) return;
      switchToRelayRef.current();
    };
  });

  const markGuestSignalingConnected = useCallback(() => {
    if (isHostRef.current) return;
    hostMissCountRef.current = 0;
    stopHostConnectRetryRef.current();
    stopHostTakeoverProbeRef.current();
    setConnectionStatus((prev) => (prev === "connected" ? prev : "connected"));
    setError((prev) =>
      prev?.startsWith("เชื่อมต่อไม่สำเร็จ") ? null : prev
    );
    if (!hasPlayedJoinSoundRef.current) {
      hasPlayedJoinSoundRef.current = true;
      playJoinSound();
    }
  }, []);

  const stopHostTakeoverProbe = useCallback(() => {
    if (hostTakeoverTimerRef.current) {
      clearInterval(hostTakeoverTimerRef.current);
      hostTakeoverTimerRef.current = null;
    }
  }, []);

  const startHostTakeoverProbe = useCallback(() => {
    if (hostTakeoverTimerRef.current || isHostRef.current) return;
    hostTakeoverTimerRef.current = setInterval(() => {
      if (isHostRef.current || !peerRef.current) {
        stopHostTakeoverProbe();
        return;
      }
      const hostConn = remotesRef.current.get(roomHostIdRef.current);
      if (hostConn?.conn?.open) {
        stopHostTakeoverProbe();
        return;
      }
      if (!takeoverInFlightRef.current) {
        tryTakeoverRef.current();
      }
    }, HOST_TAKEOVER_PROBE_MS);
  }, [stopHostTakeoverProbe]);

  useEffect(() => {
    markGuestConnectedRef.current = markGuestSignalingConnected;
    stopHostTakeoverProbeRef.current = stopHostTakeoverProbe;
    startHostTakeoverProbeRef.current = startHostTakeoverProbe;
  });

  const startHostConnectRetry = useCallback(() => {
    if (hostConnectTimerRef.current) return;

    let attempts = 0;
    hostConnectTimerRef.current = setInterval(() => {
      if (!peerRef.current || isHostRef.current) {
        if (hostConnectTimerRef.current) {
          clearInterval(hostConnectTimerRef.current);
          hostConnectTimerRef.current = null;
        }
        return;
      }

      const hostConn = remotesRef.current.get(roomHostIdRef.current);
      if (hostConn?.conn?.open) {
        if (hostConnectTimerRef.current) {
          clearInterval(hostConnectTimerRef.current);
          hostConnectTimerRef.current = null;
        }
        setError((prev) =>
          prev?.startsWith("เชื่อมต่อไม่สำเร็จ") ? null : prev
        );
        return;
      }

      attempts += 1;
      const takeoverAfter = isIosDevice() ? 15 : 8;
      if (attempts === RELAY_FALLBACK_AFTER && !forceRelayRef.current) {
        switchToRelayRef.current();
        return;
      }
      if (
        attempts === HOST_TAKEOVER_RETRY_AFTER ||
        attempts === takeoverAfter ||
        (attempts > takeoverAfter && attempts % 4 === 0)
      ) {
        if (!takeoverInFlightRef.current) {
          tryTakeoverRef.current();
        }
      }
      const hostRemote = remotesRef.current.get(roomHostIdRef.current);
      if (
        hostRemote?.conn &&
        !hostRemote.conn.open &&
        hostRemote.connStartedAt &&
        Date.now() - hostRemote.connStartedAt > STUCK_CONN_MS
      ) {
        try {
          hostRemote.conn.close();
        } catch {
          /* already closed */
        }
        hostRemote.conn = undefined;
      }
      connectToPeerRef.current(roomHostIdRef.current);

      if (attempts >= HOST_CONNECT_MAX_ATTEMPTS) {
        if (hostConnectTimerRef.current) {
          clearInterval(hostConnectTimerRef.current);
          hostConnectTimerRef.current = null;
        }
        setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
        setConnectionStatus("failed");
      }
    }, HOST_CONNECT_INTERVAL_MS);
  }, []);

  const stopHostConnectRetry = useCallback(() => {
    if (hostConnectTimerRef.current) {
      clearInterval(hostConnectTimerRef.current);
      hostConnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopHostConnectRetryRef.current = stopHostConnectRetry;
    startHostConnectRetryRef.current = startHostConnectRetry;
  });

  useEffect(() => {
    if (!enabled || !name) return;

    let destroyed = false;
    const remotes = remotesRef.current;
    const roomSession = ensureRoomSession(roomId);
    const guestScope = getGuestScope(roomId, roomSession);
    roomHostIdRef.current = getRoomHostId(roomId, roomSession);
    const roomHostId = roomHostIdRef.current;
    forceRelayRef.current = false;
    switchingRelayRef.current = false;
    const reclaimHostId = isHostRef.current;
    isHostRef.current = false;
    myIdRef.current = null;
    hasPlayedJoinSoundRef.current = false;
    hostMissCountRef.current = 0;
    takeoverInFlightRef.current = false;

    let session = 0;
    let relayTimer: ReturnType<typeof setTimeout> | null = null;

    function peerOptions() {
      return getPeerOptions(forceRelayRef.current);
    }

    function dropAllRemotes() {
      remotesRef.current.forEach((remote) => {
        remote.conn?.close();
        remote.audioCall?.close();
        remote.screenCall?.close();
        remote.audioMonitor?.stop();
        remote.audioEl?.remove();
      });
      remotesRef.current.clear();
      setSpeakingPeers({});
    }

    function attachPeerHandlers(peer: Peer) {
      peer.on("connection", (conn) => setupDataConnectionRef.current(conn));

      peer.on("call", (call) => {
        const meta = call.metadata as { type?: string } | undefined;
        const answerStream =
          getMicTrack(localStreamRef.current) ?? new MediaStream();

        if (meta?.type === "screen") {
          call.answer(new MediaStream());
          setupScreenReceiveCallRef.current(call);
          return;
        }

        call.answer(answerStream);
        setupAudioCall(call);
      });

      peer.on("disconnected", () => {
        if (destroyed || !peer.id) return;
        setConnectionStatus("reconnecting");
        try {
          peer.reconnect();
        } catch {
          /* PeerJS reconnect can throw if already destroyed */
        }
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
        const missing = unavailablePeerId(err);
        if (missing) {
          removePlayerRef.current(missing);
          if (missing === roomHostId && !isHostRef.current) {
            hostMissCountRef.current += 1;
            if (
              hostMissCountRef.current >= HOST_PEER_UNAVAILABLE_TAKEOVER &&
              !takeoverInFlightRef.current
            ) {
              hostMissCountRef.current = 0;
              tryTakeoverRef.current();
            }
            startHostConnectRetryRef.current();
            startHostTakeoverProbeRef.current();
          }
          return;
        }

        if (isTransientPeerError(err)) return;

        if (err.type === "unavailable-id") {
          if (!isHostRef.current) {
            rotateGuestPeerId(roomId, guestScope);
            openGuestPeer();
          }
          return;
        }

        if (err.type === "network" || err.type === "server-error") {
          if (!forceRelayRef.current) {
            switchToRelayRef.current();
            return;
          }
        }

        setError(
          `เชื่อมต่อเครือข่ายไม่สำเร็จ (${err.type || "unknown"}) / Connection error. กำลังลองใหม่...`
        );
        setConnectionStatus("failed");
      });
    }

    function clearRoomHostStub() {
      const stubId = roomHostIdRef.current;
      const stub = remotesRef.current.get(stubId);
      if (!stub) return;
      try {
        stub.conn?.close();
      } catch {
        /* already closed */
      }
      remotesRef.current.delete(stubId);
      if (!isHostRef.current || myIdRef.current !== stubId) {
        removePlayerRef.current(stubId);
      }
    }

    function onPeerReady(peer: Peer, peerIsHost: boolean) {
      if (destroyed) {
        peer.destroy();
        return;
      }
      peerRef.current = peer;
      myIdRef.current = peer.id;
      setMyId(peer.id);
      setIsHost(peerIsHost);
      isHostRef.current = peerIsHost;
      hostIdRef.current = peerIsHost ? peer.id : roomHostId;

      if (peerIsHost) {
        clearRoomHostStub();
      }

      announceJoin(peer.id);

      if (peerIsHost) {
        stopHostConnectRetryRef.current();
        stopHostTakeoverProbeRef.current();
        setConnectionStatus("connected");
        setConnected(true);
        if (!hasPlayedJoinSoundRef.current) {
          hasPlayedJoinSoundRef.current = true;
          playJoinSound();
        }
      } else {
        setConnected(true);
        setConnectionStatus("connecting");
        connectToPeerRef.current(roomHostId);
        startHostConnectRetryRef.current();
        startHostTakeoverProbeRef.current();
      }
    }

    function openGuestPeer() {
      if (destroyed) return;
      session += 1;
      const currentSession = session;
      const guestId = makeGuestPeerId(roomId, guestScope);
      const guestPeer = new Peer(guestId, peerOptions());

      guestPeer.on("open", () => {
        if (destroyed || session !== currentSession) {
          guestPeer.destroy();
          return;
        }
        onPeerReady(guestPeer, false);
      });

      guestPeer.on("error", (err) => {
        if (destroyed || session !== currentSession) return;
        if (err.type === "unavailable-id") {
          rotateGuestPeerId(roomId, guestScope);
          openGuestPeer();
        }
      });

      attachPeerHandlers(guestPeer);
    }

    function openHostPeer() {
      if (destroyed) return;
      session += 1;
      const currentSession = session;
      const hostPeer = new Peer(roomHostId, peerOptions());

      hostPeer.on("open", () => {
        if (destroyed || session !== currentSession) {
          hostPeer.destroy();
          return;
        }
        onPeerReady(hostPeer, true);
      });

      hostPeer.on("error", (err) => {
        if (destroyed || session !== currentSession) return;
        if (err.type === "unavailable-id") {
          try {
            hostPeer.destroy();
          } catch {
            /* already closing */
          }
          openGuestPeer();
          startHostTakeoverProbeRef.current();
        }
      });

      attachPeerHandlers(hostPeer);
    }

    function tryTakeoverHost() {
      if (destroyed || isHostRef.current || takeoverInFlightRef.current) return;
      takeoverInFlightRef.current = true;
      session += 1;
      const currentSession = session;
      const takeoverPeer = new Peer(roomHostId, peerOptions());

      takeoverPeer.on("open", () => {
        takeoverInFlightRef.current = false;
        if (destroyed || session !== currentSession) {
          takeoverPeer.destroy();
          return;
        }
        stopHostConnectRetryRef.current();
        stopHostTakeoverProbeRef.current();
        try {
          peerRef.current?.destroy();
        } catch {
          /* already closing */
        }
        clearRoomHostStub();
        onPeerReady(takeoverPeer, true);
        remotesRef.current.forEach((remote) => {
          connectToPeerRef.current(remote.info.id);
        });
      });

      takeoverPeer.on("error", (err) => {
        takeoverInFlightRef.current = false;
        if (destroyed || session !== currentSession) return;
        try {
          takeoverPeer.destroy();
        } catch {
          /* already closing */
        }
        if (err.type === "unavailable-id") {
          startHostConnectRetryRef.current();
          startHostTakeoverProbeRef.current();
        }
      });

      attachPeerHandlers(takeoverPeer);
    }

    function switchToRelayAndRejoin() {
      if (destroyed || switchingRelayRef.current) return;
      switchingRelayRef.current = true;
      forceRelayRef.current = true;
      setConnectionQuality("relay");
      stopHostConnectRetryRef.current();
      broadcast({ type: "need-relay" });

      const wasHost = isHostRef.current;
      dropAllRemotes();

      try {
        peerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      peerRef.current = null;

      if (relayTimer) clearTimeout(relayTimer);
      relayTimer = setTimeout(() => {
        switchingRelayRef.current = false;
        if (destroyed) return;
        if (wasHost) openHostPeer();
        else openGuestPeer();
      }, RELAY_RECREATE_DELAY_MS);
    }

    tryTakeoverRef.current = tryTakeoverHost;
    switchToRelayRef.current = switchToRelayAndRejoin;

    function announceLeave() {
      const me = myIdRef.current;
      if (!me) return;
      remotesRef.current.forEach((remote) => {
        if (!remote.conn?.open) return;
        try {
          remote.conn.send({ type: "peer-left", peerId: me } satisfies SignalingMessage);
        } catch {
          /* already closing */
        }
      });
    }

    window.addEventListener("pagehide", announceLeave);
    window.addEventListener("beforeunload", announceLeave);

    const url = new URL(window.location.href);
    if (url.searchParams.has("host")) {
      url.searchParams.delete("host");
      window.history.replaceState({}, "", url.toString());
    }

    // Wait for getUserMedia before opening PeerJS
    void getMicStream()
      .then((stream) => {
        if (destroyed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;

        // Monitor local microphone speaking activity
        localMonitorRef.current?.stop();
        localMonitorRef.current = monitorAudioStream(stream, (speaking) => {
          const active = !isMutedRef.current && speaking;
          const me = myIdRef.current;
          if (me) {
            setSpeakingPeers((prev) => {
              if (prev[me] === active) return prev;
              return { ...prev, [me]: active };
            });
          }
        });

        remotesRef.current.forEach((remote) => {
          connectToPeerRef.current(remote.info.id);
        });
      })
      .catch(() => {
        if (!destroyed) {
          setError(
            "ไม่สามารถใช้ไมค์ได้ — กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์ / Microphone access denied. Please allow mic permission."
          );
        }
      })
      .finally(() => {
        if (destroyed) return;
        if (isIosDevice() && !reclaimHostId) openGuestPeer();
        else openHostPeer();
      });

    return () => {
      destroyed = true;
      switchingRelayRef.current = false;
      window.removeEventListener("pagehide", announceLeave);
      window.removeEventListener("beforeunload", announceLeave);
      if (relayTimer) clearTimeout(relayTimer);
      stopHostConnectRetry();
      stopHostTakeoverProbe();
      announceLeave();
      localMonitorRef.current?.stop();
      remotes.forEach((remote) => {
        remote.conn?.close();
        remote.audioCall?.close();
        remote.screenCall?.close();
        remote.audioMonitor?.stop();
        remote.audioEl?.remove();
      });
      remotes.clear();
      setSpeakingPeers({});
      setLocalScreen(null);
      setIsSharing(false);
      setConnected(false);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [
    enabled,
    name,
    roomId,
    retryNonce,
    announceJoin,
    setupAudioCall,
    startHostConnectRetry,
    stopHostConnectRetry,
    stopHostTakeoverProbe,
    broadcast,
    updatePlayer,
  ]);

  useEffect(() => {
    if (!enabled || !connected) return;
    const tick = () => {
      const me = myPeerInfo();
      if (!me) return;
      remotesRef.current.forEach((remote) => {
        if (!remote.conn?.open) return;
        try {
          remote.conn.send({ type: "hello", peer: me } satisfies SignalingMessage);
        } catch {
          /* channel may not be ready */
        }
      });
      if (isHostRef.current) {
        broadcast({
          type: "roster",
          peers: collectRoster(),
          hostId: me.id,
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [enabled, connected, broadcast, collectRoster, myPeerInfo]);

  useEffect(() => {
    if (!enabled || !isSharing) return;
    const id = window.setInterval(() => {
      remotesRef.current.forEach((remote) => {
        if (!isMediaCallLive(remote.screenCall)) {
          startScreenCallToPeer(remote.info.id, true);
        }
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [enabled, isSharing, startScreenCallToPeer]);

  useEffect(() => {
    if (!enabled || !connected) return;
    const id = window.setInterval(() => {
      const me = myIdRef.current;
      if (!me) return;
      Object.values(players).forEach((p) => {
        if (p.id === me) return;
        if (!p.isSharingScreen) {
          if (remoteScreen?.peerId === p.id) {
            clearRemoteScreen(p.id);
          }
          return;
        }
        const screenCall = remotesRef.current.get(p.id)?.screenCall;
        if (remoteScreen?.peerId === p.id && callHasLiveVideo(screenCall)) {
          return;
        }
        if (remoteScreen?.peerId === p.id && !callHasLiveVideo(screenCall)) {
          clearRemoteScreen(p.id);
        }
        const conn = remotesRef.current.get(p.id)?.conn;
        if (!conn?.open) {
          connectToPeerRef.current(p.id);
          return;
        }
        conn.send({ type: "need-screen" } satisfies SignalingMessage);
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [enabled, connected, players, remoteScreen, clearRemoteScreen]);

  useEffect(() => {
    if (!enabled || !connected) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      remotesRef.current.forEach((remote) => {
        const peerId = remote.info.id;
        if (remote.conn?.open) {
          const heard = remote.lastHeardAt ?? remote.connStartedAt ?? 0;
          if (heard && Date.now() - heard >= STALE_PEER_MS) {
            if (isHostRef.current) {
              broadcast({ type: "peer-left", peerId });
            }
            removePlayer(peerId);
            return;
          }
          if (remote.disconnectedAt) {
            remote.disconnectedAt = undefined;
            updatePlayer(peerId, { disconnected: false });
          }
          return;
        }
        if (
          remote.disconnectedAt &&
          now - remote.disconnectedAt >= PEER_LEAVE_GRACE_MS
        ) {
          if (isHostRef.current) {
            broadcast({ type: "peer-left", peerId });
          }
          removePlayer(peerId);
          return;
        }
        connectToPeerRef.current(peerId);
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [enabled, connected, broadcast, removePlayer, updatePlayer]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      if (forceRelayRef.current) {
        if (!cancelled) setConnectionQuality("relay");
        return;
      }
      const samples: Array<{ candidateType: string; rtt?: number } | null> = [];
      for (const remote of remotesRef.current.values()) {
        samples.push(
          await inspectIceQuality(
            remote.conn?.peerConnection as RTCPeerConnection | undefined
          )
        );
        samples.push(
          await inspectIceQuality(
            remote.screenCall?.peerConnection as RTCPeerConnection | undefined
          )
        );
      }
      if (!cancelled) {
        setConnectionQuality(qualityFromIce(samples, forceRelayRef.current));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, connected, connectionStatus]);

  useEffect(() => {
    if (!enabled || !connected) return;
    const id = window.setInterval(() => {
      const me = myIdRef.current;
      const mic = localStreamRef.current;
      const peer = peerRef.current;
      if (!me || !mic || !peer) return;
      remotesRef.current.forEach((remote) => {
        if (isMediaCallLive(remote.audioCall)) return;
        const waitedLongEnough = Date.now() - (remote.connStartedAt ?? 0) > 8000;
        if (!shouldOfferAudio(me, remote.info.id) && !waitedLongEnough) return;
        const call = peer.call(remote.info.id, mic);
        if (call) setupAudioCall(call);
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, [enabled, connected, setupAudioCall]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const newMuted = !track.enabled;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    if (newMuted) {
      playMuteSound();
      if (myIdRef.current) {
        setSpeakingPeers((prev) => ({ ...prev, [myIdRef.current!]: false }));
      }
    } else {
      playUnmuteSound();
    }

    void unlockAllRemoteAudio();
  }, []);

  const unlockAudio = useCallback(() => {
    void unlockAllRemoteAudio();
  }, []);

  const getShareUrl = useCallback(() => buildShareUrl(roomId), [roomId]);

  const retryConnection = useCallback(() => {
    setError(null);
    setConnectionStatus("connecting");
    setConnectionQuality("fair");
    setConnected(false);
    setIsHost(false);
    setMyId(null);
    setRetryNonce((n) => n + 1);
  }, []);

  const sendChatMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !myIdRef.current) return;
      const message: ChatMessage = {
        id: `${myIdRef.current}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: myIdRef.current,
        senderName: nameRef.current,
        senderColor: myColorRef.current,
        text: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, message]);
      broadcast({ type: "chat", message });
    },
    [broadcast]
  );

  const setUserVolume = useCallback((peerId: string, volume: number) => {
    setAudioPeerVolume(peerId, volume);
    setUserVolumes((prev) => ({ ...prev, [peerId]: volume }));
  }, []);

  const switchMicrophone = useCallback(async (deviceId: string) => {
    try {
      const newStream = await getMicStream(deviceId);
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return false;

      localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
      localStreamRef.current = newStream;
      newTrack.enabled = !isMutedRef.current;

      remotesRef.current.forEach((remote) => {
        const pc = remote.audioCall?.peerConnection as RTCPeerConnection | undefined;
        if (pc) {
          const senders = pc.getSenders();
          const audioSender = senders.find((s) => s.track?.kind === "audio");
          if (audioSender) {
            void audioSender.replaceTrack(newTrack).catch(() => {});
          }
        }
      });

      localMonitorRef.current?.stop();
      localMonitorRef.current = monitorAudioStream(newStream, (speaking) => {
        const active = !isMutedRef.current && speaking;
        const me = myIdRef.current;
        if (me) {
          setSpeakingPeers((prev) => {
            if (prev[me] === active) return prev;
            return { ...prev, [me]: active };
          });
        }
      });

      return true;
    } catch {
      return false;
    }
  }, []);

  const updateProfile = useCallback(
    (newName: string, newColor: string) => {
      const trimmed = newName.trim();
      if (trimmed) nameRef.current = trimmed;
      if (newColor) myColorRef.current = newColor;
      if (myIdRef.current) {
        updatePlayer(myIdRef.current, {
          name: nameRef.current,
          color: myColorRef.current,
        });
        broadcast({
          type: "profile-update",
          peerId: myIdRef.current,
          name: nameRef.current,
          color: myColorRef.current,
        });
      }
    },
    [broadcast, updatePlayer]
  );

  return {
    myId,
    myPlayer: myId ? players[myId] : null,
    players: Object.values(players).filter(
      (p) => p.id === myId || !p.disconnected
    ),
    connected,
    connectionStatus,
    connectionQuality,
    error,
    isMuted,
    isSharing,
    isHost,
    remoteScreen,
    localScreen,
    messages,
    speakingPeers,
    userVolumes,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    getShareUrl,
    unlockAudio,
    retryConnection,
    sendChatMessage,
    setUserVolume,
    switchMicrophone,
    updateProfile,
    roomId,
  };
}
