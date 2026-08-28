"use client";

import { t } from "@/lib/i18n";

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
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#111214]/95 px-4 py-2 shadow-2xl ring-1 ring-[#1f2023]">
        {needsAudioUnlock && onUnlockAudio && (
          <button
            type="button"
            onClick={onUnlockAudio}
            className="rounded-full bg-[#5865f2] px-3 py-2 text-xs font-medium text-white"
          >
            🔊 {t.tapToUnmuteAudio}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleMute}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-lg transition ${
            isMuted
              ? "bg-[#ed4245] text-white"
              : "bg-[#383a40] text-white hover:bg-[#404249]"
          }`}
          title={isMuted ? t.unmute : t.mute}
          aria-label={isMuted ? t.unmute : t.mute}
        >
          {isMuted ? "🔇" : "🎤"}
        </button>
        <button
          type="button"
          disabled
          className="flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full bg-[#383a40] text-lg text-[#6d6f78]"
          title="Camera off"
          aria-label="Camera off"
        >
          📷
        </button>
        <button
          type="button"
          onClick={isSharing ? onStopShare : onStartShare}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-lg transition ${
            isSharing
              ? "bg-[#faa61a] text-white"
              : "bg-[#383a40] text-white hover:bg-[#404249]"
          }`}
          title={isSharing ? t.stopShare : t.shareScreen}
          aria-label={isSharing ? t.stopShare : t.shareScreen}
        >
          🖥️
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="flex h-12 items-center justify-center rounded-full bg-[#ed4245] px-5 text-sm font-semibold text-white hover:bg-[#c03537]"
        >
          {t.leave}
        </button>
      </div>
    </div>
  );
}
