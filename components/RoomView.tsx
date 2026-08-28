"use client";

import { usePeerRoom } from "@/hooks/usePeerRoom";
import { GameCanvas } from "@/components/GameCanvas";
import { PeopleList } from "@/components/PeopleList";
import { RoomControls } from "@/components/RoomControls";
import { ScreenSharePanel } from "@/components/ScreenSharePanel";
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
  } = usePeerRoom({ name, enabled: true });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl()).catch(() => {});
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
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

      {(error) && (
        <div className="mx-4 mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <main className="flex flex-1 flex-col items-center gap-4 p-4 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex flex-col items-center gap-2">
          <GameCanvas
            players={players}
            myId={myId}
            remoteScreen={remoteScreen?.stream ?? null}
          />
          <p className="text-xs text-white/40">{t.controls}</p>
        </div>

        <aside className="flex w-full max-w-xs flex-col gap-3">
          <PeopleList players={players} myId={myId} />

          {remoteScreen && (
            <ScreenSharePanel
              name={remoteScreen.name}
              stream={remoteScreen.stream}
            />
          )}
        </aside>
      </main>
    </div>
  );
}
