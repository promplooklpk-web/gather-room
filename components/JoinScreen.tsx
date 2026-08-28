"use client";

import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { findRoom, parseRoomFromUrl } from "@/lib/rooms";
import { isInAppBrowser } from "@/lib/peerConfig";

interface JoinScreenProps {
  onJoin: (name: string) => void;
}

export function JoinScreen({ onJoin }: JoinScreenProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const room = useMemo(() => findRoom(parseRoomFromUrl()), []);
  const inApp = useMemo(() => isInAppBrowser(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t.nameRequired);
      return;
    }
    onJoin(trimmed);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1e1f22] p-4">
      <div className="w-full max-w-md rounded-lg border border-[#1f2023] bg-[#2b2d31] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5865f2] text-2xl font-bold text-white">
              M
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">{t.appName}</h1>
          <p className="mt-1 text-sm text-[#949ba4]">{t.subtitle}</p>
          {room && (
            <p className="mt-3 text-sm text-[#dbdee1]">
              {t.joiningRoom}:{" "}
              <span className="font-semibold text-white">
                {room.labelTh} / {room.label}
              </span>
            </p>
          )}
          <p className="mt-1 text-xs text-[#6d6f78]">{t.sameLinkHint}</p>
        </div>

        {inApp && (
          <div className="mb-4 rounded-md border border-[#faa61a]/40 bg-[#faa61a]/15 px-3 py-2 text-sm text-[#faa61a]">
            {t.openInSafari}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder={t.namePlaceholder}
              maxLength={20}
              className="w-full rounded-md border border-[#1f2023] bg-[#1e1f22] px-4 py-3 text-white placeholder:text-[#6d6f78] focus:border-[#5865f2] focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-[#ed4245]">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-[#5865f2] py-3 font-semibold text-white transition hover:bg-[#4752c4]"
          >
            {t.enterRoom}
          </button>
        </form>
      </div>
    </div>
  );
}
