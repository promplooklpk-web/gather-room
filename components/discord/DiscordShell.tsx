"use client";

import { useEffect, useState } from "react";
import { usePeerRoom } from "@/hooks/usePeerRoom";
import { GameCanvas } from "@/components/GameCanvas";
import { TouchJoystick } from "@/components/TouchJoystick";
import { ServerRail } from "@/components/discord/ServerRail";
import { ChannelSidebar } from "@/components/discord/ChannelSidebar";
import { FloatingControlBar } from "@/components/discord/FloatingControlBar";
import {
  ParticipantTiles,
  ScreenStage,
} from "@/components/discord/VoiceStage";
import { t } from "@/lib/i18n";
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
    players,
    connected,
    error,
    isMuted,
    isSharing,
    remoteScreen,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    setTouchInput,
    clearTouchInput,
    setWalkTarget,
    unlockAudio,
  } = usePeerRoom({ name: userName, roomId, enabled: true });

  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(
    () => typeof window !== "undefined" && "ontouchstart" in window
  );

  const handleUnlockAudio = () => {
    unlockAudio();
    setNeedsAudioUnlock(false);
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, []);

  const someoneSharing = players.some((p) => p.isSharingScreen);

  return (
    <>
      <ChannelSidebar
        rooms={rooms}
        activeRoomId={roomId}
        activeRoomLabel={`${room.labelTh} / ${room.label}`}
        players={players}
        myId={myId}
        connected={connected}
        isMuted={isMuted}
        isSharing={isSharing}
        userName={userName}
        onSelectRoom={onSelectRoom}
        onToggleMute={() => {
          toggleMute();
          handleUnlockAudio();
        }}
        onStartShare={startScreenShare}
        onStopShare={stopScreenShare}
        onDisconnect={onLogout}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#313338]">
        <header className="flex h-12 shrink-0 items-center border-b border-[#1f2023] px-4 shadow-sm">
          <span className="text-[#949ba4]">🔊</span>
          <h2 className="ml-2 text-[15px] font-semibold text-white">
            {room.labelTh} / {room.label}
          </h2>
          {connected && (
            <span className="ml-3 rounded bg-[#23a559]/20 px-2 py-0.5 text-[11px] font-semibold text-[#23a559]">
              {t.live}
            </span>
          )}
        </header>

        <ScreenStage
          remoteScreen={remoteScreen}
          isSharing={isSharing}
          someoneSharing={someoneSharing}
        />

        {error && (
          <div className="mx-4 mt-3 rounded border border-[#ed4245]/40 bg-[#ed4245]/15 px-3 py-2 text-sm text-[#faa61a]">
            {error}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ParticipantTiles players={players} myId={myId} />

          <div className="flex flex-1 flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-[768px]">
              <GameCanvas
                players={players}
                myId={myId}
                remoteScreen={remoteScreen?.stream ?? null}
                onTapWalk={setWalkTarget}
              />
              <div className="pointer-events-auto absolute bottom-3 left-3 z-10">
                <TouchJoystick onMove={setTouchInput} onEnd={clearTouchInput} />
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-[#949ba4]">
              {t.controls}
              <span className="block text-[#6d6f78]">{t.tapToWalk}</span>
            </p>
          </div>
        </div>

        <FloatingControlBar
          isMuted={isMuted}
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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("room")) setRoomInUrl(id);
    }
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
