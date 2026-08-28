"use client";

import { t } from "@/lib/i18n";
import {
  CameraOffIcon,
  MicIcon,
  MicOffIcon,
  PhoneDisconnectIcon,
  ScreenShareIcon,
  ScreenShareStopIcon,
} from "@/components/discord/icons";

interface FloatingControlBarProps {
  isMuted: boolean;
  isSharing: boolean;
  onToggleMute: () => void;
  onStartShare: () => void;
  onStopShare: () => void;
  onLeave: () => void;
  onUnlockAudio?: () => void;
  needsAudioUnlock?: boolean;
}

export function FloatingControlBar({
  isMuted,
  isSharing,
  onToggleMute,
  onStartShare,
  onStopShare,
  onLeave,
  onUnlockAudio,
  needsAudioUnlock,
}: FloatingControlBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-[28px] bg-[#111214]/95 px-3 py-2 shadow-2xl ring-1 ring-white/10">
        {needsAudioUnlock && onUnlockAudio && (
          <button
            type="button"
            onClick={onUnlockAudio}
            className="rounded-full bg-[#5865f2] px-3 py-2 text-xs font-medium text-white"
          >
            {t.tapToUnmuteAudio}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleMute}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
            isMuted
              ? "bg-[#ed4245] text-white"
              : "bg-[#2b2d31] text-white hover:bg-[#3a3c43]"
          }`}
          title={isMuted ? t.unmute : t.mute}
          aria-label={isMuted ? t.unmute : t.mute}
        >
          {isMuted ? <MicOffIcon /> : <MicIcon />}
        </button>
        <button
          type="button"
          disabled
          className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full bg-[#2b2d31] text-[#6d6f78]"
          title={t.cameraOff}
          aria-label={t.cameraOff}
        >
          <CameraOffIcon />
        </button>
        <button
          type="button"
          onClick={isSharing ? onStopShare : onStartShare}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
            isSharing
              ? "bg-[#ed4245] text-white"
              : "bg-[#2b2d31] text-white hover:bg-[#3a3c43]"
          }`}
          title={isSharing ? t.stopShare : t.shareScreen}
          aria-label={isSharing ? t.stopShare : t.shareScreen}
        >
          {isSharing ? <ScreenShareStopIcon /> : <ScreenShareIcon />}
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="flex h-11 items-center justify-center rounded-full bg-[#ed4245] px-4 text-white hover:bg-[#c03537]"
          title={t.leave}
          aria-label={t.leave}
        >
          <PhoneDisconnectIcon width={20} height={20} />
          <span className="ml-2 text-sm font-semibold">{t.leave}</span>
        </button>
      </div>
    </div>
  );
}
