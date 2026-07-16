// Best-effort OFFLINE agent-memory graduation nudge (ADR-0095 Decision 7, park-lease-filtered per
// ADR-0202), wired into `pnpm gate`.
//
// The graduation engine is offline — it reads the harness agent-memory dir + the seed snapshot +
// the machine-local park ledger, no DB — so unlike check:corpus-sync this ALWAYS runs (no creds, no
// network). It surfaces, at the pre-merge moment, how many LIVE durable-memory CANDIDATES await a
// librarian pass: only candidates that are NEW (no park record), CHANGED (their content hash broke
// since review), or LEASE-EXPIRED count (ADR-0202 D4 — the WARN is normally zero and meaningful
// when it isn't; parked candidates are silenced while their lease holds, their count surfaced on
// the OK line). It NEVER writes and NEVER fails the gate.
//
//   - memory store present + live candidates  -> WARN naming the new/changed/expired breakdown.
//   - memory store present + zero live        -> OK (naming the parked count).
//   - memory store / seed absent (fresh worktree, CI, web container) -> SKIP.
//
// The judgment stays the librarian-curator's: this only counts candidates, it does not decide which
// are genuinely durable or whether a park verdict holds. WARN-only, exit 0 always.

import os from "node:os";

import { classifyWorklist, graduationCandidates, novelCandidates, type LibrarySnapshot } from "@storytree/library";

import {
  GRADUATION_NUDGE_TAG as TAG,
  defaultLedgerPath,
  defaultMemoryDir,
  defaultSnapshotPath,
  graduationNudge,
  readMemoryDir,
  readParkLedger,
  readSnapshot,
  type MemoryReadResult,
} from "./graduate.js";

function main(): void {
  const memoryDir = defaultMemoryDir(os.homedir());

  let read: MemoryReadResult;
  try {
    read = readMemoryDir(memoryDir);
  } catch {
    // No harness agent-memory store here (fresh worktree / CI / web container) — nothing to surface.
    console.log(`${TAG} SKIP — no agent-memory store at ${memoryDir}; nothing to surface.`);
    return;
  }

  let snapshot: LibrarySnapshot;
  try {
    snapshot = readSnapshot(defaultSnapshotPath());
  } catch (e) {
    console.log(`${TAG} SKIP — could not read the seed snapshot (${(e as Error).message}); worklist unverified.`);
    return;
  }

  const now = new Date().toISOString().slice(0, 10);
  const novel = novelCandidates(graduationCandidates(read.memories, snapshot, { now }));
  const novelNames = new Set(novel.map((c) => c.source));
  const { ledger, problem } = readParkLedger(defaultLedgerPath(memoryDir));
  const worklist = classifyWorklist(
    read.memories.filter((m) => novelNames.has(m.name)),
    ledger,
    { now },
  );
  const nudge = graduationNudge(worklist.counts);
  const emit = nudge.level === "WARN" ? console.warn : console.log;
  for (const line of nudge.lines) emit(line);

  // An existing-but-invalid ledger is treated as EMPTY (everything shows live) — surfaced, never
  // silent (ADR-0095), but still advisory: the librarian fixes the ledger, the gate never reds.
  if (problem !== undefined) {
    console.warn(`${TAG}   (park ledger unreadable — treated as empty: ${problem})`);
  }
  // Surface unparseable memory files too — honesty over a silent drop (ADR-0095) — but never fail.
  if (read.unparseable.length > 0) {
    console.warn(`${TAG}   (${read.unparseable.length} memory file(s) unparseable — see \`storytree library graduate --review\`.)`);
  }
  // WARN-only: never sets a non-zero exit code.
}

try {
  main();
} catch (err) {
  // Even an unexpected error is advisory only — never fail the gate on the graduation nudge.
  console.log(`${TAG} SKIP — unexpected error (${(err as Error).message}); worklist unverified.`);
}
