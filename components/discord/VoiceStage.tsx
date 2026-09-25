"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerState } from "@/lib/types";
import { RemoteVideo } from "@/components/RemoteVideo";
import { t } from "@/lib/i18n";
import { initialFromName } from "@/lib/colors";
import { useVerifiedDisplayStream } from "@/components/useVerifiedDisplayStream";
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
  /** Only show the green share icon for peers with a verified stage stream */
  liveScreenPeerId?: string | null;
}

type TileDensity = "single" | "duo" | "crowded";

function tileDensity(playerCount: number, compact: boolean): TileDensity {
  if (compact) return "crowded";
  if (playerCount <= 1) return "single";
  if (playerCount === 2) return "duo";
  return "crowded";
}

function tilesContainerClass(density: TileDensity, compact: boolean): string {
  if (compact) {
    return "flex flex-wrap gap-2 p-0";
  }
  switch (density) {
    case "single":
      return "flex w-full justify-center p-2 md:p-3";
    case "duo":
      return "grid w-full max-w-5xl grid-cols-2 gap-2 p-2 md:gap-3 md:p-3";
    case "crowded":
      return "grid w-full max-w-5xl grid-cols-2 gap-2 p-2 sm:grid-cols-2 md:grid-cols-3 md:gap-3 md:p-3 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]";
  }
}

function tileClass(density: TileDensity, compact: boolean): string {
  if (compact) {
    return "h-[76px] w-[132px]";
  }
  switch (density) {
    case "single":
      return "aspect-video w-full max-w-[min(100%,760px)] min-h-[min(52vh,280px)]";
    case "duo":
      return "aspect-[4/3] w-full min-h-[120px] max-h-[min(38vh,220px)] md:aspect-video md:min-h-[180px] md:max-h-none";
    case "crowded":
      return "aspect-[4/3] w-full min-h-[96px] max-h-[min(28vh,168px)] md:aspect-video md:min-h-[160px] md:max-h-[520px] md:min-w-[200px]";
  }
}

function avatarClass(density: TileDensity, compact: boolean): string {
  if (compact) {
    return "h-10 w-10 text-base";
  }
  switch (density) {
    case "single":
      return "h-20 w-20 text-3xl md:h-24 md:w-24 md:text-4xl";
    case "duo":
      return "h-14 w-14 text-xl md:h-16 md:w-16 md:text-2xl";
    case "crowded":
      return "h-11 w-11 text-base md:h-16 md:w-16 md:text-2xl";
  }
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
  liveScreenPeerId = null,
}: ParticipantTilesProps) {
  const [activeVolumePeerId, setActiveVolumePeerId] = useState<string | null>(null);

  if (players.length === 0) return null;

  const density = tileDensity(players.length, compact);
  const containerClass = tilesContainerClass(density, compact);

  return (
    <div className={containerClass}>
      {players.map((p) => {
        const isMe = p.id === myId;
        const tileMuted = isMe && (isMuted || isDeafened);
        const isSpeaking = Boolean(speakingPeers[p.id]);
        const currentVolume = userVolumes[p.id] ?? 100;
        const showVolumePopup = activeVolumePeerId === p.id && !isMe;
        const showShareIcon = liveScreenPeerId === p.id;

        return (
          <div
            key={p.id}
            className={`relative overflow-hidden rounded-lg bg-[#1e1f22] transition-all duration-150 ${
              isSpeaking
                ? "ring-2 ring-[#23a559] shadow-[0_0_12px_rgba(35,165,89,0.45)]"
                : "ring-1 ring-black/40"
            } ${
              p.disconnected ? "opacity-50" : ""
            } ${tileClass(density, compact)}`}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <div
                className={`flex items-center justify-center rounded-full font-bold text-white transition-all duration-150 ${
                  isSpeaking ? "ring-4 ring-[#23a559]" : ""
                } ${avatarClass(density, compact)}`}
                style={{ backgroundColor: p.color }}
              >
                {initialFromName(p.name)}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1">
              <div className="flex min-w-0 items-center gap-1.5">
                {tileMuted && (
                  <span className="text-[#ed4245]">
                    <MicOffIcon width={12} height={12} />
                  </span>
                )}
                {showShareIcon && (
                  <span className="text-[#23a559]">
                    <ScreenShareIcon width={12} height={12} />
                  </span>
                )}
                <span className="truncate text-[11px] font-medium text-white">
                  {p.name}
                  {isMe ? ` ${t.you}` : ""}
                </span>
              </div>

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
  remoteScreen: { peerId: string; name: string; stream: MediaStream } | null;
  localScreen: MediaStream | null;
  isSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  speakingPeers?: Record<string, boolean>;
  userVolumes?: Record<string, number>;
  onSetUserVolume?: (peerId: string, volume: number) => void;
  onExitScreenStage?: () => void;
  /** Sharer announced via signaling/presence but stage has no frames yet */
  screenShareWaitPeerId?: string | null;
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
  speakingPeers = {},
  userVolumes = {},
  onSetUserVolume,
  onExitScreenStage,
  screenShareWaitPeerId = null,
}: ScreenStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const candidateStream = remoteScreen?.stream ?? localScreen ?? null;
  const verifiedStream = useVerifiedDisplayStream(candidateStream, onExitScreenStage);

  const liveScreenPeerId =
    verifiedStream && remoteScreen?.stream === verifiedStream
      ? remoteScreen.peerId
      : verifiedStream && localScreen === verifiedStream
        ? myId
        : null;

  const sharerName =
    (remoteScreen?.stream === verifiedStream ? remoteScreen.name : undefined) ??
    (isSharing && localScreen === verifiedStream
      ? players.find((p) => p.id === myId)?.name
      : undefined);
  const quality = verifiedStream ? streamQualityLabel(verifiedStream) : "";
  const showingShare = Boolean(verifiedStream);

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

  useEffect(() => {
    if (!showingShare || !onExitScreenStage) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExitScreenStage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showingShare, onExitScreenStage]);

  if (!showingShare) {
    const others = players.filter((p) => p.id !== myId);
    const waitingAlone = players.length === 0 || others.length === 0;
    const pendingSharer = screenShareWaitPeerId
      ? players.find((p) => p.id === screenShareWaitPeerId)
      : players.find(
          (p) => p.id !== myId && p.isSharingScreen && p.id !== liveScreenPeerId
        );

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={`relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-safe-3 pb-stage-controls pt-3 md:px-6 md:pt-6 ${
            waitingAlone ? "items-center justify-center" : "items-stretch justify-start md:items-center md:justify-center"
          }`}
        >
          {pendingSharer && (
            <div
              className="mx-auto mb-4 max-w-lg rounded-lg border border-[#ed4245]/40 bg-[#ed4245]/10 px-4 py-3 text-center text-sm text-[#f2f3f5]"
              role="status"
            >
              <p className="font-medium text-white">
                {t.someonesScreen.replace("{name}", pendingSharer.name)}
              </p>
              <p className="mt-1 text-[#b5bac1]">{t.screenShareConnecting}</p>
            </div>
          )}
          {waitingAlone ? (
            <>
              {players.length > 0 && (
                <div className="mb-4 flex w-full justify-center md:mb-6">
                  <ParticipantTiles
                    players={players}
                    myId={myId}
                    isMuted={isMuted}
                    isDeafened={isDeafened}
                    speakingPeers={speakingPeers}
                    userVolumes={userVolumes}
                    onSetUserVolume={onSetUserVolume}
                    liveScreenPeerId={liveScreenPeerId}
                  />
                </div>
              )}
              <p className="px-2 text-center text-sm text-[#949ba4]">{t.waitingForPeople}</p>
            </>
          ) : (
            <ParticipantTiles
              players={players}
              myId={myId}
              isMuted={isMuted}
              isDeafened={isDeafened}
              speakingPeers={speakingPeers}
              userVolumes={userVolumes}
              onSetUserVolume={onSetUserVolume}
              liveScreenPeerId={liveScreenPeerId}
            />
          )}
        </div>
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
        <div className="pointer-events-auto flex items-center gap-2">
          {quality ? (
            <span className="rounded bg-black/50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
              {quality}
            </span>
          ) : null}
          {onExitScreenStage && (
            <button
              type="button"
              onClick={onExitScreenStage}
              className="rounded bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-black/70"
            >
              {t.exitScreenView}
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {verifiedStream ? (
          <RemoteVideo
            stream={verifiedStream}
            className="h-full w-full"
            label={t.screenShareTitle}
          />
        ) : null}
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
            liveScreenPeerId={liveScreenPeerId}
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
