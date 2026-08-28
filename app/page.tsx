"use client";

import { useState } from "react";
import { JoinScreen } from "@/components/JoinScreen";
import { DiscordShell } from "@/components/discord/DiscordShell";

const STORAGE_KEY = "gather-room-name";

function readStoredName(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export default function HomePage() {
  const [name, setName] = useState<string | null>(readStoredName);

  const handleJoin = (playerName: string) => {
    sessionStorage.setItem(STORAGE_KEY, playerName);
    setName(playerName);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setName(null);
    window.location.reload();
  };

  if (!name) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return <DiscordShell userName={name} onLogout={handleLogout} />;
}
