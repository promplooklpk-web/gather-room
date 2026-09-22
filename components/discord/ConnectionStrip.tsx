"use client";

import type { ConnectionQuality, ConnectionStatus, PresenceSyncStatus } from "@/lib/types";
import { t } from "@/lib/i18n";
import {
  connectionHeadline,
  connectionQualityLabel,
  connectionStatusTone,
  shouldOfferReconnect,
} from "@/components/discord/connectionStatusUi";

type ConnectionStripLayout = "inline" | "banner";

export function ConnectionStrip({
  status,
  reconnectStatus,
  quality,
  presenceSyncStatus = "idle",
  connectingStuck = false,
  onRetry,
  layout = "inline",
  className = "",
}: {
  status: ConnectionStatus;
  /** Use raw (non-debounced) status for reconnect affordance when provided. */
  reconnectStatus?: ConnectionStatus;
  quality: ConnectionQuality;
  presenceSyncStatus?: PresenceSyncStatus;
  connectingStuck?: boolean;
  onRetry: () => void;
  layout?: ConnectionStripLayout;
  className?: string;
}) {
  const showRetry = shouldOfferReconnect(reconnectStatus ?? status);
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

  const pillClass = `flex min-w-0 items-center gap-2 rounded px-2 py-1 text-[12px] font-medium ${
    failed
      ? "bg-[#ed4245]/20 text-[#ed4245]"
      : ok
        ? "text-[#23a559]"
        : "bg-[#f0b232]/15 text-[#f0b232]"
  }`;

  const dotClass = `h-1.5 w-1.5 shrink-0 rounded-full ${
    failed ? "bg-[#ed4245]" : ok ? "bg-[#23a559]" : "bg-[#f0b232] animate-pulse"
  }`;

  const statusPill = (
    <div className={pillClass} title={headline}>
      <span className={dotClass} />
      <span className={layout === "banner" ? "text-left" : "truncate"}>{headline}</span>
      {ok && (
        <span
          className={`font-normal ${qualityTone} ${
            layout === "banner" ? "" : "hidden truncate sm:inline"
          }`}
        >
          {layout === "banner" ? " · " : "· "}
          {connectionQualityLabel(quality)}
        </span>
      )}
    </div>
  );

  const stuckHint =
    connectingStuck &&
    (status === "connecting" || status === "reconnecting") ? (
      <p className="text-[11px] leading-snug text-[#faa61a]">{t.stuckConnectingHint}</p>
    ) : null;

  const retryButton = showRetry ? (
    <button
      type="button"
      onClick={onRetry}
      className="shrink-0 rounded bg-[#5865f2] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4752c4]"
    >
      {t.reconnectNow}
    </button>
  ) : null;

  if (layout === "banner") {
    return (
      <div
        className={`flex shrink-0 flex-col gap-2 border-b border-[#1f2023] bg-[#313338] px-safe-3 py-2 sm:flex-row sm:items-center sm:justify-between md:px-safe-4 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          {statusPill}
          {stuckHint}
        </div>
        {retryButton}
      </div>
    );
  }

  return (
    <div
      className={`ml-auto flex min-w-0 max-w-[min(100%,14rem)] flex-row items-center gap-2 sm:max-w-none ${className}`}
    >
      {statusPill}
      {retryButton}
    </div>
  );
}

export {
  connectionHeadline,
  connectionQualityLabel,
  connectionStatusLabel,
  shouldShowConnectionBanner,
} from "@/components/discord/connectionStatusUi";
