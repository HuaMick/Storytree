import test from "node:test";
import assert from "node:assert/strict";

import type { MemoryFile } from "./graduation.js";
import {
  DEFAULT_LEASE_DAYS,
  emptyParkLedger,
  parseParkLedger,
  hashMemoryContent,
  makeParkRecord,
  leaseExpiresOn,
  classifyMemoryPark,
  classifyWorklist,
  type ParkRecord,
  type ParkLedger,
} from "./park.js";
import {
  hashMemoryContent as hashMemoryContentFromBarrel,
  classifyMemoryPark as classifyMemoryParkFromBarrel,
  classifyWorklist as classifyWorklistFromBarrel,
  emptyParkLedger as emptyParkLedgerFromBarrel,
} from "../index.js";

function mem(partial: Partial<MemoryFile> & Pick<MemoryFile, "type">): MemoryFile {
  return {
    name: partial.name ?? "some-memory",
    description: partial.description ?? "a one-line summary",
    body: partial.body ?? "some durable body text",
    type: partial.type,
  };
}

// ---------------------------------------------------------------------------
// gpl-park-exported-and-browser-safe
// ---------------------------------------------------------------------------

test("gpl-park-exported-and-browser-safe: park.ts's surface is re-exported from the root barrel", () => {
  assert.equal(typeof hashMemoryContentFromBarrel, "function");
  assert.equal(typeof classifyMemoryParkFromBarrel, "function");
  assert.equal(typeof classifyWorklistFromBarrel, "function");
  assert.equal(typeof emptyParkLedgerFromBarrel, "function");

  const m = mem({ type: "feedback", name: "some-lesson" });
  // same underlying implementation reached either through the direct import or the barrel
  assert.equal(hashMemoryContentFromBarrel(m), hashMemoryContent(m));
  assert.deepEqual(emptyParkLedgerFromBarrel(), emptyParkLedger());

  const ledger = emptyParkLedgerFromBarrel();
  assert.equal(classifyMemoryParkFromBarrel(m, ledger.parks[m.name], "2026-07-16"), "new");
});

// ---------------------------------------------------------------------------
// gpl-hash-deterministic-and-content-sensitive
// ---------------------------------------------------------------------------

test("gpl-hash-deterministic-and-content-sensitive: same content hashes equal; description/type/body changes hash differently; name is excluded", () => {
  const original = mem({
    name: "org-analogy-preference",
    description: "USER prefers organisational analogies",
    type: "feedback",
    body: "agents=employees, orchestrator=manager, approval=sign-off",
  });

  // deterministic: hashing the identical content twice yields the identical hash
  assert.equal(hashMemoryContent(original), hashMemoryContent({ ...original }));

  // a pure rename (name changes, everything else identical) MUST NOT change the hash
  const renamed: MemoryFile = { ...original, name: "org-analogy-preference-renamed" };
  assert.equal(hashMemoryContent(original), hashMemoryContent(renamed));

  // a changed description changes the hash
  const changedDescription: MemoryFile = { ...original, description: "USER dislikes analogies now" };
  assert.notEqual(hashMemoryContent(original), hashMemoryContent(changedDescription));

  // a changed type changes the hash
  const changedType: MemoryFile = { ...original, type: "project" };
  assert.notEqual(hashMemoryContent(original), hashMemoryContent(changedType));

  // a changed body changes the hash
  const changedBody: MemoryFile = { ...original, body: "a completely different lesson body" };
  assert.notEqual(hashMemoryContent(original), hashMemoryContent(changedBody));
});

// ---------------------------------------------------------------------------
// gpl-park-record-schema-and-defaults
// ---------------------------------------------------------------------------

test("gpl-park-record-schema-and-defaults: emptyParkLedger, makeParkRecord defaults, and fail-loud parseParkLedger", () => {
  assert.deepEqual(emptyParkLedger(), { version: 1, parks: {} });

  const m = mem({ name: "docker-desktop-engine-wont-start", type: "project" });
  const record = makeParkRecord(m, { reason: "environmental, not durable enough to graduate", now: "2026-07-16" });
  assert.equal(record.verdict, "wont-graduate");
  assert.equal(record.reason, "environmental, not durable enough to graduate");
  assert.equal(record.contentHash, hashMemoryContent(m));
  assert.equal(record.reviewedAt, "2026-07-16");
  assert.equal(record.leaseDays, DEFAULT_LEASE_DAYS);
  assert.equal(DEFAULT_LEASE_DAYS, 60);

  const withExplicitLease = makeParkRecord(m, { reason: "custom lease", now: "2026-07-16", leaseDays: 14 });
  assert.equal(withExplicitLease.leaseDays, 14);

  // a well-formed ledger round-trips through parseParkLedger
  const ledger: ParkLedger = { version: 1, parks: { [m.name]: record } };
  assert.deepEqual(parseParkLedger(ledger), ledger);

  // fail-loud: an empty reason is rejected
  assert.throws(() =>
    parseParkLedger({ version: 1, parks: { x: { ...record, reason: "" } } }),
  );

  // fail-loud: a wrong verdict literal is rejected
  assert.throws(() =>
    parseParkLedger({ version: 1, parks: { x: { ...record, verdict: "graduate" } } }),
  );

  // fail-loud: a non-positive leaseDays is rejected
  assert.throws(() =>
    parseParkLedger({ version: 1, parks: { x: { ...record, leaseDays: 0 } } }),
  );

  // fail-loud: a malformed top-level shape is rejected
  assert.throws(() => parseParkLedger({ parks: {} }));
  assert.throws(() => parseParkLedger(null));
  assert.throws(() => parseParkLedger("not a ledger"));
});

// ---------------------------------------------------------------------------
// gpl-lease-expiry-date-math
// ---------------------------------------------------------------------------

test("gpl-lease-expiry-date-math: leaseExpiresOn adds leaseDays to reviewedAt, handling month and year rollover, no clock", () => {
  const base: ParkRecord = {
    verdict: "wont-graduate",
    reason: "example",
    contentHash: "deadbeef",
    reviewedAt: "2026-07-16",
    leaseDays: 60,
  };
  // plain within-quarter add, crossing a month boundary
  assert.equal(leaseExpiresOn(base), "2026-09-14");

  // month rollover within the same year
  assert.equal(
    leaseExpiresOn({ ...base, reviewedAt: "2026-01-15", leaseDays: 20 }),
    "2026-02-04",
  );

  // year rollover
  assert.equal(
    leaseExpiresOn({ ...base, reviewedAt: "2026-12-01", leaseDays: 45 }),
    "2027-01-15",
  );

  // a zero-length lease expires the same day it was reviewed
  assert.equal(leaseExpiresOn({ ...base, reviewedAt: "2026-07-16", leaseDays: 0 }), "2026-07-16");
});

// ---------------------------------------------------------------------------
// gpl-classify-new-changed-expired-parked
// ---------------------------------------------------------------------------

test("gpl-classify-new-changed-expired-parked: four-way classification, hash invalidation wins over lease state, inclusive expiry boundary", () => {
  const m = mem({ name: "gate-oom-on-dev-box", type: "project", body: "pnpm gate can OOM locally under memory pressure" });

  // no record at all -> 'new'
  assert.equal(classifyMemoryPark(m, undefined, "2026-07-16"), "new");

  const record = makeParkRecord(m, { reason: "environmental", now: "2026-07-16", leaseDays: 60 });
  // lease still holds, content unchanged -> 'parked'
  assert.equal(classifyMemoryPark(m, record, "2026-09-13"), "parked");
  // lease boundary is INCLUSIVE: the exact expiry date -> 'expired'
  assert.equal(classifyMemoryPark(m, record, "2026-09-14"), "expired");
  // past the boundary -> still 'expired'
  assert.equal(classifyMemoryPark(m, record, "2026-10-01"), "expired");

  // a content change re-enters the worklist immediately, even while the lease is still fresh
  const editedM: MemoryFile = { ...m, body: "an edited, expanded lesson body" };
  assert.equal(classifyMemoryPark(editedM, record, "2026-07-17"), "changed");

  // precedence: hash mismatch WINS over an ALSO-lapsed lease
  assert.equal(classifyMemoryPark(editedM, record, "2026-12-25"), "changed");
});

// ---------------------------------------------------------------------------
// gpl-worklist-counts-only-live
// ---------------------------------------------------------------------------

test("gpl-worklist-counts-only-live: classifyWorklist's live excludes only parked, counts are consistent, empty ledger is all-new", () => {
  const brandNew = mem({ name: "brand-new-lesson", type: "project" });
  const changed = mem({ name: "edited-lesson", type: "feedback", body: "the edited body" });
  const expired = mem({ name: "stale-lesson", type: "reference" });
  const stillParked = mem({ name: "settled-lesson", type: "project" });

  const changedOriginal = mem({ name: "edited-lesson", type: "feedback", body: "the original body" });

  const ledger: ParkLedger = {
    version: 1,
    parks: {
      "edited-lesson": makeParkRecord(changedOriginal, { reason: "was fine then", now: "2026-06-01", leaseDays: 60 }),
      "stale-lesson": makeParkRecord(expired, { reason: "old news", now: "2026-01-01", leaseDays: 30 }),
      "settled-lesson": makeParkRecord(stillParked, { reason: "still settled", now: "2026-07-15", leaseDays: 60 }),
    },
  };

  const memories = [brandNew, changed, expired, stillParked];
  const result = classifyWorklist(memories, ledger, { now: "2026-07-16" });

  assert.equal(result.entries.length, 4);
  const byName = new Map(result.entries.map((e) => [e.memory.name, e.status]));
  assert.equal(byName.get("brand-new-lesson"), "new");
  assert.equal(byName.get("edited-lesson"), "changed");
  assert.equal(byName.get("stale-lesson"), "expired");
  assert.equal(byName.get("settled-lesson"), "parked");

  // live excludes ONLY 'parked'
  const liveNames = result.live.map((e) => e.memory.name).sort();
  assert.deepEqual(liveNames, ["brand-new-lesson", "edited-lesson", "stale-lesson"]);

  // counts are consistent with entries and sum to the memory count
  assert.deepEqual(result.counts, { new: 1, changed: 1, expired: 1, parked: 1 });
  assert.equal(
    result.counts.new + result.counts.changed + result.counts.expired + result.counts.parked,
    memories.length,
  );

  // an empty ledger classifies every memory as 'new', and all of them are live
  const emptyResult = classifyWorklist(memories, emptyParkLedger(), { now: "2026-07-16" });
  assert.equal(emptyResult.live.length, memories.length);
  assert.deepEqual(emptyResult.counts, { new: memories.length, changed: 0, expired: 0, parked: 0 });
});
