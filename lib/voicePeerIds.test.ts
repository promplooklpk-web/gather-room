import assert from "node:assert/strict";
import {
  isCurrentGuestPeerId,
  isDialableMeshPeerId,
  isLegacyGuestPeerId,
} from "./voicePeerIds";
import { isRowFresh } from "./voicePeerTtl";

const roomId = "meeting-1";
const session = "ch-meeting-1";

assert.equal(isLegacyGuestPeerId("mtlclick-meeting-1-4ot3cy", roomId), true);
assert.equal(
  isLegacyGuestPeerId("mtlclick-meeting-1-ch-meeting-1-abc123", roomId),
  false
);

const current = "mtlclick-meeting-1-ch-meeting-1-abc123";
assert.equal(isCurrentGuestPeerId(current, roomId, session), true);
assert.equal(isDialableMeshPeerId(current, roomId, session), true);
assert.equal(
  isDialableMeshPeerId("mtlclick-meeting-1-4ot3cy", roomId, session),
  false
);
assert.equal(
  isDialableMeshPeerId("mtlclick-lpk-meeting-1-ch-meeting-1-host", roomId, session),
  false
);

assert.equal(isRowFresh(new Date().toISOString()), true);
assert.equal(isRowFresh(new Date(Date.now() - 120_000).toISOString()), false);

console.log("voicePeerIds tests passed");
