"use client";

import { t } from "@/lib/i18n";

export function ServerRail() {
  return (
    <aside className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-[#1e1f22] py-3">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5865f2] text-lg font-bold text-white shadow-md"
        title={t.appName}
      >
        M
      </div>
      <div className="h-0.5 w-8 rounded bg-[#35373c]" />
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#313338] text-xl text-white"
        title={t.title}
      >
        🏢
      </div>
    </aside>
  );
}
