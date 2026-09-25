import assert from "node:assert/strict";
import {
  classifyDisplayMediaError,
  displayMediaErrorMessage,
} from "./displayMedia";

assert.equal(classifyDisplayMediaError({ name: "AbortError" }), "cancelled");
assert.equal(
  classifyDisplayMediaError({
    name: "NotAllowedError",
    message: "Permission denied",
  }),
  "denied"
);
assert.equal(
  classifyDisplayMediaError({
    name: "NotAllowedError",
    message: "The user aborted the request",
  }),
  "cancelled"
);
assert.equal(classifyDisplayMediaError({ name: "NotReadableError" }), "busy");

const msg = displayMediaErrorMessage(
  { name: "AbortError" },
  {
    denied: "D",
    cancelled: "C",
    insecure: "I",
    busy: "B",
    unsupported: "U",
    unknown: "X",
  }
);
assert.equal(msg, "C");

console.log("displayMedia.test.ts: ok");
