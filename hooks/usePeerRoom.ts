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
} from "@/lib/audio";
import {
  CONNECT_OPTIONS,
  SCREEN_CALL_META,
  constrainScreenSenders,
  getPeerOptions,
  isMediaCallLive,
  isTransientPeerError,
  makeGuestPeerId,
  isIosDevice,
  watchRtcIce,
} from "@/lib/peerConfig";
import { pickColor } from "@/lib/colors";
import { getRoomHostId, getShareUrl as buildShareUrl } from "@/lib/rooms";
import type { PeerInfo, PlayerState, SignalingMessage } from "@/lib/types";

const HOST_CONNECT_MAX_ATTEMPTS = 24;
const HOST_CONNECT_INTERVAL_MS = 1500;
const RELAY_FALLBACK_AFTER = 10;
const RELAY_RECREATE_DELAY_MS = 1000;

function isConnInFlight(conn?: DataConnection, startedAt?: number) {
  if (!conn) return false;
  if (conn.open) return true;
  if (startedAt && Date.now() - startedAt > 6000) return false;
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
  audioCall?: MediaConnection;
  screenCall?: MediaConnection;
  audioEl?: HTMLAudioElement;
}

interface UsePeerRoomOptions {
  name: string;
  roomId: string;
  enabled: boolean;
}

export function usePeerRoom({ name, roomId, enabled }: UsePeerRoomOptions) {
  const roomHostIdRef = useRef(getRoomHostId(roomId));
  const [myId, setMyId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [remoteScreen, setRemoteScreen] = useState<{
    peerId: string;
    name: string;
    stream: MediaStream;
  } | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remotesRef = useRef<Map<string, RemotePeer>>(new Map());
  const myColorRef = useRef("");
  const positionRef = useRef({ x: 0, y: 0 });
  const hostIdRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const myIdRef = useRef<string | null>(null);
  const nameRef = useRef(name);
  const connectToPeerRef = useRef<(remoteId: string) => void>(() => {});
  const stopScreenShareRef = useRef<() => void>(() => {});
  const startScreenCallToPeerRef = useRef<(remoteId: string, force?: boolean) => void>(
    () => {}
  );
  const hostConnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopHostConnectRetryRef = useRef<() => void>(() => {});
  const tryTakeoverRef = useRef<() => void>(() => {});
  const forceRelayRef = useRef(false);
  const switchingRelayRef = useRef(false);
  const switchToRelayRef = useRef<() => void>(() => {});
  const onIceFailureRef = useRef<(kind: "data" | "media") => void>(() => {});

  useEffect(() => {
    nameRef.current = name;
    if (!myColorRef.current) {
      myColorRef.current = pickColor(Math.floor(Math.random() * 8));
    }
  }, [name]);

  const broadcast = useCallback((msg: SignalingMessage) => {
    remotesRef.current.forEach((remote) => {
      if (remote.conn?.open) remote.conn.send(msg);
    });
  }, []);

  const updatePlayer = useCallback((peerId: string, patch: Partial<PlayerState>) => {
    setPlayers((prev) => {
      const existing = prev[peerId];
      if (!existing && !patch.id) return prev;
      const next = { ...existing, ...patch, id: peerId } as PlayerState;
      if (
        existing &&
        existing.name === next.name &&
        existing.color === next.color &&
        existing.x === next.x &&
        existing.y === next.y &&
        existing.isSharingScreen === next.isSharingScreen
      ) {
        return prev;
      }
      return {
        ...prev,
        [peerId]: next,
      };
    });
  }, []);

  const getRemoteName = useCallback((peerId: string) => {
    const remote = remotesRef.current.get(peerId);
    return remote?.info.name ?? "???";
  }, []);

  const attachRemoteScreen = useCallback(
    (peerId: string, stream: MediaStream) => {
      setRemoteScreen((prev) => {
        const trackId = stream.getVideoTracks()[0]?.id;
        const prevTrackId = prev?.stream.getVideoTracks()[0]?.id;
        if (prev?.peerId === peerId && (prev.stream === stream || prevTrackId === trackId)) {
          return prev.name === getRemoteName(peerId)
            ? prev
            : { ...prev, name: getRemoteName(peerId) };
        }
        return {
          peerId,
          name: getRemoteName(peerId),
          stream,
        };
      });
      updatePlayer(peerId, { isSharingScreen: true });
    },
    [getRemoteName, updatePlayer]
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
    const remote = remotesRef.current.get(peerId);
    if (remote?.audioEl) {
      removeRemoteAudioElement(remote.audioEl);
    }
    remote?.audioCall?.close();
    remote?.screenCall?.close();
    remote?.conn?.close();
    remotesRef.current.delete(peerId);
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
            x: 0,
            y: 0,
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
          remote!.audioEl = createRemoteAudioElement();
        }
        attachRemoteAudioStream(remote!.audioEl, remoteStream);
        void playRemoteAudio(remote!.audioEl!);
      });

      const clearIfCurrent = () => {
        if (remote!.audioCall === call) remote!.audioCall = undefined;
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
            x: 0,
            y: 0,
          },
        };
        remotesRef.current.set(remoteId, remote);
      }

      if (remote.screenCall && remote.screenCall !== call && isMediaCallLive(remote.screenCall)) {
        try {
          call.close();
        } catch {
          /* duplicate incoming screen call */
        }
        return;
      }

      remote.screenCall = call;

      const requestScreenAgain = () => {
        const current = remotesRef.current.get(remoteId);
        if (current?.screenCall && isMediaCallLive(current.screenCall)) return;
        const conn = current?.conn;
        if (conn?.open) {
          conn.send({ type: "need-screen" } satisfies SignalingMessage);
        }
      };

      call.on("stream", (remoteStream) => {
        const videoTracks = remoteStream.getVideoTracks();
        if (videoTracks.length === 0) return;
        attachRemoteScreen(remoteId, remoteStream);
        videoTracks.forEach((track) => {
          track.onended = () => requestScreenAgain();
        });
      });

      watchRtcIce(call.peerConnection as RTCPeerConnection | undefined, () => {
        onIceFailureRef.current("media");
      });
      call.on("close", () => {
        if (remote!.screenCall === call) remote!.screenCall = undefined;
        requestScreenAgain();
      });
      call.on("error", () => {
        if (remote!.screenCall === call) remote!.screenCall = undefined;
        requestScreenAgain();
      });
    },
    [attachRemoteScreen]
  );

  const myPeerInfo = useCallback((): PeerInfo | null => {
    if (!myIdRef.current) return null;
    return {
      id: myIdRef.current,
      name: nameRef.current,
      color: myColorRef.current,
      x: positionRef.current.x,
      y: positionRef.current.y,
      isSharingScreen: Boolean(screenStreamRef.current),
    };
  }, []);

  const collectRoster = useCallback((): PeerInfo[] => {
    const peers: PeerInfo[] = Array.from(remotesRef.current.values())
      .filter((r) => r.info.name !== "???")
      .map((r) => r.info);
    const me = myPeerInfo();
    if (me) peers.push(me);
    return peers;
  }, [myPeerInfo]);

  const applyRemotePeers = useCallback(
    (peers: PeerInfo[]) => {
      peers.forEach((p) => {
        if (p.id === myIdRef.current) return;
        const remote = remotesRef.current.get(p.id);
        if (remote) remote.info = p;
        updatePlayer(p.id, p);
        connectToPeerRef.current(p.id);
      });
    },
    [updatePlayer]
  );

  const setupDataConnectionRef = useRef<(conn: DataConnection) => void>(() => {});

  const handleSignalingMessage = useCallback(
    (msg: SignalingMessage, fromConn?: DataConnection) => {
      switch (msg.type) {
        case "hello": {
          const remote = remotesRef.current.get(msg.peer.id);
          const firstHello = !remote || remote.info.name === "???";
          if (remote) remote.info = msg.peer;
          updatePlayer(msg.peer.id, msg.peer);
          if (!firstHello) break;
          connectToPeerRef.current(msg.peer.id);
          if (isHostRef.current && myIdRef.current) {
            const roster = collectRoster();
            fromConn?.send({
              type: "welcome",
              peers: roster,
              hostId: myIdRef.current,
            } satisfies SignalingMessage);
            fromConn?.send({
              type: "roster",
              peers: roster,
              hostId: myIdRef.current,
            } satisfies SignalingMessage);
            if (screenStreamRef.current) {
              fromConn?.send({
                type: "screen-share",
                peerId: myIdRef.current,
                isSharing: true,
              } satisfies SignalingMessage);
            }
            broadcast({ type: "peer-joined", peer: msg.peer });
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
          applyRemotePeers(msg.peers);
          msg.peers.forEach((p) => {
            if (p.id === myIdRef.current || !p.isSharingScreen) return;
            const existing = remotesRef.current.get(p.id);
            if (isMediaCallLive(existing?.screenCall)) return;
            const conn = existing?.conn ?? fromConn;
            if (conn?.open) {
              conn.send({ type: "need-screen" } satisfies SignalingMessage);
            }
          });
          break;
        }
        case "peer-joined": {
          if (msg.peer.id === myIdRef.current) return;
          updatePlayer(msg.peer.id, msg.peer);
          connectToPeerRef.current(msg.peer.id);
          break;
        }
        case "peer-left":
          removePlayer(msg.peerId);
          break;
        case "position":
          updatePlayer(msg.peerId, { x: msg.x, y: msg.y });
          break;
        case "screen-share": {
          const remote = remotesRef.current.get(msg.peerId);
          if (remote) {
            remote.info = { ...remote.info, isSharingScreen: msg.isSharing };
          }
          updatePlayer(msg.peerId, { isSharingScreen: msg.isSharing });
          if (!msg.isSharing) {
            clearRemoteScreen(msg.peerId);
          } else if (msg.peerId !== myIdRef.current) {
            const existing = remotesRef.current.get(msg.peerId);
            if (isMediaCallLive(existing?.screenCall)) break;
            const conn = existing?.conn ?? fromConn;
            if (conn?.open) {
              conn.send({ type: "need-screen" } satisfies SignalingMessage);
            }
          }
          break;
        }
        case "need-screen":
          if (screenStreamRef.current && fromConn) {
            startScreenCallToPeerRef.current(fromConn.peer, false);
          }
          break;
        case "need-relay":
          switchToRelayRef.current();
          break;
      }
    },
    [broadcast, updatePlayer, removePlayer, clearRemoteScreen, collectRoster, applyRemotePeers]
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
            x: 0,
            y: 0,
          },
        };
        remotesRef.current.set(remoteId, remote);
      }
      remote.conn = conn;
      remote.connStartedAt = Date.now();

      const watchConnIce = () => {
        watchRtcIce(conn.peerConnection as RTCPeerConnection | undefined, () => {
          onIceFailureRef.current("data");
        });
      };
      watchConnIce();
      conn.on("iceStateChanged", watchConnIce);

      const sendHello = () => {
        if (!conn.open || !myIdRef.current) return;
        try {
          const me = myPeerInfo();
          if (!me) return;
          conn.send({
            type: "hello",
            peer: me,
          } satisfies SignalingMessage);
        } catch {
          /* channel may not be ready yet */
        }
      };

      const sendRosterIfHost = () => {
        if (!isHostRef.current || !myIdRef.current || !conn.open) return;
        try {
          conn.send({
            type: "roster",
            peers: collectRoster(),
            hostId: myIdRef.current,
          } satisfies SignalingMessage);
        } catch {
          /* channel may not be ready yet */
        }
      };

      conn.on("open", () => {
        if (conn.peer === roomHostIdRef.current) {
          stopHostConnectRetryRef.current();
          setError((prev) =>
            prev?.startsWith("เชื่อมต่อไม่สำเร็จ") ? null : prev
          );
        }
        sendHello();
        sendRosterIfHost();
        window.setTimeout(sendHello, 300);
        window.setTimeout(sendHello, 1200);
        window.setTimeout(sendRosterIfHost, 400);
      });

      conn.on("data", (data) => {
        handleSignalingMessage(data as SignalingMessage, conn);
      });

      conn.on("error", () => {
        if (remote!.conn === conn) remote!.conn = undefined;
      });

      conn.on("close", () => {
        if (remote!.conn === conn) remote!.conn = undefined;
        if (isHostRef.current) {
          broadcast({ type: "peer-left", peerId: remoteId });
        }
        removePlayer(remoteId);
      });

      if (conn.open) {
        sendHello();
        sendRosterIfHost();
      }
    },
    [broadcast, handleSignalingMessage, removePlayer, collectRoster, myPeerInfo]
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
        setupDataConnection(peer.connect(remoteId, CONNECT_OPTIONS));
      }
      if (localStreamRef.current && !isMediaCallLive(remote?.audioCall) && shouldOfferAudio(myIdRef.current, remoteId)) {
        const call = peer.call(remoteId, localStreamRef.current);
        if (call) setupAudioCall(call);
      }
      if (screenStreamRef.current && !isMediaCallLive(remote?.screenCall)) {
        startScreenCallToPeer(remoteId);
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
        x: positionRef.current.x,
        y: positionRef.current.y,
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
    connectToPeerRef.current = connectToPeer;
    stopScreenShareRef.current = stopScreenShare;
    startScreenCallToPeerRef.current = startScreenCallToPeer;
    onIceFailureRef.current = (kind) => {
      if (forceRelayRef.current || switchingRelayRef.current) return;
      if (kind === "data") {
        for (const remote of remotesRef.current.values()) {
          const pc = remote.conn?.peerConnection as RTCPeerConnection | undefined;
          if (remote.conn?.open && isRtcHealthy(pc)) return;
        }
      }
      switchToRelayRef.current();
    };
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
      const takeoverAfter = isIosDevice() ? 20 : 8;
      if (attempts === RELAY_FALLBACK_AFTER && !forceRelayRef.current) {
        switchToRelayRef.current();
        return;
      }
      if (attempts === takeoverAfter) {
        tryTakeoverRef.current();
        return;
      }
      connectToPeerRef.current(roomHostIdRef.current);

      if (attempts >= HOST_CONNECT_MAX_ATTEMPTS) {
        if (hostConnectTimerRef.current) {
          clearInterval(hostConnectTimerRef.current);
          hostConnectTimerRef.current = null;
        }
        setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
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
  });

  useEffect(() => {
    if (!enabled || !name) return;

    let destroyed = false;
    const remotes = remotesRef.current;
    roomHostIdRef.current = getRoomHostId(roomId);
    const roomHostId = roomHostIdRef.current;
    forceRelayRef.current = false;
    switchingRelayRef.current = false;

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
        remote.audioEl?.remove();
      });
      remotesRef.current.clear();
    }

    function attachPeerHandlers(peer: Peer) {
      peer.on("connection", (conn) => setupDataConnectionRef.current(conn));

      peer.on("call", (call) => {
        const meta = call.metadata as { type?: string } | undefined;
        const answerStream =
          getMicTrack(localStreamRef.current) ?? new MediaStream();

        if (meta?.type === "screen") {
          call.answer(new MediaStream());
          setupScreenReceiveCall(call);
          return;
        }

        call.answer(answerStream);
        setupAudioCall(call);
      });

      peer.on("disconnected", () => {
        if (destroyed || !peer.id) return;
        try {
          peer.reconnect();
        } catch {
          /* PeerJS reconnect can throw if already destroyed */
        }
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
        if (isTransientPeerError(err)) return;
        setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
      });
    }

    function onPeerReady(id: string, asHost: boolean) {
      if (destroyed) return;

      const prevId = myIdRef.current;
      if (prevId && prevId !== id) {
        setPlayers((prev) => {
          const next = { ...prev };
          delete next[prevId];
          return next;
        });
      }

      myIdRef.current = id;
      setMyId(id);
      isHostRef.current = asHost;
      setIsHost(asHost);
      hostIdRef.current = roomHostIdRef.current;

      announceJoin(id);
      setConnected(true);

      if (screenStreamRef.current) {
        remotesRef.current.forEach((remote) => {
          startScreenCallToPeerRef.current(remote.info.id, true);
        });
        broadcast({
          type: "screen-share",
          peerId: id,
          isSharing: true,
        });
        updatePlayer(id, { isSharingScreen: true });
      }

      if (!asHost) {
        connectToPeerRef.current(roomHostIdRef.current);
        startHostConnectRetry();
      } else {
        stopHostConnectRetry();
      }
    }

    function openGuestPeer(): void {
      if (destroyed) return;
      const mySession = ++session;

      const guestId = makeGuestPeerId(roomId);
      const peer = new Peer(guestId, peerOptions());
      peerRef.current = peer;
      attachPeerHandlers(peer);

      peer.on("open", (id) => {
        if (destroyed || mySession !== session) return;
        onPeerReady(id, false);
      });

      peer.on("error", (err) => {
        console.error("Guest peer error:", err);
        if (err.type === "unavailable-id" && !destroyed && mySession === session) {
          peer.destroy();
          openGuestPeer();
          return;
        }
        if (!isTransientPeerError(err)) {
          setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
        }
      });
    }

    function openHostPeer(reclaimTries = 0): void {
      if (destroyed) return;
      const mySession = ++session;

      const hostPeer = new Peer(roomHostId, peerOptions());
      peerRef.current = hostPeer;
      attachPeerHandlers(hostPeer);

      hostPeer.on("open", (id) => {
        if (destroyed || mySession !== session) return;
        onPeerReady(id, true);
      });

      hostPeer.on("error", (err) => {
        console.error("Host peer error:", err);
        if (err.type === "unavailable-id" && mySession === session) {
          hostPeer.destroy();
          if (forceRelayRef.current && isHostRef.current && reclaimTries < 8) {
            window.setTimeout(() => {
              if (!destroyed) openHostPeer(reclaimTries + 1);
            }, RELAY_RECREATE_DELAY_MS);
            return;
          }
          openGuestPeer();
          return;
        }
        if (!isTransientPeerError(err)) {
          setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
        }
      });
    }

    function tryTakeoverHost() {
      if (destroyed || isHostRef.current) return;
      dropAllRemotes();
      peerRef.current?.destroy();
      openHostPeer();
    }

    function switchToRelayAndRejoin() {
      if (destroyed || forceRelayRef.current || switchingRelayRef.current) return;
      // Recreating the host drops the room; only guests (or a sharer) switch.
      if (isHostRef.current && !screenStreamRef.current) return;
      forceRelayRef.current = true;
      switchingRelayRef.current = true;
      stopHostConnectRetry();
      const wasHost = isHostRef.current;
      dropAllRemotes();
      setPlayers((prev) => {
        const mine = myIdRef.current;
        if (!mine || !prev[mine]) return {};
        return { [mine]: { ...prev[mine], isSharingScreen: Boolean(screenStreamRef.current) } };
      });
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

    function startMic() {
      void getMicStream()
        .then((stream) => {
          if (destroyed) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = stream;
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
        });
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has("host")) {
      url.searchParams.delete("host");
      window.history.replaceState({}, "", url.toString());
    }

    // iPad/iPhone: wait for getUserMedia (Safari ICE often needs it), then
    // join as guest so a Mac can own the stable host id.
    // Mac/desktop: claim host immediately so the iPad can find this room.
    if (isIosDevice()) {
      void getMicStream()
        .then((stream) => {
          if (destroyed) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = stream;
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
          if (!destroyed) openGuestPeer();
        });
    } else {
      startMic();
      openHostPeer();
    }

    return () => {
      destroyed = true;
      switchingRelayRef.current = false;
      if (relayTimer) clearTimeout(relayTimer);
      stopHostConnectRetry();
      remotes.forEach((remote) => {
        remote.conn?.close();
        remote.audioCall?.close();
        remote.screenCall?.close();
        remote.audioEl?.remove();
      });
      remotes.clear();
      setLocalScreen(null);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [
    enabled,
    name,
    roomId,
    announceJoin,
    setupAudioCall,
    setupScreenReceiveCall,
    startHostConnectRetry,
    stopHostConnectRetry,
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
          startScreenCallToPeer(remote.info.id);
        }
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [enabled, isSharing, startScreenCallToPeer]);

  useEffect(() => {
    if (!enabled || !connected) return;
    let askedRelay = false;
    const id = window.setInterval(() => {
      const me = myIdRef.current;
      if (!me) return;
      Object.values(players).forEach((p) => {
        if (!p.isSharingScreen || p.id === me) return;
        if (remoteScreen?.peerId === p.id) return;
        if (isMediaCallLive(remotesRef.current.get(p.id)?.screenCall)) return;
        const conn = remotesRef.current.get(p.id)?.conn;
        if (!conn?.open) return;
        conn.send({ type: "need-screen" } satisfies SignalingMessage);
        if (!askedRelay && !forceRelayRef.current) {
          askedRelay = true;
          conn.send({ type: "need-relay" } satisfies SignalingMessage);
          switchToRelayRef.current();
        }
      });
    }, 6000);
    return () => window.clearInterval(id);
  }, [enabled, connected, players, remoteScreen]);

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
    setIsMuted(!track.enabled);
    void unlockAllRemoteAudio();
  }, []);

  const unlockAudio = useCallback(() => {
    void unlockAllRemoteAudio();
  }, []);

  const getShareUrl = useCallback(() => buildShareUrl(roomId), [roomId]);

  return {
    myId,
    myPlayer: myId ? players[myId] : null,
    players: Object.values(players),
    connected,
    error,
    isMuted,
    isSharing,
    isHost,
    remoteScreen,
    localScreen,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    getShareUrl,
    unlockAudio,
    roomId,
  };
}
