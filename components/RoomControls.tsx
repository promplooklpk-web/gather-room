"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface RoomControlsProps {
  isMuted: boolean;
  isSharing: boolean;
  onToggleMute: () => void;
  onStartShare: () => void;
  onStopShare: () => void;
  onCopyLink: () => void;
  onLeave: () => void;
}

export function RoomControls({
  isMuted,
  isSharing,
  onToggleMute,
  onStartShare,
  onStopShare,
  onCopyLink,
  onLeave,
}: RoomControlsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onToggleMute}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
          isMuted
            ? "bg-red-500/80 text-white hover:bg-red-500"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {isMuted ? "🔇 " + t.unmute : "🎤 " + t.mute}
      </button>

      {isSharing ? (
        <button
          onClick={onStopShare}
          className="rounded-lg bg-orange-500/80 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-500"
        >
          ⏹️ {t.stopShare}
        </button>
      ) : (
        <button
          onClick={onStartShare}
          className="rounded-lg bg-blue-500/80 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          🖥️ {t.shareScreen}
        </button>
      )}

      <button
        onClick={handleCopy}
        className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
      >
        🔗 {copied ? t.copied : t.copyLink}
      </button>

      <button
        onClick={onLeave}
        className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        {t.leaveRoom}
      </button>
    </div>
  );
}
