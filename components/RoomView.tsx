"use client";

import { useEffect } from "react";
import { usePeerRoom } from "@/hooks/usePeerRoom";
import { GameCanvas } from "@/components/GameCanvas";
import { PeopleList } from "@/components/PeopleList";
import { RoomControls } from "@/components/RoomControls";
import { ScreenSharePanel } from "@/components/ScreenSharePanel";
import { TouchJoystick } from "@/components/TouchJoystick";
import { t } from "@/lib/i18n";

interface RoomViewProps {
  name: string;
  onLeave: () => void;
}

export function RoomView({ name, onLeave }: RoomViewProps) {
  const {
    myId,
    players,
    connected,
    error,
    isMuted,
    isSharing,
    remoteScreen,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    getShareUrl,
    setTouchInput,
    clearTouchInput,
    setWalkTarget,
  } = usePeerRoom({ name, enabled: true });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prev;
      document.body.style.touchAction = "";
    };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl()).catch(() => {});
  };

  const someoneSharing = players.some((p) => p.isSharingScreen);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-white">{t.title}</h1>
          <p className="text-xs text-emerald-300/60">
            {connected ? `✅ ${name}` : t.connecting}
          </p>
        </div>
        <RoomControls
          isMuted={isMuted}
          isSharing={isSharing}
          onToggleMute={toggleMute}
          onStartShare={startScreenShare}
          onStopShare={stopScreenShare}
          onCopyLink={handleCopyLink}
          onLeave={onLeave}
        />
      </header>

      {isSharing && (
        <div className="mx-4 mt-3 rounded-lg border border-orange-400/40 bg-orange-500/15 px-4 py-2 text-sm text-orange-100">
          🖥️ {t.sharingActive}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <main className="flex flex-1 flex-col items-center gap-4 p-4 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex w-full max-w-3xl flex-col items-center gap-2">
          <div className="relative w-full max-w-[768px]">
            <GameCanvas
              players={players}
              myId={myId}
              remoteScreen={remoteScreen?.stream ?? null}
              onTapWalk={setWalkTarget}
            />

            <div className="pointer-events-auto absolute bottom-3 left-3 z-10 md:bottom-4 md:left-4">
              <TouchJoystick
                onMove={setTouchInput}
                onEnd={clearTouchInput}
              />
            </div>
          </div>

          <p className="text-center text-xs text-white/40">
            {t.controls}
            <span className="block text-white/30">{t.tapToWalk}</span>
          </p>
        </div>

        <aside className="flex w-full max-w-xs flex-col gap-3">
          <PeopleList players={players} myId={myId} />

          {remoteScreen ? (
            <ScreenSharePanel
              name={remoteScreen.name}
              stream={remoteScreen.stream}
            />
          ) : someoneSharing ? (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-4 text-center text-xs text-blue-200/80">
              {t.waitingForShare}
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
