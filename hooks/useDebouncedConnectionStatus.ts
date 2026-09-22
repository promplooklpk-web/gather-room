"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/types";

const STATUS_RANK: Record<ConnectionStatus, number> = {
  connected: 0,
  connecting: 1,
  reconnecting: 2,
  disconnected: 3,
  failed: 4,
};

function debounceMs(next: ConnectionStatus, prev: ConnectionStatus): number {
  if (next === "connected") return 450;
  if (next === "failed" || next === "disconnected") return 220;
  if (prev === "connected" && (next === "reconnecting" || next === "connecting")) {
    return 650;
  }
  return 400;
}

/** Smooth UI status without hiding hard failures. */
export function useDebouncedConnectionStatus(
  raw: ConnectionStatus,
  resetKey = 0
): ConnectionStatus {
  const [display, setDisplay] = useState(raw);

  useEffect(() => {
    setDisplay(raw);
  }, [resetKey]);

  useEffect(() => {
    if (raw === display) return;

    const rankNext = STATUS_RANK[raw];
    const rankPrev = STATUS_RANK[display];
    if (rankNext > rankPrev) {
      setDisplay(raw);
      return;
    }

    const delay = debounceMs(raw, display);
    const timer = window.setTimeout(() => setDisplay(raw), delay);
    return () => window.clearTimeout(timer);
  }, [raw, display, resetKey]);

  return display;
}
