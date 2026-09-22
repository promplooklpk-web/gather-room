import type { RealtimeChannel } from "@supabase/supabase-js";
import { getPeerRealm } from "@/lib/rooms";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isDialableMeshPeerId } from "@/lib/voicePeerIds";
import {
  VOICE_PEER_DB_TTL_MS,
  VOICE_PEER_DIAL_MAX_AGE_MS,
  VOICE_PEER_HEARTBEAT_MS,
  VOICE_PEER_POLL_MS,
  VOICE_PEER_STALE_PURGE_INTERVAL_MS,
  dbTtlCutoffIso,
  dialCutoffIso,
  isRowFresh,
} from "@/lib/voicePeerTtl";
import type { PeerInfo, PresenceSyncStatus } from "@/lib/types";

const LOG_PREFIX = "[voice-peers]";

export interface VoicePresencePayload {
  peerId: string;
  name: string;
  color: string;
  isSharingScreen: boolean;
}

export type VoicePresenceSyncHandler = (peers: PeerInfo[]) => void;

export interface VoicePresenceSession {
  stop: () => void;
}

/** Delete expired rows for this room session so sync cannot resurrect ghosts. */
export async function purgeStaleVoicePeers(
  roomId: string,
  session: string,
  maxAgeMs = VOICE_PEER_DB_TTL_MS
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const cutoff = dbTtlCutoffIso(maxAgeMs);
  const { error, count } = await supabase
    .from("voice_peers")
    .delete({ count: "exact" })
    .eq("room_id", roomId)
    .eq("session_id", session)
    .lt("updated_at", cutoff);
  if (error) {
    console.warn(LOG_PREFIX, "stale purge error", error.message);
  } else if (count && count > 0) {
    console.info(LOG_PREFIX, "stale purge", { roomId, session, count });
  }
}

async function fetchActivePeers(
  roomId: string,
  session: string,
  selfPeerId: string
): Promise<PeerInfo[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("voice_peers")
    .select("peer_id, name, color, is_sharing_screen, updated_at")
    .eq("room_id", roomId)
    .eq("session_id", session)
    .gt("updated_at", dialCutoffIso());
  if (error) {
    console.warn(LOG_PREFIX, "fetch error", error.message);
    return [];
  }
  const peers: PeerInfo[] = [];
  for (const row of data ?? []) {
    if (!row.peer_id || row.peer_id === selfPeerId) continue;
    if (!isRowFresh(row.updated_at)) {
      void purgeVoicePeer(roomId, session, row.peer_id);
      continue;
    }
    if (!isDialableMeshPeerId(row.peer_id, roomId, session)) {
      void purgeVoicePeer(roomId, session, row.peer_id);
      continue;
    }
    peers.push({
      id: row.peer_id,
      name: row.name || "???",
      color: row.color || "#5865f2",
      isSharingScreen: Boolean(row.is_sharing_screen),
    });
  }
  return peers;
}

/** Remove ghost / legacy rows so other clients stop dialing dead PeerJS ids. */
export async function purgeVoicePeer(
  roomId: string,
  session: string,
  peerId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("voice_peers")
    .delete()
    .eq("room_id", roomId)
    .eq("session_id", session)
    .eq("peer_id", peerId);
  if (error) {
    console.warn(LOG_PREFIX, "purge error", peerId, error.message);
  } else {
    console.info(LOG_PREFIX, "purged", peerId);
  }
}

/** Push sharing flag to Postgres immediately (do not wait for heartbeat). */
export function flushVoicePresence(
  roomId: string,
  session: string,
  self: VoicePresencePayload
): void {
  void upsertSelf(roomId, session, self);
}

async function upsertSelf(
  roomId: string,
  session: string,
  self: VoicePresencePayload
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from("voice_peers").upsert(
    {
      room_id: roomId,
      session_id: session,
      peer_id: self.peerId,
      name: self.name,
      color: self.color,
      is_sharing_screen: self.isSharingScreen,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id,session_id,peer_id" }
  );
  if (error) console.warn(LOG_PREFIX, "upsert error", error.message);
}

async function removeSelf(
  roomId: string,
  session: string,
  peerId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("voice_peers")
    .delete()
    .eq("room_id", roomId)
    .eq("session_id", session)
    .eq("peer_id", peerId);
  if (error) console.warn(LOG_PREFIX, "delete error", error.message);
}

/**
 * Postgres-backed peer registry + Realtime changes (works across Normal/Incognito;
 * Realtime presence alone is blocked on many Supabase projects without auth).
 */
export function startVoicePresence(
  roomId: string,
  session: string,
  getSelf: () => VoicePresencePayload | null,
  onSync: VoicePresenceSyncHandler,
  onChannelStatus?: (status: PresenceSyncStatus) => void
): VoicePresenceSession | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const self = getSelf();
  if (!self?.peerId) return null;

  let channel: RealtimeChannel | null = null;
  let stopped = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const emitSync = async () => {
    if (stopped) return;
    const latest = getSelf();
    if (!latest?.peerId) return;
    const peers = await fetchActivePeers(roomId, session, latest.peerId);
    console.info(LOG_PREFIX, "sync", {
      roomId,
      session,
      self: latest.peerId,
      peers: peers.map((p) => p.id),
    });
    onSync(peers);
  };

  const scheduleSync = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void emitSync(), 80);
  };

  const realm = getPeerRealm();
  channel = supabase
    .channel(`voice-db:${realm}:${roomId}:${session}`, {
      config: { broadcast: { self: false }, presence: { key: "" } },
    })
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "voice_peers",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as {
          session_id?: string;
          peer_id?: string;
        } | null;
        if (!row || row.session_id !== session) return;
        console.info(LOG_PREFIX, "realtime", payload.eventType, row.peer_id);
        scheduleSync();
      }
    );

  onChannelStatus?.("connecting");

  void channel.subscribe(async (status) => {
    console.info(LOG_PREFIX, "channel", status);
    if (stopped || !channel) return;
    if (status === "SUBSCRIBED") {
      onChannelStatus?.("connected");
      const latest = getSelf();
      if (!latest) return;
      await purgeStaleVoicePeers(roomId, session);
      await upsertSelf(roomId, session, latest);
      await emitSync();
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error(LOG_PREFIX, "channel failed", status);
      onChannelStatus?.("error");
      return;
    }
    if (status === "CLOSED") {
      onChannelStatus?.("idle");
    }
  });

  const heartbeat = window.setInterval(() => {
    if (stopped) return;
    const latest = getSelf();
    if (!latest) return;
    void upsertSelf(roomId, session, latest).then(() => scheduleSync());
  }, VOICE_PEER_HEARTBEAT_MS);

  const pollSync = window.setInterval(() => {
    if (stopped) return;
    void emitSync();
  }, VOICE_PEER_POLL_MS);

  const stalePurge = window.setInterval(() => {
    if (stopped) return;
    void purgeStaleVoicePeers(roomId, session).then(() => scheduleSync());
  }, VOICE_PEER_STALE_PURGE_INTERVAL_MS);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.clearInterval(heartbeat);
      window.clearInterval(pollSync);
      window.clearInterval(stalePurge);
      const latest = getSelf();
      if (latest?.peerId) {
        void removeSelf(roomId, session, latest.peerId);
      }
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    },
  };
}
