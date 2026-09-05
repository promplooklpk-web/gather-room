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
  speakingPeers?: Record<string, boolean>;
  userVolumes?: Record<string, number>;
  onSetUserVolume?: (peerId: string, volume: number) => void;
}

export function ParticipantTiles({
  players,
  myId,
  compact = false,
  isMuted = false,
  isDeafened = false,
  speakingPeers = {},
  userVolumes = {},
  onSetUserVolume,
}: ParticipantTilesProps) {
  const [activeVolumePeerId, setActiveVolumePeerId] = useState<string | null>(null);

  if (players.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-2 ${compact ? "p-0" : "justify-center p-3"}`}
    >
      {players.map((p) => {
        const isMe = p.id === myId;
        const tileMuted = isMe && (isMuted || isDeafened);
        const isSpeaking = Boolean(speakingPeers[p.id]);
        const currentVolume = userVolumes[p.id] ?? 100;
        const showVolumePopup = activeVolumePeerId === p.id && !isMe;

        return (
          <div
            key={p.id}
            className={`relative overflow-hidden rounded-lg bg-[#1e1f22] transition-all duration-150 ${
              isSpeaking
                ? "ring-2 ring-[#23a559] shadow-[0_0_12px_rgba(35,165,89,0.45)]"
                : "ring-1 ring-black/40"
            } ${
              p.disconnected ? "opacity-50" : ""
            } ${
              compact
                ? "h-[76px] w-[132px]"
                : players.length === 1
                  ? "aspect-video w-[min(100%,760px)] min-h-[280px]"
                  : "aspect-video min-h-[180px] min-w-[240px] flex-1 basis-[280px] max-w-[520px]"
            }`}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <div
                className={`flex items-center justify-center rounded-full font-bold text-white transition-all duration-150 ${
                  isSpeaking ? "ring-4 ring-[#23a559]" : ""
                } ${
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

            {/* Bottom metadata strip */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1">
              <div className="flex min-w-0 items-center gap-1.5">
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
                <span className="truncate text-[11px] font-medium text-white">
                  {p.name}
                  {isMe ? ` ${t.you}` : ""}
                </span>
              </div>

              {/* Volume button for remote peers */}
              {!isMe && onSetUserVolume && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVolumePeerId(showVolumePopup ? null : p.id)
                    }
                    className="flex h-5 w-5 items-center justify-center rounded text-[#949ba4] hover:bg-white/10 hover:text-white"
                    title={t.userVolume}
                    aria-label={t.userVolume}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  </button>

                  {/* Volume Slider Popover */}
                  {showVolumePopup && (
                    <div className="absolute bottom-6 right-0 z-30 flex w-36 flex-col gap-1.5 rounded-lg border border-[#1f2023] bg-[#2b2d31] p-2.5 shadow-xl">
                      <div className="flex items-center justify-between text-[10px] text-[#dbdee1]">
                        <span>{t.userVolume}</span>
                        <span className="font-semibold text-white">{currentVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={currentVolume}
                        onChange={(e) => onSetUserVolume(p.id, Number(e.target.value))}
                        className="h-1.5 w-full cursor-pointer accent-[#5865f2]"
                      />
                    </div>
                  )}
                </div>
              )}
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
  speakingPeers?: Record<string, boolean>;
  userVolumes?: Record<string, number>;
  onSetUserVolume?: (peerId: string, volume: number) => void;
}

function streamQualityLabel(stream: MediaStream | null): string {
  const track = stream?.getVideoTracks()[0];
  const settings = track?.getSettings();
  if (!settings?.height) return t.live;
  return `${settings.height}p ${t.live}`;
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
  speakingPeers = {},
  userVolumes = {},
  onSetUserVolume,
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
    const others = players.filter((p) => p.id !== myId);
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-28 pt-6">
        {players.length === 0 || others.length === 0 ? (
          <>
            {players.length > 0 && (
              <div className="mb-6 flex w-full max-w-5xl justify-center">
                <ParticipantTiles
                  players={players}
                  myId={myId}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  speakingPeers={speakingPeers}
                  userVolumes={userVolumes}
                  onSetUserVolume={onSetUserVolume}
                />
              </div>
            )}
            <p className="text-sm text-[#949ba4]">{t.waitingForPeople}</p>
          </>
        ) : (
          <div className="flex w-full max-w-5xl justify-center">
            <ParticipantTiles
              players={players}
              myId={myId}
              isMuted={isMuted}
              isDeafened={isDeafened}
              speakingPeers={speakingPeers}
              userVolumes={userVolumes}
              onSetUserVolume={onSetUserVolume}
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
          <ParticipantTiles
            players={players}
            myId={myId}
            compact
            isMuted={isMuted}
            isDeafened={isDeafened}
            speakingPeers={speakingPeers}
            userVolumes={userVolumes}
            onSetUserVolume={onSetUserVolume}
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
