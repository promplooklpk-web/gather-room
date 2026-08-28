"use client";

import type { PlayerState } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { VoiceRoom } from "@/lib/rooms";

interface ChannelSidebarProps {
  rooms: VoiceRoom[];
  activeRoomId: string;
  activeRoomLabel: string;
  players: PlayerState[];
  myId: string | null;
  connected: boolean;
  isMuted: boolean;
  isSharing: boolean;
  userName: string;
  onSelectRoom: (roomId: string) => void;
  onToggleMute: () => void;
  onStartShare: () => void;
  onStopShare: () => void;
  onDisconnect: () => void;
}

export function ChannelSidebar({
  rooms,
  activeRoomId,
  activeRoomLabel,
  players,
  myId,
  connected,
  isMuted,
  isSharing,
  userName,
  onSelectRoom,
  onToggleMute,
  onStartShare,
  onStopShare,
  onDisconnect,
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
            const count = active ? players.length : null;
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
                  <span className="text-[#949ba4]">🔊</span>
                  <span className="flex-1 truncate">
                    {room.labelTh} / {room.label}
                  </span>
                  {active && count !== null && (
                    <span className="text-[11px] text-[#23a559]">{count}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {connected && (
          <div className="mt-4 px-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
              {t.participants}
            </p>
            <ul className="space-y-1">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded px-2 py-1 text-sm text-[#dbdee1]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate">
                    {p.name}
                    {p.id === myId && (
                      <span className="text-[#23a559]"> {t.you}</span>
                    )}
                  </span>
                  {p.isSharingScreen && <span className="text-xs">🖥️</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-[#1f2023] bg-[#232428] p-2">
        {connected && (
          <div className="mb-2 rounded bg-[#2b2d31] px-2 py-1.5">
            <p className="flex items-center gap-1.5 text-xs text-[#23a559]">
              <span className="h-2 w-2 rounded-full bg-[#23a559]" />
              {t.connectedTo}: {activeRoomLabel}
            </p>
          </div>
        )}
        <div className="mb-2 flex gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
              isMuted
                ? "bg-[#ed4245] text-white"
                : "bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]"
            }`}
          >
            {isMuted ? t.unmute : t.mute}
          </button>
          <button
            type="button"
            onClick={isSharing ? onStopShare : onStartShare}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
              isSharing
                ? "bg-[#faa61a] text-white"
                : "bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]"
            }`}
          >
            {isSharing ? t.stopShare : t.shareScreen}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="truncate text-xs text-[#949ba4]">
              {connected ? t.inRoom : t.connecting}
            </p>
          </div>
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded bg-[#383a40] p-2 text-[#ed4245] hover:bg-[#404249]"
            title={t.disconnect}
            aria-label={t.disconnect}
          >
            📞
          </button>
        </div>
      </div>
    </aside>
  );
}
