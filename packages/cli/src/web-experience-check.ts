// check:web-experience — the experience-rollout-guardrails capability (ADR-0134).
//
// The pure core of the check: three judges that combine into a single verdict. The fs shell
// (main()) handles the web/ submodule local-SKIP / CI-fail posture and bootstrap allowance,
// following check-web-engine's pattern.
//
// Exported for testing:
//   findExperienceMarkers  — marker contract (data-experience-skip / data-experience-fallback)
//   extractStaticImports   — pull first-paint import specifiers from source text
//   isWebGlSpecifier       — detect three / @react-three/* / forest-world-r3f
//   walkStaticClosure      — graph walk from the Act 1 entry (injection-testable)
//   checkExperienceEntry   — the combined judge (marker contract + WebGL wall)
//
// Proof: node --import tsx --test packages/cli/src/web-experience-check.test.ts

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExperienceMarkers {
  readonly hasSkip: boolean;
  readonly hasFallback: boolean;
}

export interface ExperienceProblem {
  readonly kind: "missing-skip-marker" | "missing-fallback-marker" | "webgl-leak";
  readonly detail?: string;
}

// ── findExperienceMarkers ─────────────────────────────────────────────────────

/**
 * Detect the two required affordance markers in an HTML page.
 * Presence, not adequacy — static attribute search.
 */
export function findExperienceMarkers(html: string): ExperienceMarkers {
  return {
    hasSkip: html.includes("data-experience-skip"),
    hasFallback: html.includes("data-experience-fallback"),
  };
}

// ── extractStaticImports ──────────────────────────────────────────────────────

// Matches static `import … from '…'` and bare `import '…'` statements.
// Anchored at a statement boundary (^, ; or \n) to exclude dynamic import() calls.
// The negative lookahead (?!type[\s{*,]) excludes `import type` declarations.
const STATIC_IMPORT_RE =
  /(?:^|[;\n])\s*import\s+(?!type[\s{*,])(?:[^'"(;\n]*?\bfrom\s+)?['"]([^'"]+)['"]/gm;

// Matches `export { … } from '…'` and `export * from '…'`.
const EXPORT_FROM_RE =
  /(?:^|[;\n])\s*export\s+(?:[^'";\n]*?\bfrom\s+)['"]([^'"]+)['"]/gm;

/**
 * Extract all specifiers reachable at first paint — static import/export-from edges only.
 * Dynamic `import()` calls and `import type` declarations are excluded.
 */
export function extractStaticImports(src: string): string[] {
  const specifiers: string[] = [];

  for (const m of src.matchAll(STATIC_IMPORT_RE)) {
    const spec = m[1];
    if (spec !== undefined) specifiers.push(spec);
  }

  for (const m of src.matchAll(EXPORT_FROM_RE)) {
    const spec = m[1];
    if (spec !== undefined) specifiers.push(spec);
  }

  return specifiers;
}

// ── isWebGlSpecifier ──────────────────────────────────────────────────────────

/**
 * Returns true if the specifier or resolved path reaches a WebGL surface that must not
 * appear in the Act 1 static closure: the bare `three` package, any `@react-three/*`
 * namespace package, or any path whose segments include `forest-world-r3f` (the synced
 * R3F island dir, ADR-0134 §1 tech split).
 */
export function isWebGlSpecifier(specifier: string): boolean {
  if (specifier === "three") return true;
  if (specifier.startsWith("@react-three/")) return true;
  return specifier.split("/").includes("forest-world-r3f");
}

// ── walkStaticClosure ─────────────────────────────────────────────────────────

/**
 * Resolve a relative import specifier from the directory of `fromFile`.
 * Bare specifiers (not starting with `.`) are returned as-is and tracked in the closure.
 */
function resolveSpecifier(fromFile: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  const fromDir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : ".";
  const combined = `${fromDir}/${specifier}`;
  const parts = combined.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== ".") {
      resolved.push(part);
    }
  }
  return resolved.join("/");
}

/**
 * Walk the static import closure from `entryPath`, returning every reachable specifier /
 * path (including the entry itself). `readFile` returns source text or null for nodes that
 * cannot be read (external packages, absent files) — those are still included in the closure
 * but not recursed into. Handles circular imports without looping.
 */
export function walkStaticClosure(
  entryPath: string,
  readFile: (p: string) => string | null,
): Set<string> {
  const closure = new Set<string>();
  const queue: string[] = [entryPath];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (closure.has(current)) continue;
    closure.add(current);

    const content = readFile(current);
    if (content === null) continue;

    for (const specifier of extractStaticImports(content)) {
      const resolved = resolveSpecifier(current, specifier);
      if (!closure.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return closure;
}

// ── checkExperienceEntry ──────────────────────────────────────────────────────

/**
 * The combined judge: marker contract + WebGL wall. Returns an empty array when the
 * entry passes, or one or more `ExperienceProblem` entries when it fails.
 */
export function checkExperienceEntry(
  page: string,
  act1Entry: string,
  readFile: (p: string) => string | null,
): ExperienceProblem[] {
  const problems: ExperienceProblem[] = [];

  // 1. Marker contract
  const markers = findExperienceMarkers(page);
  if (!markers.hasSkip) {
    problems.push({
      kind: "missing-skip-marker",
      detail: "data-experience-skip not found in the experience entry page",
    });
  }
  if (!markers.hasFallback) {
    problems.push({
      kind: "missing-fallback-marker",
      detail: "data-experience-fallback not found in the experience entry page",
    });
  }

  // 2. No-WebGL-in-Act-1 wall
  const closure = walkStaticClosure(act1Entry, readFile);
  for (const specifier of closure) {
    if (isWebGlSpecifier(specifier)) {
      problems.push({ kind: "webgl-leak", detail: specifier });
    }
  }

  return problems;
}

// ── CLI shell (main) ──────────────────────────────────────────────────────────

function main(): void {
  // packages/cli/src/web-experience-check.ts → four dirs up (the build-claude-md.ts pattern).
  const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
  const webRoot = path.join(repoRoot, "web");
  const inCi = process.env.CI === "true";

  if (!existsSync(webRoot)) {
    if (inCi) {
      console.error(
        "check:web-experience — web/ is not checked out in CI. The workflow must clone the " +
          "pinned storytree-web submodule before this step.",
      );
      process.exit(1);
    }
    console.log(
      "check:web-experience — SKIP: web/ submodule not checked out " +
        "(run `git submodule update --init web` to enable this check locally).",
    );
    return;
  }

  // Bootstrap allowance: no experience entry yet → SKIP, never fail.
  // The entry path convention follows ADR-0134 (to be refined when the entry is authored).
  const entryHtmlCandidates = [
    path.join(webRoot, "src", "pages", "experience.astro"),
    path.join(webRoot, "src", "pages", "index.astro"),
  ];
  const entryHtml = entryHtmlCandidates.find((p) => existsSync(p));
  if (entryHtml === undefined) {
    console.log(
      "check:web-experience — SKIP: no experience entry page found in web/src/pages/ " +
        "(bootstrap allowance — the guard lands before the storm).",
    );
    return;
  }

  const page = readFileSync(entryHtml, "utf8");

  // Act 1 entry: the storm's script entry (convention; adapt when the web tree is adopted).
  const act1EntryCandidates = [
    path.join(webRoot, "src", "scripts", "act1.ts"),
    path.join(webRoot, "src", "scripts", "storm.ts"),
  ];
  const act1EntryAbs = act1EntryCandidates.find((p) => existsSync(p));

  const readFile = (absPath: string): string | null => {
    try {
      return readFileSync(absPath, "utf8");
    } catch {
      return null;
    }
  };

  const act1Entry = act1EntryAbs ?? path.join(webRoot, "src", "scripts", "act1.ts");

  const problems = checkExperienceEntry(page, act1Entry, readFile);

  if (problems.length > 0) {
    console.error(
      `check:web-experience — BLOCKED: ${problems.length} problem(s) in the experience entry:\n`,
    );
    for (const p of problems) {
      console.error(`  ✗ [${p.kind}]${p.detail !== undefined ? `: ${p.detail}` : ""}`);
    }
    process.exit(1);
  }

  console.log(
    "check:web-experience — OK: experience entry carries both affordance markers and Act 1 is WebGL-free.",
  );
}

// Run only when invoked directly (`tsx src/web-experience-check.ts`), not when the test imports.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
