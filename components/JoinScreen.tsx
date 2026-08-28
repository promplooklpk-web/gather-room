"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface JoinScreenProps {
  onJoin: (name: string) => void;
}

export function JoinScreen({ onJoin }: JoinScreenProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🏢</div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="mt-1 text-sm text-emerald-200/70">{t.subtitle}</p>
        </div>

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
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-300">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-400 active:scale-[0.98]"
          >
            {t.enterRoom}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          {t.controls}
        </p>
      </div>
    </div>
  );
}
