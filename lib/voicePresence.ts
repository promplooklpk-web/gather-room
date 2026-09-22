import type { RealtimeChannel } from "@supabase/supabase-js";
import { getPeerRealm } from "@/lib/rooms";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { PeerInfo } from "@/lib/types";

export interface VoicePresencePayload {
  peerId: string;
  name: string;
  color: string;
  isSharingScreen: boolean;
}

function channelName(roomId: string, session: string): string {
  return `voice:${getPeerRealm()}:${roomId}:${session}`;
}

export type VoicePresenceSyncHandler = (peers: PeerInfo[]) => void;

export interface VoicePresenceSession {
  stop: () => void;
}

/**
 * Announce this tab's PeerJS id on a Supabase Realtime presence channel so other
 * browsers in the same room/session can dial us directly (no contested host id).
 */
export function startVoicePresence(
  roomId: string,
  session: string,
  getSelf: () => VoicePresencePayload | null,
  onSync: VoicePresenceSyncHandler
): VoicePresenceSession | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const self = getSelf();
  if (!self?.peerId) return null;

  let channel: RealtimeChannel | null = null;
  let stopped = false;

  const emitSync = () => {
    if (!channel || stopped) return;
    const state = channel.presenceState<VoicePresencePayload>();
    const peers: PeerInfo[] = [];
    const seen = new Set<string>();
    for (const key of Object.keys(state)) {
      for (const row of state[key] ?? []) {
        const p = row as VoicePresencePayload;
        if (!p.peerId || p.peerId === self.peerId || seen.has(p.peerId)) continue;
        seen.add(p.peerId);
        peers.push({
          id: p.peerId,
          name: p.name || "???",
          color: p.color || "#5865f2",
          isSharingScreen: Boolean(p.isSharingScreen),
        });
      }
    }
    onSync(peers);
  };

  channel = supabase.channel(channelName(roomId, session), {
    config: { presence: { key: self.peerId } },
  });

  channel
    .on("presence", { event: "sync" }, emitSync)
    .on("presence", { event: "join" }, emitSync)
    .on("presence", { event: "leave" }, emitSync);

  void channel.subscribe(async (status) => {
    if (stopped || !channel) return;
    if (status === "SUBSCRIBED") {
      const latest = getSelf();
      if (!latest) return;
      try {
        await channel.track(latest);
      } catch {
        /* channel closing */
      }
      emitSync();
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error("voice presence channel:", status);
    }
  });

  const heartbeat = window.setInterval(() => {
    if (stopped || !channel) return;
    const latest = getSelf();
    if (!latest) return;
    void channel.track(latest).catch(() => {});
  }, 4000);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(heartbeat);
      void channel?.untrack().catch(() => {});
      void supabase.removeChannel(channel!);
      channel = null;
    },
  };
}
