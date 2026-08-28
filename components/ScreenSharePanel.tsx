"use client";

import { t } from "@/lib/i18n";
import { RemoteVideo } from "@/components/RemoteVideo";

interface ScreenSharePanelProps {
  name: string;
  stream: MediaStream;
}

export function ScreenSharePanel({ name, stream }: ScreenSharePanelProps) {
  return (
    <div className="rounded-xl border border-blue-500/30 bg-black/40 p-2">
      <p className="mb-2 text-xs font-medium text-blue-300">
        {t.screenShareTitle} — {name}
      </p>
      <RemoteVideo
        stream={stream}
        className="min-h-[140px] w-full"
        label={`${t.screenShareTitle} ${name}`}
      />
    </div>
  );
}
