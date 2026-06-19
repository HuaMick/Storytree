/**
 * SPIKE (claude/spike-port-vs-root, ADR-0074 A-vs-B port-modelling fork) — NOT FOR LANDING.
 *
 * Tests the crux objection to Option B (ports as ROOT organisms instead of an exempt `substrate`
 * class): "dropping the `substrate may not depend on an organism` rule loses the browser-safety
 * guardrail." The pure judge ({@link checkBoundaries}) shows the objection is largely answered by a
 * rule B ALREADY has — acyclicity — because the ports are the universal BOTTOM SINKS (every organism
 * transitively depends on them), so any port→organism back-edge closes a cycle.
 *
 * Probe: base → store (store is browser-UNSAFE — it pulls `pg`/node:net). Run:
 *   pnpm --filter @storytree/cli exec node --import tsx src/spike-port-cost-demo.ts
 */
import { checkBoundaries, type Ownership } from "./boundaries.js";

const organisms = {
  "@storytree/library": "library",
  "@storytree/orchestrator": "drive-machinery",
  "@storytree/agent": "drive-machinery",
  "@storytree/notice-board": "notice-board",
  "@storytree/studio-members": "studio-members",
  "@storytree/store": "store",
  "@storytree/cli": "cli",
};

// Option A — base/verdict-contract are the exempt `substrate` class.
const ownershipA: Ownership = {
  organisms,
  substrate: ["@storytree/base", "@storytree/verdict-contract"],
};

// Option B — base/verdict-contract are ROOT organisms (own stories, no special class).
const ownershipB: Ownership = {
  organisms: { ...organisms, "@storytree/base": "base", "@storytree/verdict-contract": "verdict-contract" },
  substrate: [],
};

// The faithful B story graph (matches the spike's stories/*/story.md edits).
const storyGraphB: Record<string, string[]> = {
  "verdict-contract": [],
  base: ["verdict-contract"],
  library: ["verdict-contract"],
  "drive-machinery": ["library", "base", "verdict-contract"],
  "notice-board": ["library", "drive-machinery"],
  "studio-members": ["studio-cloud", "library"],
  store: ["library", "notice-board", "studio-members", "base", "verdict-contract"],
  cli: [],
};
const consumedByB: Record<string, string[]> = {
  "verdict-contract": ["cli"], base: ["cli"], library: ["cli"],
  "drive-machinery": ["cli"], "notice-board": ["cli"], store: ["cli"],
};

// The planted browser-UNSAFE coupling: base value-imports the node-only `store` organism (pg/node:net).
const planted = { "@storytree/base": ["@storytree/store", "@storytree/verdict-contract"] };
const line = (s: string): void => console.log(s);

line("=== ADR-0074 Option A vs B — is the browser-safety guardrail really lost under B? ===\n");

// A: the dedicated substrate rule fails it offline, immediately.
const a = checkBoundaries({ ownership: ownershipA, packageDeps: planted, storyGraph: {}, consumedBy: {} });
line(`A (substrate class)    base→store : ${a.violations.length} violation — ${a.violations[0]?.slice(0, 70)}…`);

// B undeclared: the coverage rule fails it (every cross-organism edge must be declared).
const bUndeclared = checkBoundaries({ ownership: ownershipB, packageDeps: planted, storyGraph: storyGraphB, consumedBy: consumedByB });
line(`B undeclared           base→store : ${bUndeclared.violations.length} violation — ${bUndeclared.violations[0]?.match(/undeclared[^.]*/)?.[0]}…`);

// B declared: declaring it (base.depends_on store) turns it into a CYCLE, because store→base exists.
const storyGraphBDeclared = { ...storyGraphB, base: ["verdict-contract", "store"] };
const bDeclared = checkBoundaries({ ownership: ownershipB, packageDeps: planted, storyGraph: storyGraphBDeclared, consumedBy: consumedByB });
line(`B declared             base→store : ${bDeclared.violations.length} violation — ${bDeclared.violations[0]}`);

line("");
line("FINDING: under B, base→store can never pass — undeclared ⇒ coverage violation; declared ⇒ a");
line("CYCLE (store already depends_on base). The ports are the universal bottom SINKS, so any");
line("port→organism reach closes a cycle. B's EXISTING acyclicity rule already enforces the");
line("browser-safety floor for @storytree couplings — no dedicated 'substrate' rule required.");
line("");
line("RESIDUAL (identical under A and B): a port importing an EXTERNAL node-only npm package (e.g.");
line("`import \"pg\"` in base) is invisible to BOTH gates — A's substrate rule only blocks @storytree");
line("organisms, never npm — so the studio browser build is the real backstop for that case either way.");
