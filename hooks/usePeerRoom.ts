"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import {
  PEER_OPTIONS,
  ROOM_HOST_ID,
  SCREEN_CALL_META,
  isTransientPeerError,
  makeGuestPeerId,
} from "@/lib/peerConfig";
import { MOVE_SPEED, SPAWN, canMoveTo, pickColor } from "@/lib/room";
import type { PeerInfo, PlayerState, SignalingMessage } from "@/lib/types";
import { ROOM_ID } from "@/lib/types";

const HOST_CONNECT_MAX_ATTEMPTS = 20;
const HOST_CONNECT_INTERVAL_MS = 1500;

interface RemotePeer {
  info: PeerInfo;
  conn?: DataConnection;
  audioCall?: MediaConnection;
  screenCall?: MediaConnection;
  audioEl?: HTMLAudioElement;
}

interface UsePeerRoomOptions {
  name: string;
  enabled: boolean;
}

export function usePeerRoom({ name, enabled }: UsePeerRoomOptions) {
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

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remotesRef = useRef<Map<string, RemotePeer>>(new Map());
  const myColorRef = useRef("");
  const positionRef = useRef({ x: SPAWN.x, y: SPAWN.y });
  const keysRef = useRef<Set<string>>(new Set());
  const touchInputRef = useRef({ x: 0, y: 0 });
  const walkTargetRef = useRef<{ x: number; y: number } | null>(null);
  const hostIdRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const myIdRef = useRef<string | null>(null);
  const nameRef = useRef(name);
  const animationRef = useRef<number>(0);
  const connectToPeerRef = useRef<(remoteId: string) => void>(() => {});
  const stopScreenShareRef = useRef<() => void>(() => {});
  const startScreenCallsRef = useRef<() => void>(() => {});
  const hostConnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopHostConnectRetryRef = useRef<() => void>(() => {});

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

  const sendPosition = useCallback(() => {
    if (!myIdRef.current) return;
    broadcast({
      type: "position",
      peerId: myIdRef.current,
      x: positionRef.current.x,
      y: positionRef.current.y,
    });
  }, [broadcast]);

  const updatePlayer = useCallback((peerId: string, patch: Partial<PlayerState>) => {
    setPlayers((prev) => {
      const existing = prev[peerId];
      if (!existing && !patch.id) return prev;
      return {
        ...prev,
        [peerId]: { ...existing, ...patch, id: peerId } as PlayerState,
      };
    });
  }, []);

  const getRemoteName = useCallback((peerId: string) => {
    const remote = remotesRef.current.get(peerId);
    return remote?.info.name ?? "???";
  }, []);

  const attachRemoteScreen = useCallback(
    (peerId: string, stream: MediaStream) => {
      setRemoteScreen({
        peerId,
        name: getRemoteName(peerId),
        stream,
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
      remote.audioEl.srcObject = null;
      remote.audioEl.remove();
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
            x: SPAWN.x,
            y: SPAWN.y,
          },
        };
        remotesRef.current.set(remoteId, remote);
      }
      remote.audioCall = call;

      call.on("stream", (remoteStream) => {
        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length === 0) return;

        if (!remote!.audioEl) {
          const audio = document.createElement("audio");
          audio.autoplay = true;
          document.body.appendChild(audio);
          remote!.audioEl = audio;
        }
        remote!.audioEl!.srcObject = new MediaStream(audioTracks);
        void remote!.audioEl!.play().catch(() => {});
      });

      call.on("close", () => {
        remote!.audioCall = undefined;
      });
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
            x: SPAWN.x,
            y: SPAWN.y,
          },
        };
        remotesRef.current.set(remoteId, remote);
      }

      call.on("stream", (remoteStream) => {
        const videoTracks = remoteStream.getVideoTracks();
        if (videoTracks.length === 0) return;
        attachRemoteScreen(remoteId, remoteStream);
      });

      call.on("close", () => {
        clearRemoteScreen(remoteId);
      });
    },
    [attachRemoteScreen, clearRemoteScreen]
  );

  const setupDataConnectionRef = useRef<(conn: DataConnection) => void>(() => {});

  const handleSignalingMessage = useCallback(
    (msg: SignalingMessage, fromConn?: DataConnection) => {
      switch (msg.type) {
        case "hello": {
          const remote = remotesRef.current.get(msg.peer.id);
          if (remote) remote.info = msg.peer;
          updatePlayer(msg.peer.id, msg.peer);
          if (isHostRef.current && myIdRef.current) {
            const allPeers: PeerInfo[] = Array.from(remotesRef.current.values())
              .filter((r) => r.info.id !== msg.peer.id && r.info.name !== "???")
              .map((r) => r.info);
            allPeers.push({
              id: myIdRef.current,
              name: nameRef.current,
              color: myColorRef.current,
              x: positionRef.current.x,
              y: positionRef.current.y,
            });
            fromConn?.send({
              type: "welcome",
              peers: allPeers,
              hostId: myIdRef.current,
            } satisfies SignalingMessage);
            broadcast({ type: "peer-joined", peer: msg.peer });
            connectToPeerRef.current(msg.peer.id);
          }
          break;
        }
        case "welcome": {
          hostIdRef.current = msg.hostId;
          msg.peers.forEach((p) => {
            if (p.id !== myIdRef.current) {
              updatePlayer(p.id, p);
              connectToPeerRef.current(p.id);
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
        case "screen-share":
          updatePlayer(msg.peerId, { isSharingScreen: msg.isSharing });
          if (!msg.isSharing) {
            clearRemoteScreen(msg.peerId);
          }
          break;
      }
    },
    [broadcast, updatePlayer, removePlayer, clearRemoteScreen]
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
            x: SPAWN.x,
            y: SPAWN.y,
          },
        };
        remotesRef.current.set(remoteId, remote);
      }
      remote.conn = conn;

      conn.on("open", () => {
        if (conn.peer === ROOM_HOST_ID) {
          stopHostConnectRetryRef.current();
          setError((prev) =>
            prev?.startsWith("เชื่อมต่อไม่สำเร็จ") ? null : prev
          );
        }

        if (!isHostRef.current && myIdRef.current) {
          conn.send({
            type: "hello",
            peer: {
              id: myIdRef.current,
              name: nameRef.current,
              color: myColorRef.current,
              x: positionRef.current.x,
              y: positionRef.current.y,
            },
          } satisfies SignalingMessage);
        }
      });

      conn.on("data", (data) => {
        handleSignalingMessage(data as SignalingMessage, conn);
      });

      conn.on("close", () => {
        if (isHostRef.current) {
          broadcast({ type: "peer-left", peerId: remoteId });
        }
        removePlayer(remoteId);
      });
    },
    [broadcast, handleSignalingMessage, removePlayer]
  );

  const startScreenCallToPeer = useCallback((remoteId: string) => {
    const peer = peerRef.current;
    const screenStream = screenStreamRef.current;
    if (!peer || !screenStream) return;

    const remote = remotesRef.current.get(remoteId);
    if (!remote) return;

    remote.screenCall?.close();
    const call = peer.call(remoteId, screenStream, { metadata: SCREEN_CALL_META });
    if (!call) return;

    remote.screenCall = call;
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

      if (!remotesRef.current.get(remoteId)?.conn?.open) {
        setupDataConnection(peer.connect(remoteId, { reliable: true }));
      }
      if (localStreamRef.current && !remotesRef.current.get(remoteId)?.audioCall) {
        const call = peer.call(remoteId, localStreamRef.current);
        if (call) setupAudioCall(call);
      }
      if (screenStreamRef.current) {
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
        isSharingScreen: false,
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
        video: { frameRate: 15 },
        audio: false,
      });
      screenStreamRef.current = screenStream;
      const videoTrack = screenStream.getVideoTracks()[0];
      videoTrack.onended = () => stopScreenShareRef.current();

      startScreenCallsToAll();

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
    startScreenCallsRef.current = startScreenCallsToAll;
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

      const hostConn = remotesRef.current.get(ROOM_HOST_ID);
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
      connectToPeerRef.current(ROOM_HOST_ID);

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

    function attachPeerHandlers(peer: Peer) {
      peer.on("connection", (conn) => setupDataConnectionRef.current(conn));

      peer.on("call", (call) => {
        const meta = call.metadata as { type?: string } | undefined;
        const answerStream = localStreamRef.current ?? new MediaStream();

        if (meta?.type === "screen") {
          call.answer(answerStream);
          setupScreenReceiveCall(call);
          return;
        }

        call.answer(answerStream);
        setupAudioCall(call);
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
        if (isTransientPeerError(err)) return;
        setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
      });
    }

    function onPeerReady(id: string, asHost: boolean) {
      if (destroyed) return;

      myIdRef.current = id;
      setMyId(id);
      isHostRef.current = asHost;
      setIsHost(asHost);
      hostIdRef.current = ROOM_HOST_ID;

      announceJoin(id);
      setConnected(true);

      if (!asHost) {
        connectToPeerRef.current(ROOM_HOST_ID);
        startHostConnectRetry();
      }
    }

    function openGuestPeer(): void {
      if (destroyed) return;

      const guestId = makeGuestPeerId(ROOM_ID);
      const peer = new Peer(guestId, PEER_OPTIONS);
      peerRef.current = peer;
      attachPeerHandlers(peer);

      peer.on("open", (id) => onPeerReady(id, false));

      peer.on("error", (err) => {
        console.error("Guest peer error:", err);
        if (err.type === "unavailable-id" && !destroyed) {
          peer.destroy();
          openGuestPeer();
          return;
        }
        if (!isTransientPeerError(err)) {
          setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
        }
      });
    }

    async function init() {
      const url = new URL(window.location.href);
      if (url.searchParams.has("host")) {
        url.searchParams.delete("host");
        window.history.replaceState({}, "", url.toString());
      }

      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch {
        setError(
          "ไม่สามารถใช้ไมค์ได้ — กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์ / Microphone access denied. Please allow mic permission."
        );
      }

      const hostPeer = new Peer(ROOM_HOST_ID, PEER_OPTIONS);
      peerRef.current = hostPeer;
      attachPeerHandlers(hostPeer);

      hostPeer.on("open", (id) => onPeerReady(id, true));

      hostPeer.on("error", (err) => {
        console.error("Host peer error:", err);
        if (err.type === "unavailable-id") {
          hostPeer.destroy();
          openGuestPeer();
          return;
        }
        if (!isTransientPeerError(err)) {
          setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
        }
      });
    }

    init();

    return () => {
      destroyed = true;
      stopHostConnectRetry();
      cancelAnimationFrame(animationRef.current);
      remotes.forEach((remote) => {
        remote.conn?.close();
        remote.audioCall?.close();
        remote.screenCall?.close();
        remote.audioEl?.remove();
      });
      remotes.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [
    enabled,
    name,
    announceJoin,
    setupAudioCall,
    setupScreenReceiveCall,
    startHostConnectRetry,
    stopHostConnectRetry,
  ]);

  useEffect(() => {
    if (!enabled || !connected) return;

    let lastSent = 0;
    const tick = () => {
      let dx = 0;
      let dy = 0;

      const keys = keysRef.current;
      if (keys.has("w") || keys.has("arrowup")) dy -= MOVE_SPEED;
      if (keys.has("s") || keys.has("arrowdown")) dy += MOVE_SPEED;
      if (keys.has("a") || keys.has("arrowleft")) dx -= MOVE_SPEED;
      if (keys.has("d") || keys.has("arrowright")) dx += MOVE_SPEED;

      const touch = touchInputRef.current;
      if (touch.x !== 0 || touch.y !== 0) {
        const len = Math.hypot(touch.x, touch.y);
        if (len > 0.15) {
          dx += (touch.x / len) * MOVE_SPEED;
          dy += (touch.y / len) * MOVE_SPEED;
        }
      }

      const target = walkTargetRef.current;
      if (target) {
        const { x, y } = positionRef.current;
        const distX = target.x - x;
        const distY = target.y - y;
        const dist = Math.hypot(distX, distY);
        if (dist < MOVE_SPEED * 1.5) {
          if (canMoveTo(target.x, target.y)) {
            positionRef.current.x = target.x;
            positionRef.current.y = target.y;
          }
          walkTargetRef.current = null;
        } else {
          dx += (distX / dist) * MOVE_SPEED;
          dy += (distY / dist) * MOVE_SPEED;
        }
      }

      const { x, y } = positionRef.current;
      if (dx !== 0 && canMoveTo(x + dx, y)) positionRef.current.x += dx;
      if (dy !== 0 && canMoveTo(x, y + dy)) positionRef.current.y += dy;

      if (walkTargetRef.current) {
        const { x: nx, y: ny } = positionRef.current;
        const t = walkTargetRef.current;
        if (Math.hypot(t.x - nx, t.y - ny) < MOVE_SPEED * 2) {
          if (!canMoveTo(nx + dx, ny + dy)) walkTargetRef.current = null;
        }
      }

      if (myIdRef.current) {
        const id = myIdRef.current;
        setPlayers((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            id,
            name: nameRef.current,
            color: myColorRef.current,
            x: positionRef.current.x,
            y: positionRef.current.y,
          },
        }));
      }

      if (Date.now() - lastSent > 50) {
        sendPosition();
        lastSent = Date.now();
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, [enabled, connected, sendPosition]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(
          key
        )
      ) {
        keysRef.current.add(key);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  const setTouchInput = useCallback((x: number, y: number) => {
    touchInputRef.current = { x, y };
    walkTargetRef.current = null;
  }, []);

  const clearTouchInput = useCallback(() => {
    touchInputRef.current = { x: 0, y: 0 };
  }, []);

  const setWalkTarget = useCallback((x: number, y: number) => {
    if (canMoveTo(x, y)) {
      walkTargetRef.current = { x, y };
    }
  }, []);

  const getShareUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("host");
    return url.toString();
  }, []);

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
    toggleMute,
    startScreenShare,
    stopScreenShare,
    getShareUrl,
    setTouchInput,
    clearTouchInput,
    setWalkTarget,
  };
}
