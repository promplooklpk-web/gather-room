"use client";

import type { PlayerState } from "@/lib/types";
import { RemoteVideo } from "@/components/RemoteVideo";
import { t } from "@/lib/i18n";

interface ParticipantTilesProps {
  players: PlayerState[];
  myId: string | null;
}

export function ParticipantTiles({ players, myId }: ParticipantTilesProps) {
  if (players.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-3">
      {players.map((p) => (
        <div
          key={p.id}
          className="flex min-w-[100px] flex-col items-center gap-1 rounded-lg bg-[#2b2d31] px-3 py-2"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.name.charAt(0).toUpperCase()}
          </div>
          <span className="max-w-[90px] truncate text-xs text-[#dbdee1]">
            {p.name}
            {p.id === myId ? ` ${t.you}` : ""}
          </span>
          {p.isSharingScreen && (
            <span className="text-[10px] text-[#23a559]">🖥️ {t.live}</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface ScreenStageProps {
  remoteScreen: { name: string; stream: MediaStream } | null;
  isSharing: boolean;
  someoneSharing: boolean;
}

export function ScreenStage({
  remoteScreen,
  isSharing,
  someoneSharing,
}: ScreenStageProps) {
  if (isSharing) {
    return (
      <div className="border-b border-[#1f2023] bg-[#1e1f22] px-4 py-2 text-center text-sm text-[#faa61a]">
        🖥️ {t.sharingActive}
      </div>
    );
  }

  if (remoteScreen) {
    return (
      <div className="border-b border-[#1f2023] bg-black p-2">
        <p className="mb-1 px-2 text-xs text-[#949ba4]">
          {t.screenShareTitle} — {remoteScreen.name}
        </p>
        <RemoteVideo
          stream={remoteScreen.stream}
          className="mx-auto max-h-[40vh] w-full max-w-4xl"
          label={t.screenShareTitle}
        />
      </div>
    );
  }

  if (someoneSharing) {
    return (
      <div className="border-b border-[#1f2023] bg-[#2b2d31] px-4 py-3 text-center text-sm text-[#949ba4]">
        {t.waitingForShare}
      </div>
    );
  }

  return null;
}
