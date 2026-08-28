"use client";

import type { PlayerState } from "@/lib/types";
import { t } from "@/lib/i18n";

interface PeopleListProps {
  players: PlayerState[];
  myId: string | null;
}

export function PeopleList({ players, myId }: PeopleListProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
        {t.participants} ({players.length})
      </h3>
      <ul className="space-y-1.5">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-white/90"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="truncate">
              {p.name}
              {p.id === myId && (
                <span className="ml-1 text-emerald-300">{t.you}</span>
              )}
            </span>
            {p.isSharingScreen && <span className="text-xs">🖥️</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
