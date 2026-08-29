"use client";

import { useEffect, useState } from "react";
import { usePeerRoom } from "@/hooks/usePeerRoom";
import { ServerRail } from "@/components/discord/ServerRail";
import { ChannelSidebar } from "@/components/discord/ChannelSidebar";
import { FloatingControlBar } from "@/components/discord/FloatingControlBar";
import { ScreenStage } from "@/components/discord/VoiceStage";
import { ConnectionStrip } from "@/components/discord/ConnectionStrip";
import { t } from "@/lib/i18n";
import { setRemoteAudioDeafened } from "@/lib/audio";
import {
  VOICE_ROOMS,
  findRoom,
  parseRoomFromUrl,
  setRoomInUrl,
  type VoiceRoom,
} from "@/lib/rooms";

interface DiscordShellProps {
  userName: string;
  onLogout: () => void;
}

interface VoiceRoomSessionProps {
  userName: string;
  roomId: string;
  rooms: VoiceRoom[];
  onSelectRoom: (roomId: string) => void;
  onLogout: () => void;
}

function VoiceRoomSession({
  userName,
  roomId,
  rooms,
  onSelectRoom,
  onLogout,
}: VoiceRoomSessionProps) {
  const room = findRoom(roomId)!;
  const {
    myId,
    myPlayer,
    players,
    connected,
    connectionStatus,
    connectionQuality,
    error,
    isMuted,
    isSharing,
    remoteScreen,
    localScreen,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    getShareUrl,
    unlockAudio,
    retryConnection,
  } = usePeerRoom({ name: userName, roomId, enabled: true });

  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(
    () => typeof window !== "undefined" && "ontouchstart" in window
  );
  const [isDeafened, setIsDeafened] = useState(false);

  const handleUnlockAudio = () => {
    unlockAudio();
    setNeedsAudioUnlock(false);
  };

  const handleToggleDeafen = () => {
    setIsDeafened((prev) => {
      const next = !prev;
      setRemoteAudioDeafened(next);
      if (!next) handleUnlockAudio();
      return next;
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
    } catch {
      window.prompt(t.copyLink, getShareUrl());
    }
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      setRemoteAudioDeafened(false);
    };
  }, []);

  const someoneSharing = players.some((p) => p.isSharingScreen);
  const roomLabel = `${room.labelTh} / ${room.label}`;
  const userColor = myPlayer?.color ?? "#5865f2";

  return (
    <>
      <ChannelSidebar
        rooms={rooms}
        activeRoomId={roomId}
        userPanelRoomLabel={room.label}
        players={players}
        myId={myId}
        connected={connected}
        connectionStatus={connectionStatus}
        connectionQuality={connectionQuality}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isSharing={isSharing}
        userName={userName}
        userColor={userColor}
        onSelectRoom={onSelectRoom}
        onToggleMute={() => {
          toggleMute();
          handleUnlockAudio();
        }}
        onToggleDeafen={handleToggleDeafen}
        onStartShare={startScreenShare}
        onStopShare={stopScreenShare}
        onDisconnect={onLogout}
        onCopyLink={handleCopyLink}
        onRetryConnection={retryConnection}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#313338]">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#1f2023] px-4 shadow-sm">
          <span className="text-[#949ba4]">🔊</span>
          <h2 className="text-[15px] font-semibold text-white">
            {roomLabel}
          </h2>
          {connectionStatus === "connected" && (
            <span className="rounded bg-[#23a559]/20 px-2 py-0.5 text-[11px] font-semibold text-[#23a559]">
              {t.live}
            </span>
          )}
          <ConnectionStrip
            status={connectionStatus}
            quality={connectionQuality}
            onRetry={retryConnection}
          />
        </header>

        {error && (
          <div className="mx-4 mt-3 rounded border border-[#ed4245]/40 bg-[#ed4245]/15 px-3 py-2 text-sm text-[#faa61a]">
            {error}
          </div>
        )}

        <ScreenStage
          players={players}
          myId={myId}
          roomLabel={roomLabel}
          remoteScreen={remoteScreen}
          localScreen={localScreen}
          isSharing={isSharing}
          isMuted={isMuted}
          isDeafened={isDeafened}
          someoneSharing={someoneSharing}
        />

        <FloatingControlBar
          isMuted={isMuted || isDeafened}
          isSharing={isSharing}
          onToggleMute={() => {
            toggleMute();
            handleUnlockAudio();
          }}
          onStartShare={startScreenShare}
          onStopShare={stopScreenShare}
          onLeave={onLogout}
          onUnlockAudio={handleUnlockAudio}
          needsAudioUnlock={needsAudioUnlock && connected}
        />
      </main>
    </>
  );
}

export function DiscordShell({ userName, onLogout }: DiscordShellProps) {
  const [activeRoomId, setActiveRoomId] = useState(() => {
    const id = parseRoomFromUrl();
    if (typeof window !== "undefined") setRoomInUrl(id);
    return id;
  });

  const handleSelectRoom = (roomId: string) => {
    if (roomId === activeRoomId) return;
    setActiveRoomId(roomId);
    setRoomInUrl(roomId);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#1e1f22] text-[#dbdee1]">
      <ServerRail />
      <VoiceRoomSession
        key={activeRoomId}
        userName={userName}
        roomId={activeRoomId}
        rooms={VOICE_ROOMS}
        onSelectRoom={handleSelectRoom}
        onLogout={onLogout}
      />
    </div>
  );
}
