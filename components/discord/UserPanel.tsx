"use client";

import { useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { initialFromName } from "@/lib/colors";
import type { ConnectionQuality, ConnectionStatus } from "@/lib/types";
import {
  connectionQualityLabel,
  connectionStatusLabel,
} from "@/components/discord/ConnectionStrip";
import {
  ActivitiesIcon,
  CameraBadgeIcon,
  CameraOffIcon,
  GearIcon,
  HeadphonesIcon,
  HeadphonesOffIcon,
  MicIcon,
  MicOffIcon,
  PhoneDisconnectIcon,
  ScreenShareIcon,
  ScreenShareStopIcon,
  SignalIcon,
  SoundboardIcon,
  WaveformIcon,
} from "@/components/discord/icons";

interface UserPanelProps {
  userName: string;
  userColor: string;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  connectionQuality: ConnectionQuality;
  isMuted: boolean;
  isDeafened: boolean;
  isSharing: boolean;
  roomLabel: string;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onStartShare: () => void;
  onStopShare: () => void;
  onDisconnect: () => void;
  onCopyLink: () => Promise<void> | void;
  onRetryConnection: () => void;
  onOpenSettings?: () => void;
}

function IconButton({
  label,
  active,
  danger,
  success,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  success?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const tone = disabled
    ? "cursor-not-allowed bg-[#2b2d31] text-[#6d6f78]"
    : danger
      ? "bg-[#ed4245]/25 text-[#ed4245] hover:bg-[#ed4245]/40"
      : success
        ? "bg-[#23a559] text-white hover:bg-[#1e8e4b]"
        : active
          ? "bg-[#ed4245] text-white hover:bg-[#c03537]"
          : "bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c] hover:text-white";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 flex-1 items-center justify-center rounded-[4px] transition ${tone}`}
    >
      {children}
    </button>
  );
}

export function UserPanel({
  userName,
  userColor,
  connected,
  connectionStatus,
  connectionQuality,
  isMuted,
  isDeafened,
  isSharing,
  roomLabel,
  onToggleMute,
  onToggleDeafen,
  onStartShare,
  onStopShare,
  onDisconnect,
  onCopyLink,
  onRetryConnection,
  onOpenSettings,
}: UserPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopyLink();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="border-t border-[#1f2023] bg-[#232428]">
      {isSharing && (
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#23a559] text-sm font-bold text-white">
            S
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[#111214] text-white">
              <CameraBadgeIcon width={10} height={10} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {t.screenOne}
            </p>
            <p className="truncate text-[11px] text-[#949ba4]">
              {userName}
            </p>
          </div>
          <button
            type="button"
            onClick={onStopShare}
            className="rounded p-1 text-[#dbdee1] hover:bg-[#35373c] hover:text-white"
            title={t.stopShare}
            aria-label={t.stopShare}
          >
            <ScreenShareStopIcon width={16} height={16} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 pb-1 pt-2">
        <SignalIcon
          className={
            connectionStatus === "connected"
              ? "text-[#23a559]"
              : connectionStatus === "failed"
                ? "text-[#ed4245]"
                : "text-[#faa61a]"
          }
          width={18}
          height={18}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] font-semibold leading-tight ${
              connectionStatus === "connected"
                ? "text-[#23a559]"
                : connectionStatus === "failed"
                  ? "text-[#ed4245]"
                  : "text-[#faa61a]"
            }`}
          >
            {connectionStatusLabel(connectionStatus)}
          </p>
          <p className="truncate text-[11px] leading-tight text-[#949ba4]">
            {connectionStatus === "connected"
              ? `${connectionQualityLabel(connectionQuality)} · ${roomLabel}`
              : `${roomLabel} / ${t.appName}`}
          </p>
        </div>
        {(connectionStatus === "reconnecting" ||
          connectionStatus === "failed") && (
          <button
            type="button"
            onClick={onRetryConnection}
            className="rounded bg-[#5865f2] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#4752c4]"
          >
            {t.retryConnection}
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded p-1 text-[#dbdee1] hover:bg-[#35373c] hover:text-white"
          title={copied ? t.copied : t.copyLink}
          aria-label={copied ? t.copied : t.copyLink}
        >
          <WaveformIcon width={16} height={16} />
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          className="rounded p-1 text-[#dbdee1] hover:bg-[#35373c] hover:text-[#ed4245]"
          title={t.disconnect}
          aria-label={t.disconnect}
        >
          <PhoneDisconnectIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <IconButton label={t.cameraOff} disabled>
          <CameraOffIcon width={18} height={18} />
        </IconButton>
        <IconButton
          label={isSharing ? t.stopShare : t.shareScreen}
          success={isSharing}
          onClick={isSharing ? onStopShare : onStartShare}
        >
          {isSharing ? (
            <ScreenShareStopIcon width={18} height={18} />
          ) : (
            <ScreenShareIcon width={18} height={18} />
          )}
        </IconButton>
        <IconButton label={t.activities} disabled>
          <ActivitiesIcon width={18} height={18} />
        </IconButton>
        <IconButton label={t.soundboard} disabled>
          <SoundboardIcon width={18} height={18} />
        </IconButton>
      </div>

      <div className="flex items-center gap-1 bg-[#232428] px-2 py-1.5">
        <div className="relative mr-1 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: userColor }}
          >
            {initialFromName(userName)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#232428] bg-[#23a559]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            {userName}
          </p>
          <p
            className={`truncate text-[11px] leading-tight ${
              isSharing ? "text-[#23a559]" : "text-[#949ba4]"
            }`}
          >
            {isSharing ? t.sharingTheirScreen : connected ? t.inRoom : connectionStatusLabel(connectionStatus)}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          className={`rounded p-1.5 ${
            isMuted || isDeafened
              ? "bg-[#ed4245]/20 text-[#ed4245] hover:bg-[#ed4245]/30"
              : "text-[#dbdee1] hover:bg-[#35373c] hover:text-white"
          }`}
          title={isMuted ? t.unmute : t.mute}
          aria-label={isMuted ? t.unmute : t.mute}
        >
          {isMuted || isDeafened ? (
            <MicOffIcon width={18} height={18} />
          ) : (
            <MicIcon width={18} height={18} />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleDeafen}
          className={`rounded p-1.5 ${
            isDeafened
              ? "bg-[#ed4245]/20 text-[#ed4245] hover:bg-[#ed4245]/30"
              : "text-[#dbdee1] hover:bg-[#35373c] hover:text-white"
          }`}
          title={isDeafened ? t.undeafen : t.deafen}
          aria-label={isDeafened ? t.undeafen : t.deafen}
        >
          {isDeafened ? (
            <HeadphonesOffIcon width={18} height={18} />
          ) : (
            <HeadphonesIcon width={18} height={18} />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            if (onOpenSettings) onOpenSettings();
            else void handleCopy();
          }}
          className="rounded p-1.5 text-[#dbdee1] hover:bg-[#35373c] hover:text-white"
          title={t.settings}
          aria-label={t.settings}
        >
          <GearIcon width={18} height={18} />
        </button>
      </div>
    </div>
  );
}
