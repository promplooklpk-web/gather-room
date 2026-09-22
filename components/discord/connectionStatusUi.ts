"use client";

import type { ConnectionQuality, ConnectionStatus, PresenceSyncStatus } from "@/lib/types";
import { t } from "@/lib/i18n";

const qualityLabel: Record<ConnectionQuality, string> = {
  good: t.qualityGood,
  fair: t.qualityFair,
  poor: t.qualityPoor,
  relay: t.qualityRelay,
};

export function voiceConnectionLabel(status: ConnectionStatus): string {
  if (status === "failed") return t.connectionFailed;
  if (status === "disconnected") return t.disconnected;
  if (status === "reconnecting") return t.reconnecting;
  if (status === "connecting") return t.connecting;
  return t.voiceConnected;
}

export function presenceSyncHint(status: PresenceSyncStatus): string | null {
  if (status === "connecting") return t.presenceSyncing;
  if (status === "error") return t.presenceSyncError;
  return null;
}

export function connectionHeadline(
  status: ConnectionStatus,
  presence: PresenceSyncStatus
): string {
  const voice = voiceConnectionLabel(status);
  const hint = presenceSyncHint(presence);
  return hint ? `${voice} · ${hint}` : voice;
}

/** Reconnect whenever voice is not fully up (stuck hint is separate). */
export function shouldOfferReconnect(status: ConnectionStatus): boolean {
  return status !== "connected";
}

/** Full-width banner below header (reserves layout space, avoids overlapping stage). */
export function shouldShowConnectionBanner(
  status: ConnectionStatus,
  presence: PresenceSyncStatus,
  connectingStuck: boolean,
  rawStatus?: ConnectionStatus
): boolean {
  if (shouldOfferReconnect(rawStatus ?? status)) return true;
  if (presence !== "idle") return true;
  if (connectingStuck) return true;
  return false;
}

export function connectionStatusLabel(status: ConnectionStatus) {
  return voiceConnectionLabel(status);
}

export function connectionQualityLabel(quality: ConnectionQuality) {
  return qualityLabel[quality];
}

export function connectionStatusTone(status: ConnectionStatus): "ok" | "warn" | "bad" {
  if (status === "connected") return "ok";
  if (status === "failed" || status === "disconnected") return "bad";
  return "warn";
}
