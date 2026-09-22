"use client";

import type { ConnectionQuality, ConnectionStatus, PresenceSyncStatus } from "@/lib/types";
import { t } from "@/lib/i18n";
import {
  connectionHeadline,
  connectionQualityLabel,
  connectionStatusTone,
  shouldOfferReconnect,
} from "@/components/discord/connectionStatusUi";

export function ConnectionStrip({
  status,
  quality,
  presenceSyncStatus = "idle",
  connectingStuck = false,
  onRetry,
}: {
  status: ConnectionStatus;
  quality: ConnectionQuality;
  presenceSyncStatus?: PresenceSyncStatus;
  connectingStuck?: boolean;
  onRetry: () => void;
}) {
  const showRetry = shouldOfferReconnect(status, connectingStuck);
  const tone = connectionStatusTone(status);
  const ok = tone === "ok";
  const failed = tone === "bad";
  const headline = connectionHeadline(status, presenceSyncStatus);
  const qualityTone =
    quality === "good"
      ? "text-[#23a559]"
      : quality === "fair"
        ? "text-[#b5bac1]"
        : "text-[#f0b232]";

  return (
    <div className="ml-auto flex min-w-0 max-w-[min(100%,20rem)] flex-col items-end gap-1 sm:max-w-none sm:flex-row sm:items-center sm:gap-2">
      <div
        className={`flex min-w-0 items-center gap-2 rounded px-2 py-1 text-[12px] font-medium ${
          failed
            ? "bg-[#ed4245]/20 text-[#ed4245]"
            : ok
              ? "text-[#23a559]"
              : "bg-[#f0b232]/15 text-[#f0b232]"
        }`}
        title={headline}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            failed ? "bg-[#ed4245]" : ok ? "bg-[#23a559]" : "bg-[#f0b232] animate-pulse"
          }`}
        />
        <span className="truncate">{headline}</span>
        {ok && (
          <span className={`hidden truncate font-normal sm:inline ${qualityTone}`}>
            · {connectionQualityLabel(quality)}
          </span>
        )}
      </div>
      {connectingStuck && status === "connecting" && (
        <p className="hidden text-[10px] leading-tight text-[#faa61a] sm:block">
          {t.stuckConnectingHint}
        </p>
      )}
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded bg-[#5865f2] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4752c4] sm:py-1"
        >
          {t.reconnectNow}
        </button>
      )}
    </div>
  );
}

export {
  connectionHeadline,
  connectionQualityLabel,
  connectionStatusLabel,
} from "@/components/discord/connectionStatusUi";
