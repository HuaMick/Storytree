import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkBoundaries,
  classOf,
  findCycle,
  mergeDeclaredGraph,
  type Ownership,
} from "./boundaries.js";

// A miniature world mirroring the real two-class ownership (ADR-0074 §2, the hub increment): the
// organisms (including the cli/store HUBS — no longer exempt), and the shared substrate/ports.
const ownership: Ownership = {
  organisms: {
    "@storytree/library": "library",
    "@storytree/orchestrator": "drive-machinery",
    "@storytree/agent": "drive-machinery",
    "@storytree/notice-board": "notice-board",
    "@storytree/studio-members": "studio-members",
    "@storytree/store": "store",
    "@storytree/cli": "cli",
  },
  substrate: ["@storytree/base", "@storytree/verdict-contract"],
};

// Consumer-side outbound edges (`depends_on`). The cli hub's outbound edges are NOT here — they are
// declared provider-side in `consumedBy` below (the de-noised hub, ADR-0074 §4).
const storyGraph: Record<string, string[]> = {
  library: [],
  "drive-machinery": ["library"],
  "notice-board": ["library", "drive-machinery"],
  "studio-members": ["library"],
  store: ["library", "notice-board", "studio-members"],
  cli: [],
};

// Provider-side inbound edges (`consumed_by`): each spoke owns its "wired into the cli hub" edge.
const consumedBy: Record<string, string[]> = {
  "drive-machinery": ["cli"],
  library: ["cli"],
  "notice-board": ["cli"],
  store: ["cli"],
};

// The real runtime @storytree/* dependency graph (each package.json `dependencies`; devDeps —
// e.g. store→orchestrator parity, verdict-contract→library parity — excluded by the caller).
const realPackageDeps: Record<string, string[]> = {
  "@storytree/verdict-contract": [],
  "@storytree/base": ["@storytree/verdict-contract"],
  "@storytree/library": ["@storytree/verdict-contract"],
  "@storytree/orchestrator": [
    "@storytree/agent", // same story (drive-machinery) → intra-organism
    "@storytree/base",
    "@storytree/library", // drive-machinery depends_on library ✓
    "@storytree/verdict-contract",
  ],
  "@storytree/agent": [],
  "@storytree/notice-board": [],
  "@storytree/studio-members": [],
  "@storytree/store": [
    "@storytree/base",
    "@storytree/library", // store depends_on library ✓
    "@storytree/notice-board", // store depends_on notice-board ✓
    "@storytree/studio-members", // store depends_on studio-members ✓
    "@storytree/verdict-contract",
  ],
  "@storytree/cli": [
    "@storytree/agent", // cli → drive-machinery: covered by drive-machinery.consumed_by ✓
    "@storytree/base",
    "@storytree/library", // covered by library.consumed_by ✓
    "@storytree/notice-board", // covered by notice-board.consumed_by ✓
    "@storytree/orchestrator", // cli → drive-machinery ✓
    "@storytree/store", // covered by store.consumed_by ✓
    "@storytree/verdict-contract",
  ],
};

test("classOf places each package in one of the two classes, null when unknown", () => {
  assert.equal(classOf("@storytree/library", ownership), "organism");
  assert.equal(classOf("@storytree/store", ownership), "organism"); // a hub is an organism now
  assert.equal(classOf("@storytree/cli", ownership), "organism");
  assert.equal(classOf("@storytree/base", ownership), "substrate");
  assert.equal(classOf("@storytree/mystery", ownership), null);
});

test("mergeDeclaredGraph unions depends_on with the inverse of consumed_by", () => {
  const merged = mergeDeclaredGraph(
    { a: ["b"], b: [], c: [] },
    { b: ["c"] }, // c consumes b → edge c → b
  );
  assert.deepEqual(merged.a, ["b"]);
  assert.deepEqual(merged.c, ["b"]); // provider-side edge surfaced consumer-direction
  assert.deepEqual(merged.b, []);
});

test("the real clean graph (hubs enforced, edges declared both ways) has zero violations", () => {
  const { violations } = checkBoundaries({
    ownership,
    packageDeps: realPackageDeps,
    storyGraph,
    consumedBy,
  });
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("a cli hub edge declared PROVIDER-side (consumed_by) passes", () => {
  // cli → library, covered only by library.consumed_by: [cli] (cli.depends_on is []).
  const packageDeps = { "@storytree/cli": ["@storytree/library"] };
  const { violations } = checkBoundaries({ ownership, packageDeps, storyGraph, consumedBy });
  assert.deepEqual(violations, []);
});

test("a cli hub edge with the provider-side declaration REMOVED is caught", () => {
  const packageDeps = { "@storytree/cli": ["@storytree/library"] };
  const without = { ...consumedBy, library: [] }; // drop library.consumed_by: [cli]
  const { violations } = checkBoundaries({ ownership, packageDeps, storyGraph, consumedBy: without });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /undeclared cross-story coupling/);
  assert.match(violations[0]!, /cli.*library/);
});

test("a planted UNDECLARED hub edge — an organism importing @storytree/store — is caught", () => {
  // library reaches into persistence with no declaration on either endpoint.
  const packageDeps = {
    ...realPackageDeps,
    "@storytree/library": ["@storytree/store", "@storytree/verdict-contract"],
  };
  const { violations } = checkBoundaries({ ownership, packageDeps, storyGraph, consumedBy });
  assert.equal(violations.length, 1, violations.join("\n"));
  assert.match(violations[0]!, /undeclared cross-story coupling/);
  assert.match(violations[0]!, /library.*store/);
  // The fix-pointing message names BOTH declaration sites (consumer depends_on / provider consumed_by).
  assert.match(violations[0]!, /depends_on/);
  assert.match(violations[0]!, /consumed_by/);
});

test("an undeclared edge passes once it is DECLARED on an endpoint", () => {
  // NOTE: the library→store edge above can NEVER pass — store depends_on library, so library→store
  // is a genuine cycle (store sits ABOVE the domain organisms whose seams it realizes; only the cli
  // composition root can import it acyclically). So the declared-passes property is shown with a
  // fresh top-level consumer `@storytree/report` that store does not reach.
  const withReport: Ownership = {
    organisms: { ...ownership.organisms, "@storytree/report": "report" },
    substrate: ownership.substrate,
  };
  const packageDeps = { "@storytree/report": ["@storytree/store"] };
  // Undeclared → caught.
  const red = checkBoundaries({ ownership: withReport, packageDeps, storyGraph, consumedBy });
  assert.equal(red.violations.length, 1);
  assert.match(red.violations[0]!, /undeclared cross-story coupling/);
  // Declared consumer-side → green (no cycle: store never reaches report).
  const declared = { ...storyGraph, report: ["store"] };
  const green = checkBoundaries({
    ownership: withReport,
    packageDeps,
    storyGraph: declared,
    consumedBy,
  });
  assert.deepEqual(green.violations, [], green.violations.join("\n"));
});

test("a store→organism edge needs a declaration too (the hub is enforced, not exempt)", () => {
  // store importing studio-members with the declaration removed → caught (proves store is no longer
  // an exempt composition root).
  const packageDeps = { "@storytree/store": ["@storytree/studio-members"] };
  const noStoreDecls = { ...storyGraph, store: [] }; // drop store.depends_on: [..., studio-members]
  const { violations } = checkBoundaries({
    ownership,
    packageDeps,
    storyGraph: noStoreDecls,
    consumedBy,
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /undeclared cross-story coupling/);
  assert.match(violations[0]!, /store.*studio-members/);
});

test("substrate depending on an organism is rejected (keeps base/verdict-contract minimal)", () => {
  const packageDeps = { "@storytree/verdict-contract": ["@storytree/library"] };
  const { violations } = checkBoundaries({ ownership, packageDeps, storyGraph, consumedBy });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /substrate .* depends on organism/);
});

test("an organism depending on the substrate is always allowed", () => {
  const packageDeps = { "@storytree/cli": ["@storytree/base", "@storytree/verdict-contract"] };
  const { violations } = checkBoundaries({ ownership, packageDeps, storyGraph, consumedBy });
  assert.deepEqual(violations, []);
});

test("an unclassified package is caught (a new package can't slip in unowned)", () => {
  const packageDeps = { "@storytree/library": ["@storytree/newcomer"] };
  const { violations } = checkBoundaries({ ownership, packageDeps, storyGraph, consumedBy });
  assert.ok(violations.some((v) => /unclassified package "@storytree\/newcomer"/.test(v)));
});

test("a package classified in two categories is caught", () => {
  const bad: Ownership = {
    organisms: { "@storytree/base": "library" },
    substrate: ["@storytree/base"],
  };
  const { violations } = checkBoundaries({ ownership: bad, packageDeps: {}, storyGraph: {} });
  assert.ok(violations.some((v) => /more than one category/.test(v)));
});

test("a cross-story dependency cycle is caught (ADR-0058)", () => {
  const cyclic = { a: ["b"], b: ["c"], c: ["a"] };
  const { violations } = checkBoundaries({
    ownership: { organisms: {}, substrate: [] },
    packageDeps: {},
    storyGraph: cyclic,
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /cycle/);
});

test("a cycle smuggled in through consumed_by is caught (the merged graph is checked)", () => {
  // depends_on a → b; consumed_by says a is consumed by b (edge b → a) → cycle a ⇄ b.
  const { violations } = checkBoundaries({
    ownership: { organisms: {}, substrate: [] },
    packageDeps: {},
    storyGraph: { a: ["b"], b: [] },
    consumedBy: { a: ["b"] },
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /cycle/);
});

test("findCycle returns null on a DAG and a node path on a cycle", () => {
  assert.equal(findCycle({ a: ["b"], b: [] }), null);
  const c = findCycle({ a: ["b"], b: ["a"] });
  assert.ok(c && c[0] === c[c.length - 1], "cycle path starts and ends at the same node");
});
