"use client";

import type { ConnectionQuality, ConnectionStatus } from "@/lib/types";
import { t } from "@/lib/i18n";

const qualityLabel: Record<ConnectionQuality, string> = {
  good: t.qualityGood,
  fair: t.qualityFair,
  poor: t.qualityPoor,
  relay: t.qualityRelay,
};

function statusText(status: ConnectionStatus) {
  if (status === "failed") return t.connectionFailed;
  if (status === "reconnecting") return t.reconnecting;
  if (status === "connecting") return t.connecting;
  return t.voiceConnected;
}

export function ConnectionStrip({
  status,
  quality,
  onRetry,
}: {
  status: ConnectionStatus;
  quality: ConnectionQuality;
  onRetry: () => void;
}) {
  const showRetry = status === "reconnecting" || status === "failed";
  const failed = status === "failed";
  const ok = status === "connected";
  const qualityTone =
    quality === "good"
      ? "text-[#23a559]"
      : quality === "fair"
        ? "text-[#b5bac1]"
        : "text-[#f0b232]";

  return (
    <div className="ml-auto flex min-w-0 items-center gap-2">
      <div
        className={`flex min-w-0 items-center gap-2 rounded px-2 py-1 text-[12px] font-medium ${
          failed
            ? "bg-[#ed4245]/20 text-[#ed4245]"
            : ok
              ? "text-[#23a559]"
              : "bg-[#f0b232]/15 text-[#f0b232]"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            failed ? "bg-[#ed4245]" : ok ? "bg-[#23a559]" : "bg-[#f0b232]"
          }`}
        />
        <span className="truncate">{statusText(status)}</span>
        {ok && (
          <span className={`truncate font-normal ${qualityTone}`}>
            · {qualityLabel[quality]}
          </span>
        )}
      </div>
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded bg-[#5865f2] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#4752c4]"
        >
          {t.retryConnection}
        </button>
      )}
    </div>
  );
}

export function connectionStatusLabel(status: ConnectionStatus) {
  return statusText(status);
}

export function connectionQualityLabel(quality: ConnectionQuality) {
  return qualityLabel[quality];
}
