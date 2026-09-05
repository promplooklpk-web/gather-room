"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { DEFAULT_ROOM_ID, findRoom, parseRoomFromUrl } from "@/lib/rooms";
import { isInAppBrowser } from "@/lib/peerConfig";
import { AVATAR_COLORS, initialFromName } from "@/lib/colors";

function subscribeRoom() {
  return () => {};
}

interface JoinScreenProps {
  onJoin: (name: string, color?: string) => void;
}

export function JoinScreen({ onJoin }: JoinScreenProps) {
  const [name, setName] = useState(() => {
    if (typeof window === "undefined") return "";
    return (
      localStorage.getItem("mtlclick-username") ||
      sessionStorage.getItem("gather-room-name") ||
      ""
    );
  });
  const [color, setColor] = useState(() => {
    if (typeof window === "undefined") return AVATAR_COLORS[0];
    const savedColor = localStorage.getItem("mtlclick-usercolor");
    if (savedColor && AVATAR_COLORS.includes(savedColor)) return savedColor;
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  });
  const [error, setError] = useState("");

  const roomId = useSyncExternalStore(
    subscribeRoom,
    parseRoomFromUrl,
    () => DEFAULT_ROOM_ID
  );
  const room = findRoom(roomId);
  const inApp = useMemo(() => isInAppBrowser(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t.nameRequired);
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("mtlclick-username", trimmed);
      localStorage.setItem("mtlclick-usercolor", color);
      sessionStorage.setItem("gather-room-name", trimmed);
    }
    onJoin(trimmed, color);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1e1f22] p-4">
      <div className="w-full max-w-md rounded-xl border border-[#1f2023] bg-[#2b2d31] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            {/* Live avatar preview */}
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg transition-colors"
              style={{ backgroundColor: color }}
            >
              {initialFromName(name || "M")}
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
              maxLength={25}
              className="w-full rounded-md border border-[#1f2023] bg-[#1e1f22] px-4 py-3 text-white placeholder:text-[#6d6f78] focus:border-[#5865f2] focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-[#ed4245]">{error}</p>}
          </div>

          {/* Avatar Color Picker */}
          <div>
            <label className="block mb-2 text-center text-xs font-medium text-[#949ba4]">
              {t.avatarColor}
            </label>
            <div className="flex justify-center gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === c
                      ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#2b2d31]"
                      : "opacity-75 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={c}
                />
              ))}
            </div>
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
