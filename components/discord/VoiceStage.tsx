"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerState } from "@/lib/types";
import { RemoteVideo } from "@/components/RemoteVideo";
import { t } from "@/lib/i18n";
import { initialFromName } from "@/lib/colors";
import {
  ExitFullscreenIcon,
  FullscreenIcon,
  MicOffIcon,
  ScreenShareIcon,
} from "@/components/discord/icons";

interface ParticipantTilesProps {
  players: PlayerState[];
  myId: string | null;
  compact?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}

export function ParticipantTiles({
  players,
  myId,
  compact = false,
  isMuted = false,
  isDeafened = false,
}: ParticipantTilesProps) {
  if (players.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-2 ${compact ? "p-0" : "justify-center p-3"}`}
    >
      {players.map((p) => {
        const isMe = p.id === myId;
        const tileMuted = isMe && (isMuted || isDeafened);
        return (
          <div
            key={p.id}
            className={`relative overflow-hidden rounded-lg bg-[#1e1f22] ring-1 ring-black/40 ${
              compact
                ? "h-[72px] w-[128px]"
                : players.length === 1
                  ? "aspect-video w-[min(100%,760px)] min-h-[280px]"
                  : "aspect-video min-h-[180px] min-w-[240px] flex-1 basis-[280px] max-w-[520px]"
            }`}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <div
                className={`flex items-center justify-center rounded-full font-bold text-white ${
                  compact
                    ? "h-10 w-10 text-base"
                    : players.length === 1
                      ? "h-24 w-24 text-4xl"
                      : "h-16 w-16 text-2xl"
                }`}
                style={{ backgroundColor: p.color }}
              >
                {initialFromName(p.name)}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/55 px-2 py-1">
              {tileMuted && (
                <span className="text-[#ed4245]">
                  <MicOffIcon width={12} height={12} />
                </span>
              )}
              {p.isSharingScreen && (
                <span className="text-[#23a559]">
                  <ScreenShareIcon width={12} height={12} />
                </span>
              )}
              <span className="truncate text-[11px] text-white">
                {p.name}
                {isMe ? ` ${t.you}` : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ScreenStageProps {
  players: PlayerState[];
  myId: string | null;
  roomLabel: string;
  remoteScreen: { name: string; stream: MediaStream } | null;
  localScreen: MediaStream | null;
  isSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  someoneSharing: boolean;
}

function streamQualityLabel(stream: MediaStream | null): string {
  const track = stream?.getVideoTracks()[0];
  const settings = track?.getSettings();
  if (!settings?.height) return t.live;
  return `${settings.height}p ${Math.round(settings.frameRate ?? 30)}FPS ${t.live}`;
}

export function ScreenStage({
  players,
  myId,
  roomLabel,
  remoteScreen,
  localScreen,
  isSharing,
  isMuted,
  isDeafened,
  someoneSharing,
}: ScreenStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mainStream = remoteScreen?.stream ?? localScreen ?? null;
  const sharerName =
    remoteScreen?.name ??
    (isSharing ? players.find((p) => p.id === myId)?.name : undefined);
  const quality = streamQualityLabel(mainStream);
  const showingShare = Boolean(mainStream || isSharing || someoneSharing);

  const toggleFullscreen = useCallback(async () => {
    const node = stageRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await node.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!showingShare) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-28 pt-6">
        {players.length === 0 ? (
          <p className="text-sm text-[#949ba4]">{t.waitingForPeople}</p>
        ) : (
          <div className="flex w-full max-w-5xl justify-center">
            <ParticipantTiles
              players={players}
              myId={myId}
              isMuted={isMuted}
              isDeafened={isDeafened}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-0 flex-1 flex-col bg-black"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{roomLabel}</p>
          {sharerName && (
            <p className="truncate text-xs text-[#b5bac1]">
              {t.someonesScreen.replace("{name}", sharerName)}
            </p>
          )}
        </div>
        <span className="rounded bg-black/50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
          {quality || t.live}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {mainStream ? (
          <RemoteVideo
            stream={mainStream}
            className="h-full w-full"
            label={t.screenShareTitle}
          />
        ) : isSharing ? (
          <p className="px-6 text-center text-sm text-[#faa61a]">
            🖥️ {t.sharingActive}
          </p>
        ) : (
          <p className="px-6 text-center text-sm text-[#949ba4]">
            {t.waitingForShare}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex items-end justify-between px-4">
        <div className="pointer-events-auto flex max-w-[80%] flex-wrap items-end gap-2">
          {mainStream && (
            <div className="h-[72px] w-[128px] overflow-hidden rounded-lg ring-2 ring-[#23a559]">
              <RemoteVideo
                stream={mainStream}
                className="h-full w-full"
                label={t.screenShareTitle}
              />
            </div>
          )}
          <ParticipantTiles
            players={players}
            myId={myId}
            compact
            isMuted={isMuted}
            isDeafened={isDeafened}
          />
        </div>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="pointer-events-auto mb-2 rounded bg-black/55 p-2 text-white hover:bg-black/80"
          title={isFullscreen ? t.exitFullscreen : t.fullscreen}
          aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
        >
          {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </button>
      </div>
    </div>
  );
}
