"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import { MOVE_SPEED, SPAWN, canMoveTo, pickColor } from "@/lib/room";
import type { PeerInfo, PlayerState, SignalingMessage } from "@/lib/types";
import { ROOM_ID } from "@/lib/types";

const PEER_OPTIONS = {
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
};

interface RemotePeer {
  info: PeerInfo;
  conn?: DataConnection;
  call?: MediaConnection;
  audioEl?: HTMLAudioElement;
  screenStream?: MediaStream;
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
  const hostIdRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const myIdRef = useRef<string | null>(null);
  const nameRef = useRef(name);
  const animationRef = useRef<number>(0);
  const connectToPeerRef = useRef<(remoteId: string) => void>(() => {});
  const stopScreenShareRef = useRef<() => void>(() => {});

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
    remote?.call?.close();
    remote?.conn?.close();
    remotesRef.current.delete(peerId);
    setRemoteScreen((prev) => (prev?.peerId === peerId ? null : prev));
  }, []);

  const setupMediaCall = useCallback(
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
      remote.call = call;

      call.on("stream", (remoteStream) => {
        const videoTracks = remoteStream.getVideoTracks();
        const audioTracks = remoteStream.getAudioTracks();

        if (videoTracks.length > 0) {
          remote!.screenStream = remoteStream;
          setRemoteScreen({
            peerId: remoteId,
            name: remote!.info.name,
            stream: remoteStream,
          });
          updatePlayer(remoteId, { isSharingScreen: true });
        }

        if (audioTracks.length > 0) {
          if (!remote!.audioEl) {
            const audio = document.createElement("audio");
            audio.autoplay = true;
            document.body.appendChild(audio);
            remote!.audioEl = audio;
          }
          remote!.audioEl!.srcObject = new MediaStream(audioTracks);
        }
      });

      call.on("close", () => {
        if (remote?.screenStream) {
          setRemoteScreen((prev) => (prev?.peerId === remoteId ? null : prev));
          updatePlayer(remoteId, { isSharingScreen: false });
        }
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
            setRemoteScreen((prev) =>
              prev?.peerId === msg.peerId ? null : prev
            );
          }
          break;
      }
    },
    [broadcast, updatePlayer, removePlayer]
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

  const connectToPeer = useCallback(
    (remoteId: string) => {
      if (!peerRef.current || remoteId === myIdRef.current) return;
      const peer = peerRef.current;

      if (!remotesRef.current.get(remoteId)?.conn?.open) {
        setupDataConnection(peer.connect(remoteId, { reliable: true }));
      }
      if (localStreamRef.current && !remotesRef.current.get(remoteId)?.call) {
        const call = peer.call(remoteId, localStreamRef.current);
        if (call) setupMediaCall(call);
      }
    },
    [setupDataConnection, setupMediaCall]
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
      const videoSender = remote.call?.peerConnection
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (videoSender) videoSender.replaceTrack(null);
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

  useEffect(() => {
    setupDataConnectionRef.current = setupDataConnection;
    connectToPeerRef.current = connectToPeer;
    stopScreenShareRef.current = stopScreenShare;
  });

  useEffect(() => {
    if (!enabled || !name) return;

    let destroyed = false;
    const remotes = remotesRef.current;

    async function init() {
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

      const existingHost = new URLSearchParams(window.location.search).get("host");
      const peerId = `gather-${ROOM_ID}-${Math.random().toString(36).slice(2, 8)}`;
      const peer = new Peer(peerId, PEER_OPTIONS);
      peerRef.current = peer;

      peer.on("open", (id) => {
        if (destroyed) return;
        myIdRef.current = id;
        setMyId(id);

        if (!existingHost) {
          isHostRef.current = true;
          setIsHost(true);
          hostIdRef.current = id;
          const url = new URL(window.location.href);
          url.searchParams.set("host", id);
          window.history.replaceState({}, "", url.toString());
        } else {
          hostIdRef.current = existingHost;
          connectToPeerRef.current(existingHost);
        }

        announceJoin(id);
        setConnected(true);
      });

      peer.on("connection", (conn) => setupDataConnectionRef.current(conn));

      peer.on("call", (call) => {
        const stream = screenStreamRef.current || localStreamRef.current;
        if (stream) call.answer(stream);
        setupMediaCall(call);
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
        if (err.type !== "unavailable-id") {
          setError("เชื่อมต่อไม่สำเร็จ / Connection failed. ลองรีเฟรชหน้า");
        }
      });
    }

    init();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animationRef.current);
      remotes.forEach((remote) => {
        remote.conn?.close();
        remote.call?.close();
        remote.audioEl?.remove();
      });
      remotes.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [enabled, name, announceJoin, setupDataConnection, setupMediaCall]);

  useEffect(() => {
    if (!enabled || !connected) return;

    let lastSent = 0;
    const tick = () => {
      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has("w") || keys.has("arrowup")) dy -= MOVE_SPEED;
      if (keys.has("s") || keys.has("arrowdown")) dy += MOVE_SPEED;
      if (keys.has("a") || keys.has("arrowleft")) dx -= MOVE_SPEED;
      if (keys.has("d") || keys.has("arrowright")) dx += MOVE_SPEED;

      const { x, y } = positionRef.current;
      if (dx !== 0 && canMoveTo(x + dx, y)) positionRef.current.x += dx;
      if (dy !== 0 && canMoveTo(x, y + dy)) positionRef.current.y += dy;

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

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = screenStream;
      const videoTrack = screenStream.getVideoTracks()[0];
      videoTrack.onended = () => stopScreenShareRef.current();

      remotesRef.current.forEach((remote) => {
        if (remote.call?.peerConnection) {
          const videoSender = remote.call.peerConnection
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          } else {
            remote.call.peerConnection.addTrack(videoTrack, screenStream);
          }
        } else if (peerRef.current) {
          const combined = new MediaStream([
            ...(localStreamRef.current?.getAudioTracks() ?? []),
            videoTrack,
          ]);
          const call = peerRef.current.call(remote.info.id, combined);
          if (call) setupMediaCall(call);
        }
      });

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
  }, [broadcast, setupMediaCall, updatePlayer]);

  const getShareUrl = useCallback(() => {
    const host = hostIdRef.current || myIdRef.current;
    const url = new URL(window.location.href);
    if (host) url.searchParams.set("host", host);
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
  };
}
