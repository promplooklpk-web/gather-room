import assert from "node:assert/strict";
import { iceServers, optionalTurnFromEnv } from "./peerConfig";

const baseStunCount = 3;

assert.equal(iceServers().length, baseStunCount);
assert.equal(iceServers({ turn: false }).length, baseStunCount);
assert.equal(iceServers({ turn: true }).length, baseStunCount + 2);

const turnUrls = iceServers({ turn: true }).find(
  (s) =>
    typeof s.urls !== "string" &&
    Array.isArray(s.urls) &&
    s.urls.some((u) => String(u).includes("turn.peerjs.com"))
);
assert.ok(turnUrls);

assert.equal(optionalTurnFromEnv(), null);

console.log("peerConfig.test.ts: ok");
