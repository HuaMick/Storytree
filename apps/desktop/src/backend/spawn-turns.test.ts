// Tests for the story-author spawn turn-budget resolver (apps/desktop/src/backend/spawn-turns.ts).
//
// WHAT IT PINS: STORYTREE_SPAWN_MAX_TURNS, when set to a usable positive number, wins; every
// unusable value (absent, blank, non-numeric, non-finite, zero, negative) degrades to the default —
// never to a broken cap. This is the CI-provable core of the fix; the backend-entry glue that reads
// process.env and threads the result into buildSpawnDeps is operator-attested (a node:test over it
// would spawn a subscription-billed SDK session).

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSpawnMaxTurns, DEFAULT_STORY_AUTHOR_MAX_TURNS } from "./spawn-turns.js";

test("resolveSpawnMaxTurns: an unset env value yields the story-author default (not 16)", () => {
  assert.equal(resolveSpawnMaxTurns(undefined), DEFAULT_STORY_AUTHOR_MAX_TURNS);
  // Regression guard: the whole point is a budget ABOVE the generic 16-turn brake.
  assert.ok(DEFAULT_STORY_AUTHOR_MAX_TURNS > 16);
});

test("resolveSpawnMaxTurns: a usable positive env value wins over the default", () => {
  assert.equal(resolveSpawnMaxTurns("45"), 45);
  assert.equal(resolveSpawnMaxTurns("8"), 8); // env may also LOWER the budget
});

test("resolveSpawnMaxTurns: a fractional value floors to a whole turn count", () => {
  assert.equal(resolveSpawnMaxTurns("45.9"), 45);
});

test("resolveSpawnMaxTurns: unusable values degrade to the fallback, never a broken cap", () => {
  for (const bad of ["", "   ", "abc", "0", "-4", "NaN", "Infinity"]) {
    assert.equal(
      resolveSpawnMaxTurns(bad),
      DEFAULT_STORY_AUTHOR_MAX_TURNS,
      `"${bad}" should fall back to the default`,
    );
  }
});

test("resolveSpawnMaxTurns: an explicit fallback overrides the default", () => {
  assert.equal(resolveSpawnMaxTurns(undefined, 16), 16);
  assert.equal(resolveSpawnMaxTurns("30", 16), 30);
});
