"use client";

import { useEffect, useRef, useState } from "react";
import { usePeerRoom } from "@/hooks/usePeerRoom";
import { ServerRail } from "@/components/discord/ServerRail";
import { ChannelSidebar } from "@/components/discord/ChannelSidebar";
import { FloatingControlBar } from "@/components/discord/FloatingControlBar";
import { ScreenStage } from "@/components/discord/VoiceStage";
import { ConnectionStrip } from "@/components/discord/ConnectionStrip";
import { ChatPanel } from "@/components/discord/ChatPanel";
import { SettingsModal } from "@/components/discord/SettingsModal";
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
  } = usePeerRoom({ name: userName, roomId, enabled: true });

  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(
    () => typeof window !== "undefined" && "ontouchstart" in window
  );
  const [isDeafened, setIsDeafened] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const prevMessageCountRef = useRef(messages.length);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      if (!isChatOpen) {
        setUnreadCount((c) => c + (messages.length - prevMessageCountRef.current));
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, isChatOpen]);

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  };

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

  const sidebarProps = {
    rooms,
    activeRoomId: roomId,
    userPanelRoomLabel: room.label,
    players,
    myId,
    connected,
    connectionStatus,
    connectionQuality,
    isMuted,
    isDeafened,
    isSharing,
    userName,
    userColor,
    speakingPeers,
    onSelectRoom: (id: string) => {
      onSelectRoom(id);
      setIsMobileSidebarOpen(false);
    },
    onToggleMute: () => {
      toggleMute();
      handleUnlockAudio();
    },
    onToggleDeafen: handleToggleDeafen,
    onStartShare: startScreenShare,
    onStopShare: stopScreenShare,
    onDisconnect: onLogout,
    onCopyLink: handleCopyLink,
    onRetryConnection: retryConnection,
    onOpenSettings: () => setIsSettingsOpen(true),
  };

  return (
    <>
      {/* Desktop sidebars */}
      <div className="hidden md:flex shrink-0">
        <ServerRail />
        <ChannelSidebar {...sidebarProps} />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-50 flex h-full shadow-2xl">
            <ServerRail />
            <ChannelSidebar {...sidebarProps} />
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      <div className="flex min-w-0 flex-1 overflow-hidden bg-[#313338]">
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f2023] px-3 shadow-sm md:px-4">
            <div className="flex items-center gap-2 truncate">
              {/* Hamburger button on mobile */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="rounded p-1.5 text-[#b5bac1] hover:bg-[#35373c] hover:text-white md:hidden"
                aria-label="Open channels"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              <span className="text-[#949ba4]">🔊</span>
              <h2 className="truncate text-[15px] font-semibold text-white">
                {roomLabel}
              </h2>
              {connectionStatus === "connected" && (
                <span className="hidden rounded bg-[#23a559]/20 px-2 py-0.5 text-[11px] font-semibold text-[#23a559] sm:inline-block">
                  {t.live}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ConnectionStrip
                status={connectionStatus}
                quality={connectionQuality}
                onRetry={retryConnection}
              />

              {/* Chat Toggle Button */}
              <button
                type="button"
                onClick={handleToggleChat}
                className={`relative flex items-center justify-center rounded p-1.5 transition ${
                  isChatOpen
                    ? "bg-[#35373c] text-white"
                    : "text-[#b5bac1] hover:bg-[#35373c] hover:text-white"
                }`}
                title={isChatOpen ? t.chat : t.chatTitle}
                aria-label={isChatOpen ? t.chat : t.chatTitle}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                </svg>
                {unreadCount > 0 && !isChatOpen && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ed4245] px-1 text-[10px] font-bold text-white shadow">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
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
            speakingPeers={speakingPeers}
            userVolumes={userVolumes}
            onSetUserVolume={setUserVolume}
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
            onToggleChat={handleToggleChat}
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
          />
        </main>

        {/* In-Room Text Chat Panel */}
        {isChatOpen && (
          <ChatPanel
            roomName={room.label}
            messages={messages}
            myId={myId}
            onSendMessage={sendChatMessage}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          userName={userName}
          userColor={userColor}
          onUpdateProfile={updateProfile}
          onSwitchMicrophone={switchMicrophone}
        />
      )}
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
