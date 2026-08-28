"use client";

import { useState } from "react";
import { JoinScreen } from "@/components/JoinScreen";
import { RoomView } from "@/components/RoomView";

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

  const handleLeave = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setName(null);
    window.location.href = window.location.pathname;
  };

  if (!name) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return <RoomView name={name} onLeave={handleLeave} />;
}
