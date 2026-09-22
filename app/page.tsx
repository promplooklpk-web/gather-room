"use client";

import { useEffect, useState } from "react";
import { JoinScreen } from "@/components/JoinScreen";
import { DiscordShell } from "@/components/discord/DiscordShell";

const SESSION_STORAGE_KEY = "gather-room-name";
const LOCAL_STORAGE_KEY = "mtlclick-username";

function readStoredName(): string | null {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem(SESSION_STORAGE_KEY) ||
    localStorage.getItem(LOCAL_STORAGE_KEY)
  );
}

export default function HomePage() {
  const [name, setName] = useState<string | null>(readStoredName);

  // Recover in-room session after iOS tab suspend / brief offline (sessionStorage may clear).
  useEffect(() => {
    const restore = () => {
      const stored = readStoredName();
      if (stored) setName(stored);
    };
    restore();
    document.addEventListener("visibilitychange", restore);
    window.addEventListener("pageshow", restore);
    return () => {
      document.removeEventListener("visibilitychange", restore);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  const handleJoin = (playerName: string) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, playerName);
    localStorage.setItem(LOCAL_STORAGE_KEY, playerName);
    setName(playerName);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setName(null);
    window.location.reload();
  };

  if (!name) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return <DiscordShell userName={name} onLogout={handleLogout} />;
}
