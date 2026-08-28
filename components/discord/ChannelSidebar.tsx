"use client";

import type { PlayerState } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { VoiceRoom } from "@/lib/rooms";
import { UserPanel } from "@/components/discord/UserPanel";
import { initialFromName } from "@/lib/colors";

interface ChannelSidebarProps {
  rooms: VoiceRoom[];
  activeRoomId: string;
  activeRoomLabel: string;
  players: PlayerState[];
  myId: string | null;
  connected: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSharing: boolean;
  userName: string;
  userColor: string;
  onSelectRoom: (roomId: string) => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onStartShare: () => void;
  onStopShare: () => void;
  onDisconnect: () => void;
  onCopyLink: () => Promise<void> | void;
}

export function ChannelSidebar({
  rooms,
  activeRoomId,
  activeRoomLabel,
  players,
  myId,
  connected,
  isMuted,
  isDeafened,
  isSharing,
  userName,
  userColor,
  onSelectRoom,
  onToggleMute,
  onToggleDeafen,
  onStartShare,
  onStopShare,
  onDisconnect,
  onCopyLink,
}: ChannelSidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-[#2b2d31] text-[#dbdee1]">
      <header className="flex h-12 items-center border-b border-[#1f2023] px-4 shadow-sm">
        <h1 className="truncate text-[15px] font-semibold text-white">{t.appName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
          {t.voiceChannels}
        </p>
        <ul className="space-y-0.5">
          {rooms.map((room) => {
            const active = room.id === activeRoomId;
            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onSelectRoom(room.id)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[15px] transition ${
                    active
                      ? "bg-[#404249] text-white"
                      : "text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]"
                  }`}
                >
                  <span className="text-[#80848e]">🔊</span>
                  <span className="flex-1 truncate">
                    {room.labelTh} / {room.label}
                  </span>
                </button>
                {active && (
                  <ul className="ml-6 mt-0.5 space-y-0.5">
                    {players.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-[#dbdee1]"
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: p.color }}
                        >
                          {initialFromName(p.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {p.name}
                          {p.id === myId ? ` ${t.you}` : ""}
                        </span>
                        {p.isSharingScreen && (
                          <span className="rounded bg-[#ed4245] px-1 py-px text-[9px] font-bold tracking-wide text-white">
                            {t.live}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <UserPanel
        userName={userName}
        userColor={userColor}
        connected={connected}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isSharing={isSharing}
        roomLabel={activeRoomLabel}
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onStartShare={onStartShare}
        onStopShare={onStopShare}
        onDisconnect={onDisconnect}
        onCopyLink={onCopyLink}
      />
    </aside>
  );
}
