// check:web-experience — the experience-rollout-guardrails capability (ADR-0134).
//
// This file tests the PURE CORE of the check: three judges that combine into a single verdict
// over a fixture site-tree (why this is a capability, not a contract):
//
//   1. THE MARKER CONTRACT — the experience entry page must carry data-experience-skip
//      (the persistent skip-to-calm control) and data-experience-fallback (the
//      prefers-reduced-motion / no-WebGL path). Presence, not adequacy (static markers
//      are cheap and stable across redesigns, per the data-grounds precedent ADR-0056).
//
//   2. THE NO-WEBGL-IN-ACT-1 WALL (ADR-0134 §1/§2) — the judge walks the static import
//      closure from the Act 1 entry module (the storm's script entry) and rejects if the
//      closure reaches `three`, any `@react-three/*` package, or any path containing
//      `forest-world-r3f`. Dynamic import() at the inflection is the sanctioned lazy-load
//      seam and is NOT counted (it doesn't reach the first-paint bundle).
//
//   3. THE BOOTSTRAP ALLOWANCE — absent an experience entry in web/ the CLI shell SKIPs
//      rather than failing (the guard lands before the storm). The pure `checkExperienceEntry`
//      tested here is only called when an entry already exists.
//
// The implementation shell (`main()` in web-experience-check.ts) handles the web/ submodule
// local-SKIP / CI-fail posture and bootstrap allowance, following check-web-engine's pattern.
//
// Proof: node --import tsx --test packages/cli/src/web-experience-check.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkExperienceEntry,
  extractStaticImports,
  findExperienceMarkers,
  isWebGlSpecifier,
  walkStaticClosure,
} from "./web-experience-check.js";

// ── findExperienceMarkers ─────────────────────────────────────────────────────
// Check the experience entry page for the two required affordance markers.

test("findExperienceMarkers detects both data-experience-skip and data-experience-fallback", () => {
  const html = `
    <button data-experience-skip aria-label="Skip to calm">Skip</button>
    <div data-experience-fallback hidden>Reduced motion fallback</div>
  `;
  const m = findExperienceMarkers(html);
  assert.equal(m.hasSkip, true, "data-experience-skip present");
  assert.equal(m.hasFallback, true, "data-experience-fallback present");
});

test("findExperienceMarkers returns both false when neither marker is present", () => {
  const m = findExperienceMarkers("<main><p>No affordance markers here</p></main>");
  assert.equal(m.hasSkip, false);
  assert.equal(m.hasFallback, false);
});

test("findExperienceMarkers detects skip without fallback", () => {
  const m = findExperienceMarkers('<button data-experience-skip>Skip to calm</button>');
  assert.equal(m.hasSkip, true);
  assert.equal(m.hasFallback, false);
});

test("findExperienceMarkers detects fallback without skip", () => {
  const m = findExperienceMarkers('<div data-experience-fallback>Reduced motion path</div>');
  assert.equal(m.hasSkip, false);
  assert.equal(m.hasFallback, true);
});

// ── extractStaticImports ──────────────────────────────────────────────────────
// Pull the specifiers the bundler sees at first paint — static edges only.

test("extractStaticImports collects named, default, namespace, and export-from specifiers", () => {
  const src = [
    `import { storm } from './storm.ts';`,
    `import defaultExport from '../audio.ts';`,
    `import * as ns from 'gsap';`,
    `export { render } from './render.ts';`,
    `export * from './utils.ts';`,
  ].join("\n");
  const specs = extractStaticImports(src);
  assert.ok(specs.includes("./storm.ts"), "named import");
  assert.ok(specs.includes("../audio.ts"), "default import");
  assert.ok(specs.includes("gsap"), "bare specifier");
  assert.ok(specs.includes("./render.ts"), "export-from");
  assert.ok(specs.includes("./utils.ts"), "export-star-from");
});

test("extractStaticImports excludes dynamic import() calls", () => {
  const src = [
    `import { a } from './static.ts';`,
    `const m1 = await import('./dynamic.ts');`,
    `const m2 = import('./lazy.ts');`,
  ].join("\n");
  const specs = extractStaticImports(src);
  assert.ok(specs.includes("./static.ts"), "static import is included");
  assert.ok(!specs.includes("./dynamic.ts"), "await import() is excluded");
  assert.ok(!specs.includes("./lazy.ts"), "bare import() is excluded");
});

test("extractStaticImports excludes import type declarations (no runtime load)", () => {
  const src = [
    `import type { Foo } from './types.ts';`,
    `import { Bar } from './values.ts';`,
  ].join("\n");
  const specs = extractStaticImports(src);
  assert.ok(!specs.includes("./types.ts"), "import type excluded");
  assert.ok(specs.includes("./values.ts"), "value import included");
});

// ── isWebGlSpecifier ──────────────────────────────────────────────────────────
// Detect the forbidden WebGL/R3F surface from a resolved specifier or path.

test("isWebGlSpecifier flags the bare `three` package", () => {
  assert.equal(isWebGlSpecifier("three"), true);
});

test("isWebGlSpecifier flags @react-three/* namespace packages", () => {
  assert.equal(isWebGlSpecifier("@react-three/fiber"), true);
  assert.equal(isWebGlSpecifier("@react-three/drei"), true);
  assert.equal(isWebGlSpecifier("@react-three/postprocessing"), true);
});

test("isWebGlSpecifier flags any path containing the forest-world-r3f dir segment", () => {
  assert.equal(isWebGlSpecifier("../lib/forest-world-r3f/index.ts"), true);
  assert.equal(isWebGlSpecifier("./src/forest-world-r3f/scene.ts"), true);
  assert.equal(isWebGlSpecifier("src/forest-world-r3f/index.ts"), true);
});

test("isWebGlSpecifier passes non-WebGL specifiers", () => {
  assert.equal(isWebGlSpecifier("./canvas.ts"), false, "plain canvas");
  assert.equal(isWebGlSpecifier("gsap"), false, "animation lib");
  assert.equal(isWebGlSpecifier("@web-audio/worklet"), false, "audio namespace");
  assert.equal(isWebGlSpecifier("../forest-world/index.ts"), false, "plain forest-world without r3f");
  assert.equal(isWebGlSpecifier("./three-utils.ts"), false, "local file starting with 'three'");
});

// ── walkStaticClosure ─────────────────────────────────────────────────────────
// Graph walk from the Act 1 entry — injection-testable via in-memory file maps.

test("walkStaticClosure follows static imports transitively through the file graph", () => {
  const files = new Map<string, string>([
    ["src/act1.ts", `import { s } from './storm.ts'; import { a } from './audio.ts';`],
    ["src/storm.ts", `import { c } from './canvas.ts';`],
    ["src/audio.ts", `/* no imports */`],
    ["src/canvas.ts", `/* leaf */`],
  ]);
  const readFile = (p: string): string | null => files.get(p) ?? null;
  const closure = walkStaticClosure("src/act1.ts", readFile);
  assert.ok(closure.has("src/storm.ts"), "direct dep storm.ts");
  assert.ok(closure.has("src/audio.ts"), "direct dep audio.ts");
  assert.ok(closure.has("src/canvas.ts"), "transitive dep via storm.ts");
});

test("walkStaticClosure includes bare external package specifiers in the closure", () => {
  const files = new Map<string, string>([
    ["src/act1.ts", `import { tween } from 'gsap'; import { a } from './local.ts';`],
    ["src/local.ts", `/* leaf */`],
  ]);
  const closure = walkStaticClosure("src/act1.ts", (p) => files.get(p) ?? null);
  assert.ok(closure.has("gsap"), "external bare specifier in closure");
  assert.ok(closure.has("src/local.ts"), "resolved local path in closure");
});

test("walkStaticClosure does NOT include dynamic import() targets", () => {
  const files = new Map<string, string>([
    ["src/act1.ts", `
      import { canvas } from './canvas.ts';
      // the sanctioned Act-2 lazy-load seam — not in the static closure:
      const loadAct2 = () => import('three');
    `],
    ["src/canvas.ts", `/* no WebGL */`],
  ]);
  const closure = walkStaticClosure("src/act1.ts", (p) => files.get(p) ?? null);
  assert.ok(!closure.has("three"), "dynamic import target excluded from static closure");
  assert.ok(closure.has("src/canvas.ts"), "static import still traversed");
});

test("walkStaticClosure handles circular imports without infinite looping", () => {
  const files = new Map<string, string>([
    ["src/a.ts", `import { b } from './b.ts';`],
    ["src/b.ts", `import { a } from './a.ts';`],
  ]);
  // Must return, not hang
  const closure = walkStaticClosure("src/a.ts", (p) => files.get(p) ?? null);
  assert.ok(closure.has("src/b.ts"), "b.ts reachable from a.ts");
  assert.ok(closure.has("src/a.ts"), "entry a.ts in closure");
});

// ── checkExperienceEntry — integration over fixture site-trees ────────────────
// The single judge combining the marker contract + WebGL wall (why this is a
// capability not three separate contracts — one verdict, one gate).

test("checkExperienceEntry passes for a well-formed entry with WebGL-free Act 1 closure", () => {
  const page = `
    <button data-experience-skip>Skip to calm</button>
    <div data-experience-fallback>Reduced motion fallback</div>
  `;
  const files = new Map<string, string>([
    ["src/act1.ts", `import { canvas } from './canvas.ts'; import { audio } from './audio.ts';`],
    ["src/canvas.ts", `/* plain Canvas 2D API */`],
    ["src/audio.ts", `/* Web Audio API */`],
  ]);
  const problems = checkExperienceEntry(page, "src/act1.ts", (p) => files.get(p) ?? null);
  assert.deepEqual(problems, [], "no problems for a well-formed entry");
});

test("checkExperienceEntry fails when data-experience-skip is absent", () => {
  const page = `<div data-experience-fallback>Fallback only</div>`;
  const problems = checkExperienceEntry(page, "src/act1.ts", () => null);
  const kinds = problems.map((p) => p.kind);
  assert.ok(kinds.includes("missing-skip-marker"), `expected missing-skip-marker in ${JSON.stringify(kinds)}`);
});

test("checkExperienceEntry fails when data-experience-fallback is absent", () => {
  const page = `<button data-experience-skip>Skip only</button>`;
  const problems = checkExperienceEntry(page, "src/act1.ts", () => null);
  const kinds = problems.map((p) => p.kind);
  assert.ok(kinds.includes("missing-fallback-marker"), `expected missing-fallback-marker in ${JSON.stringify(kinds)}`);
});

test("checkExperienceEntry reports both problems when neither marker is present", () => {
  const page = `<main>No affordance markers at all</main>`;
  const problems = checkExperienceEntry(page, "src/act1.ts", () => null);
  const kinds = problems.map((p) => p.kind);
  assert.ok(kinds.includes("missing-skip-marker"), "missing-skip-marker reported");
  assert.ok(kinds.includes("missing-fallback-marker"), "missing-fallback-marker reported");
});

test("checkExperienceEntry fails when Act 1 directly imports three", () => {
  const page = `
    <button data-experience-skip>Skip</button>
    <div data-experience-fallback>Fallback</div>
  `;
  const files = new Map<string, string>([
    ["src/act1.ts", `import * as THREE from 'three';`],
  ]);
  const problems = checkExperienceEntry(page, "src/act1.ts", (p) => files.get(p) ?? null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.kind, "webgl-leak");
  assert.match(problems[0]?.detail ?? "", /three/);
});

test("checkExperienceEntry fails when three is transitively reachable via static imports", () => {
  const page = `
    <button data-experience-skip>Skip</button>
    <div data-experience-fallback>Fallback</div>
  `;
  const files = new Map<string, string>([
    ["src/act1.ts", `import { storm } from './storm.ts';`],
    ["src/storm.ts", `import * as THREE from 'three';`],
  ]);
  const problems = checkExperienceEntry(page, "src/act1.ts", (p) => files.get(p) ?? null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.kind, "webgl-leak");
});

test("checkExperienceEntry passes when three is reached only via dynamic import (the inflection seam)", () => {
  const page = `
    <button data-experience-skip>Skip</button>
    <div data-experience-fallback>Fallback</div>
  `;
  const files = new Map<string, string>([
    ["src/act1.ts", `
      import { canvas } from './canvas.ts';
      // lazy-load at the Act-1 → Act-2 inflection — the sanctioned seam:
      const loadScene = () => import('three');
    `],
    ["src/canvas.ts", `/* no WebGL — plain canvas API */`],
  ]);
  const problems = checkExperienceEntry(page, "src/act1.ts", (p) => files.get(p) ?? null);
  assert.deepEqual(problems, [], "dynamic-only path is allowed");
});

test("checkExperienceEntry fails when Act 1 imports from the @react-three/* namespace", () => {
  const page = `
    <button data-experience-skip>Skip</button>
    <div data-experience-fallback>Fallback</div>
  `;
  const files = new Map<string, string>([
    ["src/act1.ts", `import { Canvas } from '@react-three/fiber';`],
  ]);
  const problems = checkExperienceEntry(page, "src/act1.ts", (p) => files.get(p) ?? null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.kind, "webgl-leak");
  assert.match(problems[0]?.detail ?? "", /@react-three/);
});

test("checkExperienceEntry fails when a path containing forest-world-r3f is statically reachable", () => {
  const page = `
    <button data-experience-skip>Skip</button>
    <div data-experience-fallback>Fallback</div>
  `;
  // forest-world-r3f is the synced R3F island dir (ADR-0134 §1 tech split); its path in
  // the resolved closure signals that the R3F bundle would be dragged into first paint.
  const files = new Map<string, string>([
    ["src/act1.ts", `import { Scene } from './forest-world-r3f/scene.ts';`],
  ]);
  const problems = checkExperienceEntry(page, "src/act1.ts", (p) => files.get(p) ?? null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.kind, "webgl-leak");
  assert.match(problems[0]?.detail ?? "", /forest-world-r3f/);
});
