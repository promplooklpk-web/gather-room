"use client";

import type { ConnectionQuality, ConnectionStatus, PlayerState, PresenceSyncStatus } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { RoomOccupancyMap } from "@/lib/allRoomsPresence";
import type { VoiceRoom } from "@/lib/rooms";
import { UserPanel } from "@/components/discord/UserPanel";
import { initialFromName } from "@/lib/colors";

interface ChannelSidebarProps {
  rooms: VoiceRoom[];
  activeRoomId: string;
  userPanelRoomLabel: string;
  occupancyByRoom: RoomOccupancyMap;
  players: PlayerState[];
  myId: string | null;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  connectionStatusRaw?: ConnectionStatus;
  connectionQuality: ConnectionQuality;
  presenceSyncStatus?: PresenceSyncStatus;
  connectingStuck?: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSharing: boolean;
  userName: string;
  userColor: string;
  speakingPeers?: Record<string, boolean>;
  /** Peer with verified screen frames on the stage (red LIVE badge). */
  liveScreenPeerId?: string | null;
  onSelectRoom: (roomId: string) => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onStartShare: () => void;
  onStopShare: () => void;
  onDisconnect: () => void;
  onCopyLink: () => Promise<void> | void;
  onRetryConnection: () => void;
  onOpenSettings?: () => void;
}

function memberList(
  members: Array<{
    id: string;
    name: string;
    color: string;
    isSharingScreen?: boolean;
    disconnected?: boolean;
  }>,
  myId: string | null,
  speakingPeers: Record<string, boolean>,
  liveScreenPeerId: string | null = null
) {
  return members.map((p) => {
    const isSpeaking = Boolean(speakingPeers[p.id]);
    return (
      <li
        key={p.id}
        className={`flex items-center gap-2 rounded px-1 py-0.5 text-sm text-[#dbdee1] ${
          p.disconnected ? "opacity-50" : ""
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white transition-all duration-150 ${
            isSpeaking
              ? "ring-2 ring-[#23a559] ring-offset-1 ring-offset-[#2b2d31]"
              : ""
          }`}
          style={{ backgroundColor: p.color }}
        >
          {initialFromName(p.name)}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {p.name}
          {p.id === myId ? ` ${t.you}` : ""}
        </span>
        {p.isSharingScreen && liveScreenPeerId === p.id && (
          <span className="rounded bg-[#ed4245] px-1 py-px text-[9px] font-bold tracking-wide text-white">
            {t.live}
          </span>
        )}
        {p.isSharingScreen && liveScreenPeerId !== p.id && (
          <span className="rounded bg-[#faa61a]/90 px-1 py-px text-[9px] font-bold tracking-wide text-[#1e1f22]">
            {t.screenShareAnnounced}
          </span>
        )}
      </li>
    );
  });
}

export function ChannelSidebar({
  rooms,
  activeRoomId,
  userPanelRoomLabel,
  occupancyByRoom,
  players,
  myId,
  connected,
  connectionStatus,
  connectionStatusRaw,
  connectionQuality,
  presenceSyncStatus = "idle",
  connectingStuck = false,
  isMuted,
  isDeafened,
  isSharing,
  userName,
  userColor,
  speakingPeers = {},
  liveScreenPeerId = null,
  onSelectRoom,
  onToggleMute,
  onToggleDeafen,
  onStartShare,
  onStopShare,
  onDisconnect,
  onCopyLink,
  onRetryConnection,
  onOpenSettings,
}: ChannelSidebarProps) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-[#2b2d31] text-[#dbdee1]">
      <header className="flex h-12 shrink-0 items-center border-b border-[#1f2023] px-4 shadow-sm">
        <h1 className="truncate text-[15px] font-semibold text-white">{t.appName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
          {t.voiceChannels}
        </p>
        <ul className="space-y-0.5">
          {rooms.map((room) => {
            const active = room.id === activeRoomId;
            const otherOccupants = occupancyByRoom[room.id] ?? [];
            const members = active
              ? players
              : otherOccupants.map((o) => ({
                  id: o.peerId,
                  name: o.name,
                  color: o.color,
                  isSharingScreen: o.isSharingScreen,
                }));
            const showMembers = active || members.length > 0;
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
                  {!active && members.length > 0 && (
                    <span
                      className="shrink-0 rounded-full bg-[#35373c] px-1.5 py-px text-[10px] font-semibold text-[#949ba4]"
                      title={t.roomMemberCount.replace("{n}", String(members.length))}
                    >
                      {members.length}
                    </span>
                  )}
                </button>
                {showMembers && (
                  <ul className="ml-6 mt-0.5 space-y-0.5">
                    {memberList(
                      members,
                      myId,
                      active ? speakingPeers : {},
                      active ? liveScreenPeerId : null
                    )}
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
        connectionStatus={connectionStatus}
        connectionStatusRaw={connectionStatusRaw}
        connectionQuality={connectionQuality}
        presenceSyncStatus={presenceSyncStatus}
        connectingStuck={connectingStuck}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isSharing={isSharing}
        roomLabel={userPanelRoomLabel}
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onStartShare={onStartShare}
        onStopShare={onStopShare}
        onDisconnect={onDisconnect}
        onCopyLink={onCopyLink}
        onRetryConnection={onRetryConnection}
        onOpenSettings={onOpenSettings}
      />
    </aside>
  );
}
