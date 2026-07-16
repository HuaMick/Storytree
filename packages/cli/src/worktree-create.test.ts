/**
 * Table test for {@link mintWorktreeName} — the ADR-0200 D3 worktree/session name minting policy.
 * Pure and offline: stamps are passed as data (the fs-reading `storyArcStamps` is arc.ts's job).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { mintWorktreeName } from "./worktree-create.js";

interface MintCase {
  readonly name: string;
  readonly nodes: readonly string[];
  readonly stamps: ReadonlyArray<{ story: string; arc: string }>;
  readonly suffix: string;
  readonly expectBasename: string;
}

const MINT_CASES: readonly MintCase[] = [
  {
    name: "arc-stamped anchor: <arc-slug>-<story>-<suffix>, trailing -arc dropped, arc part truncated to 16",
    nodes: ["notice-board"],
    stamps: [{ story: "notice-board", arc: "noticeboard-claim-ledger-arc" }],
    suffix: "4fa2",
    // "noticeboard-claim-ledger" → 16 chars → "noticeboard-clai"
    expectBasename: "noticeboard-clai-notice-board-4fa2",
  },
  {
    name: "planless anchor (no arc stamp): <story>-<suffix>",
    nodes: ["my-story"],
    stamps: [],
    suffix: "9c",
    expectBasename: "my-story-9c",
  },
  {
    name: "story part truncates to 16 even planless",
    nodes: ["wisp-as-story-claim"],
    stamps: [],
    suffix: "9c",
    // "wisp-as-story-claim" → 16 chars → "wisp-as-story-cl"
    expectBasename: "wisp-as-story-cl-9c",
  },
  {
    name: "first node wins: unstamped anchor stays planless though a later node carries an arc",
    nodes: ["notice-board", "wisp-as-story-claim"],
    stamps: [{ story: "wisp-as-story-claim", arc: "other-arc" }],
    suffix: "7b",
    expectBasename: "notice-board-7b",
  },
  {
    name: "first node wins: the anchor's own stamp is used, not a sibling node's",
    nodes: ["wisp-as-story-claim", "notice-board"],
    stamps: [
      { story: "wisp-as-story-claim", arc: "noticeboard-claim-ledger-arc" },
      { story: "notice-board", arc: "zother-arc" },
    ],
    suffix: "7b",
    expectBasename: "noticeboard-clai-wisp-as-story-cl-7b",
  },
  {
    name: "arc id without a trailing -arc is used as-is (only the suffix is dropped, never a substring)",
    nodes: ["some-story"],
    stamps: [{ story: "some-story", arc: "journey" }],
    suffix: "1a",
    expectBasename: "journey-some-story-1a",
  },
  {
    name: "story truncation that would leave a trailing hyphen trims it (no double hyphen at the join)",
    nodes: ["abcdefghijklmno-pqr"],
    stamps: [{ story: "abcdefghijklmno-pqr", arc: "supercalifragilistic-arc" }],
    suffix: "ab",
    // arc "supercalifragilistic" → "supercalifragili"; story slice-16 "abcdefghijklmno-" → "abcdefghijklmno"
    expectBasename: "supercalifragili-abcdefghijklmno-ab",
  },
];

test("mintWorktreeName — the D3 naming table", () => {
  for (const c of MINT_CASES) {
    const minted = mintWorktreeName(c.nodes, c.stamps, c.suffix);
    assert.equal(minted.basename, c.expectBasename, c.name);
    // The claude/ prefix is load-bearing (CI + merged-branch-guard recognise claude/*) — every mint.
    assert.equal(minted.branch, `claude/${minted.basename}`, `${c.name} (branch)`);
  }
});

test("mintWorktreeName — long arc + long story hit the 40-char cap with no trailing hyphen", () => {
  const minted = mintWorktreeName(
    ["abcdefghijklmno-pqr"],
    [{ story: "abcdefghijklmno-pqr", arc: "supercalifragilistic-arc" }],
    "abcdefgh",
  );
  // Pre-cap: "supercalifragili-abcdefghijklmno-abcdefgh" (41) → capped at 40 (last suffix char cut).
  assert.equal(minted.basename, "supercalifragili-abcdefghijklmno-abcdefg");
  assert.ok(minted.basename.length <= 40, "basename is capped at 40 chars");
  assert.ok(!minted.basename.endsWith("-"), "no trailing hyphen after the cap");
  assert.ok(!minted.basename.includes("--"), "no double hyphen around joins");
  assert.equal(minted.branch, `claude/${minted.basename}`);
});

test("mintWorktreeName — a cap cut landing ON a hyphen is re-trimmed", () => {
  // story16 (0..15) + "-"(16) + suffix; the suffix's own hyphen lands at index 39, so the 40-slice
  // ends on it — the defensive re-trim must eat it.
  const minted = mintWorktreeName(
    ["abcdefghijklmnop"],
    [],
    "aaaaaaaaaaaaaaaaaaaaaa-bb",
  );
  assert.equal(minted.basename, "abcdefghijklmnop-aaaaaaaaaaaaaaaaaaaaaa");
  assert.ok(!minted.basename.endsWith("-"));
  assert.ok(minted.basename.length <= 40);
});

interface RefusalCase {
  readonly name: string;
  readonly nodes: readonly string[];
  readonly suffix: string;
  readonly messageHas: RegExp;
}

const REFUSAL_CASES: readonly RefusalCase[] = [
  { name: "empty nodes array", nodes: [], suffix: "ab", messageHas: /--node/ },
  { name: "blank anchor node", nodes: ["   "], suffix: "ab", messageHas: /blank/ },
  { name: "empty-string anchor node", nodes: [""], suffix: "ab", messageHas: /blank/ },
  { name: "uppercase anchor refused, not normalised", nodes: ["Notice-Board"], suffix: "ab", messageHas: /unsafe/ },
  { name: "underscore anchor refused", nodes: ["has_underscore"], suffix: "ab", messageHas: /unsafe/ },
  { name: "slash anchor refused", nodes: ["a/b"], suffix: "ab", messageHas: /unsafe/ },
  { name: "space anchor refused", nodes: ["two words"], suffix: "ab", messageHas: /unsafe/ },
  { name: "blank suffix", nodes: ["ok-story"], suffix: "", messageHas: /suffix/ },
  { name: "whitespace suffix", nodes: ["ok-story"], suffix: "   ", messageHas: /suffix/ },
];

test("mintWorktreeName — refusals throw with a legible message", () => {
  for (const c of REFUSAL_CASES) {
    assert.throws(
      () => mintWorktreeName(c.nodes, [], c.suffix),
      (err: unknown) => err instanceof Error && c.messageHas.test(err.message),
      c.name,
    );
  }
});
