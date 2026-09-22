import type { RealtimeChannel } from "@supabase/supabase-js";
import { getPeerRealm, VOICE_ROOMS } from "@/lib/rooms";
import { getSupabaseClient } from "@/lib/supabaseClient";

const LOG_PREFIX = "[all-rooms-presence]";
const STALE_PEER_MS = 45_000;
const POLL_SYNC_MS = 4000;

export interface RoomOccupant {
  peerId: string;
  name: string;
  color: string;
  isSharingScreen: boolean;
}

export type RoomOccupancyMap = Record<string, RoomOccupant[]>;

function staleCutoffIso(): string {
  return new Date(Date.now() - STALE_PEER_MS).toISOString();
}

function trackedRoomIds(): string[] {
  return VOICE_ROOMS.map((r) => r.id);
}

function rowsToOccupancy(
  rows: Array<{
    room_id: string;
    peer_id: string;
    name: string;
    color: string;
    is_sharing_screen: boolean;
    updated_at: string;
  }>
): RoomOccupancyMap {
  const byRoom: RoomOccupancyMap = {};
  for (const id of trackedRoomIds()) {
    byRoom[id] = [];
  }

  const latestByRoomPeer = new Map<
    string,
    {
      room_id: string;
      peer_id: string;
      name: string;
      color: string;
      is_sharing_screen: boolean;
      updated_at: string;
    }
  >();

  for (const row of rows) {
    if (!row.room_id || !row.peer_id) continue;
    const key = `${row.room_id}\0${row.peer_id}`;
    const prev = latestByRoomPeer.get(key);
    if (!prev || row.updated_at > prev.updated_at) {
      latestByRoomPeer.set(key, row);
    }
  }

  for (const row of latestByRoomPeer.values()) {
    if (!byRoom[row.room_id]) continue;
    byRoom[row.room_id].push({
      peerId: row.peer_id,
      name: row.name || "???",
      color: row.color || "#5865f2",
      isSharingScreen: Boolean(row.is_sharing_screen),
    });
  }

  for (const id of trackedRoomIds()) {
    byRoom[id].sort((a, b) => a.name.localeCompare(b.name, "th"));
  }

  return byRoom;
}

export async function fetchAllRoomsOccupancy(): Promise<RoomOccupancyMap> {
  const supabase = getSupabaseClient();
  const empty = (): RoomOccupancyMap => {
    const map: RoomOccupancyMap = {};
    for (const id of trackedRoomIds()) map[id] = [];
    return map;
  };
  if (!supabase) return empty();

  const { data, error } = await supabase
    .from("voice_peers")
    .select("room_id, peer_id, name, color, is_sharing_screen, updated_at")
    .in("room_id", trackedRoomIds())
    .gt("updated_at", staleCutoffIso());

  if (error) {
    console.warn(LOG_PREFIX, "fetch error", error.message);
    return empty();
  }

  return rowsToOccupancy(data ?? []);
}

export type AllRoomsPresenceHandler = (map: RoomOccupancyMap) => void;

export interface AllRoomsPresenceSession {
  stop: () => void;
}

/**
 * Live occupancy for every voice channel (all sessions per room_id), via voice_peers + Realtime.
 */
export function startAllRoomsPresence(
  onSync: AllRoomsPresenceHandler
): AllRoomsPresenceSession | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let channel: RealtimeChannel | null = null;
  let stopped = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const emitSync = async () => {
    if (stopped) return;
    const map = await fetchAllRoomsOccupancy();
    onSync(map);
  };

  const scheduleSync = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void emitSync(), 80);
  };

  const realm = getPeerRealm();
  channel = supabase
    .channel(`voice-db-all-rooms:${realm}`, {
      config: { broadcast: { self: false }, presence: { key: "" } },
    })
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "voice_peers",
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as { room_id?: string } | null;
        const roomId = row?.room_id;
        if (!roomId || !trackedRoomIds().includes(roomId)) return;
        scheduleSync();
      }
    );

  void channel.subscribe((status) => {
    if (stopped) return;
    if (status === "SUBSCRIBED") void emitSync();
  });

  const pollSync = window.setInterval(() => {
    if (stopped) return;
    void emitSync();
  }, POLL_SYNC_MS);

  void emitSync();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.clearInterval(pollSync);
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    },
  };
}
