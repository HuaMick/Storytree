import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkBoundaries,
  classOf,
  extractImports,
  findCycle,
  isTestScaffolding,
  mergeDeclaredGraph,
  stripComments,
  type Ownership,
  type SourceImport,
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

// ── The v2 source-import scan (ADR-0074 §"does NOT decide") ────────────────────────────────────────
// Closes the two couplings the package.json dep-graph rule can't see: (a) a cross-package RELATIVE
// import that sidesteps both the dep declaration AND the exports barrel, and (b) a runtime source file
// value-importing an organism that is only a devDependency (or undeclared).

// A helper: run only the source-import rules in isolation (no declared deps / story edges to add
// unrelated violations).
function sourceOnly(sourceImports: SourceImport[]): string[] {
  return checkBoundaries({ ownership, packageDeps: {}, storyGraph: {}, consumedBy: {}, sourceImports })
    .violations;
}

test("stripComments removes commented-out imports but keeps real string specifiers", () => {
  const src = [
    `// import { x } from "@storytree/evil";`,
    `/* import { y } from "@storytree/also-evil"; */`,
    `import { z } from "@storytree/library"; // trailing comment`,
    `const url = "https://example.com/not-an-import";`,
  ].join("\n");
  assert.deepEqual(
    extractImports(src).map((g) => g.specifier),
    ["@storytree/library"],
  );
  // stripComments preserves the real string literal untouched.
  assert.match(stripComments(src), /@storytree\/library/);
  assert.doesNotMatch(stripComments(src), /also-evil/);
});

test("extractImports covers static / type / side-effect / dynamic / re-export, with typeOnly", () => {
  const src = [
    `import { a } from "@storytree/library";`,
    `import type { B } from "@storytree/base";`,
    `import * as ns from "../../store/src/x.js";`,
    `import "./side-effect.js";`,
    `export { c } from "@storytree/notice-board";`,
    `export type { D } from "@storytree/verdict-contract";`,
    `const m = await import("@storytree/agent");`,
    `import { value, type T } from "@storytree/store";`,
  ].join("\n");
  const got = extractImports(src);
  const find = (s: string): { specifier: string; typeOnly: boolean } | undefined =>
    got.find((g) => g.specifier === s);
  assert.equal(find("@storytree/library")?.typeOnly, false);
  assert.equal(find("@storytree/base")?.typeOnly, true);
  assert.ok(find("../../store/src/x.js"));
  assert.ok(find("./side-effect.js"));
  assert.equal(find("@storytree/notice-board")?.typeOnly, false);
  assert.equal(find("@storytree/verdict-contract")?.typeOnly, true);
  assert.ok(find("@storytree/agent")); // dynamic import
  assert.equal(find("@storytree/store")?.typeOnly, false); // inline `type T` is NOT a type-only import
});

test("isTestScaffolding flags test files + parity suites, not ordinary source", () => {
  assert.equal(isTestScaffolding("packages/store/src/pg-work-store.test.ts"), true);
  assert.equal(isTestScaffolding("packages/store/src/pg-change-store.live.test.ts"), true);
  assert.equal(isTestScaffolding("packages/base/src/store-parity.ts"), true);
  assert.equal(isTestScaffolding("packages/orchestrator/src/proof/rollup-parity.ts"), true);
  assert.equal(isTestScaffolding("packages/store/src/pg-store.ts"), false);
});

test("Gap A': the scan catches a planted cross-package RELATIVE import", () => {
  const v = sourceOnly([
    {
      importer: "@storytree/orchestrator",
      file: "packages/orchestrator/src/sequence.ts",
      specifier: "../../store/src/pg-store.js", // reaches into another package by path
      typeOnly: false,
    },
  ]);
  assert.equal(v.length, 1, v.join("\n"));
  assert.match(v[0]!, /cross-package relative import/);
  assert.match(v[0]!, /@storytree\/store/); // points at the barrel to use
});

test("Gap A': a type-only relative escape is still caught (the barrel must be used regardless)", () => {
  const v = sourceOnly([
    {
      importer: "@storytree/agent",
      file: "packages/agent/src/step.ts",
      specifier: "../../library/src/schema.js",
      typeOnly: true,
    },
  ]);
  assert.equal(v.length, 1);
  assert.match(v[0]!, /cross-package relative import/);
});

test("a relative import that stays in-package is fine (incl. across subdirs)", () => {
  assert.deepEqual(
    sourceOnly([
      {
        importer: "@storytree/orchestrator",
        file: "packages/orchestrator/src/proof/signer.ts",
        specifier: "../sequence.js", // packages/orchestrator/src/sequence.js — same package
        typeOnly: false,
      },
    ]),
    [],
  );
});

test("Gap B': the scan catches a planted devDep-only RUNTIME @storytree import", () => {
  // store value-imports orchestrator from a runtime (non-test) file; orchestrator is only store's
  // devDependency, so the package.json dep-graph rule never sees it.
  const v = sourceOnly([
    {
      importer: "@storytree/store",
      file: "packages/store/src/pg-store.ts",
      specifier: "@storytree/orchestrator",
      typeOnly: false,
    },
  ]);
  assert.equal(v.length, 1, v.join("\n"));
  assert.match(v[0]!, /devDep\/undeclared runtime import/);
  assert.match(v[0]!, /@storytree\/orchestrator/);
});

test("Gap B': a type-only cross-package import is NOT flagged (erased, not a runtime coupling)", () => {
  assert.deepEqual(
    sourceOnly([
      {
        importer: "@storytree/store",
        file: "packages/store/src/pg-store.ts",
        specifier: "@storytree/orchestrator",
        typeOnly: true,
      },
    ]),
    [],
  );
});

test("the scan does NOT flag test-file / parity reuse (the real devDep parity scaffolding)", () => {
  // These are exactly the existing sanctioned reuses (ADR-0010 §5): they MUST stay green.
  assert.deepEqual(
    sourceOnly([
      // store's test reuses orchestrator's parity suite (the real store→orchestrator devDep).
      {
        importer: "@storytree/store",
        file: "packages/store/src/pg-work-store.test.ts",
        specifier: "@storytree/orchestrator",
        typeOnly: false,
      },
      // verdict-contract's parity test imports library (the real verdict-contract↔library devDep).
      {
        importer: "@storytree/verdict-contract",
        file: "packages/verdict-contract/src/parity.test.ts",
        specifier: "@storytree/library",
        typeOnly: false,
      },
      // a parity SUITE definition file reaching cross-package is sanctioned scaffolding too.
      {
        importer: "@storytree/base",
        file: "packages/base/src/store-parity.ts",
        specifier: "@storytree/orchestrator",
        typeOnly: false,
      },
    ]),
    [],
  );
});

test("the scan ignores substrate, same-package, and bare-external specifiers", () => {
  assert.deepEqual(
    sourceOnly([
      // substrate is always an allowed target (even undeclared in this isolated input).
      {
        importer: "@storytree/library",
        file: "packages/library/src/schema.ts",
        specifier: "@storytree/verdict-contract",
        typeOnly: false,
      },
      // same package.
      {
        importer: "@storytree/store",
        file: "packages/store/src/pg-store.ts",
        specifier: "@storytree/store",
        typeOnly: false,
      },
      // bare externals.
      {
        importer: "@storytree/store",
        file: "packages/store/src/pg-store.ts",
        specifier: "node:crypto",
        typeOnly: false,
      },
      { importer: "@storytree/store", file: "packages/store/src/pg-store.ts", specifier: "pg", typeOnly: false },
      // a same-package relative import.
      { importer: "@storytree/store", file: "packages/store/src/pg-store.ts", specifier: "./connection.js", typeOnly: false },
    ]),
    [],
  );
});

test("a runtime @storytree import backed by a declared dependency is NOT flagged", () => {
  // store value-imports library and library IS a runtime dep + a declared cross-story edge.
  const { violations } = checkBoundaries({
    ownership,
    packageDeps: { "@storytree/store": ["@storytree/library"] },
    storyGraph: { store: ["library"] },
    consumedBy: {},
    sourceImports: [
      {
        importer: "@storytree/store",
        file: "packages/store/src/pg-store.ts",
        specifier: "@storytree/library",
        typeOnly: false,
      },
    ],
  });
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("a representative clean set of real source imports adds zero source violations", () => {
  const sourceImports: SourceImport[] = [
    { importer: "@storytree/cli", file: "packages/cli/src/commands.ts", specifier: "@storytree/orchestrator", typeOnly: false }, // cli dep ✓
    { importer: "@storytree/store", file: "packages/store/src/pg-store.ts", specifier: "@storytree/library", typeOnly: false }, // store dep ✓
    { importer: "@storytree/library", file: "packages/library/src/schema.ts", specifier: "@storytree/verdict-contract", typeOnly: false }, // substrate ✓
    { importer: "@storytree/store", file: "packages/store/src/pg-work-store.test.ts", specifier: "@storytree/orchestrator", typeOnly: false }, // test scaffolding ✓
    { importer: "@storytree/orchestrator", file: "packages/orchestrator/src/proof/signer.ts", specifier: "../anchor-compute.js", typeOnly: false }, // in-package ✓
    { importer: "@storytree/store", file: "packages/store/src/pg-store.ts", specifier: "node:crypto", typeOnly: false }, // external ✓
  ];
  const { violations } = checkBoundaries({
    ownership,
    packageDeps: realPackageDeps,
    storyGraph,
    consumedBy,
    sourceImports,
  });
  assert.deepEqual(violations, [], violations.join("\n"));
});
