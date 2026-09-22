"use client";

import { useEffect, useState } from "react";
import {
  fetchAllRoomsOccupancy,
  startAllRoomsPresence,
  type RoomOccupancyMap,
} from "@/lib/allRoomsPresence";
import { VOICE_ROOMS } from "@/lib/rooms";

function emptyMap(): RoomOccupancyMap {
  const map: RoomOccupancyMap = {};
  for (const r of VOICE_ROOMS) map[r.id] = [];
  return map;
}

/** Cross-room roster from Supabase voice_peers (all channel sessions per room). */
export function useAllRoomsOccupancy(enabled: boolean): RoomOccupancyMap {
  const [occupancy, setOccupancy] = useState<RoomOccupancyMap>(emptyMap);

  useEffect(() => {
    if (!enabled) {
      setOccupancy(emptyMap());
      return;
    }

    let stopped = false;
    void fetchAllRoomsOccupancy().then((map) => {
      if (!stopped) setOccupancy(map);
    });

    const session = startAllRoomsPresence((map) => {
      if (!stopped) setOccupancy(map);
    });

    return () => {
      stopped = true;
      session?.stop();
    };
  }, [enabled]);

  return occupancy;
}
