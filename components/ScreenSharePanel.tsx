"use client";

import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";

interface ScreenSharePanelProps {
  name: string;
  stream: MediaStream;
}

export function ScreenSharePanel({ name, stream }: ScreenSharePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="rounded-xl border border-blue-500/30 bg-black/40 p-2">
      <p className="mb-1 text-xs text-blue-300">
        {t.screenShareTitle} — {name}
      </p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-lg bg-black"
      />
    </div>
  );
}
