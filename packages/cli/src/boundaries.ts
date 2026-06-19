/**
 * The organism-boundary analyser (ADR-0074). PURE — no I/O. The `check:boundaries` script
 * ({@link file://./check-boundaries.ts}) gathers the inputs from disk (package.json dep graph +
 * each story's `depends_on`/`consumed_by` + the ownership map); this module just JUDGES them, so
 * the rule set is exhaustively unit-testable offline.
 *
 * The invariant it gates (ADR-0010 §3/§4, ADR-0058, ADR-0068, ADR-0074): every real cross-organism
 * CODE dependency edge must be COVERED by a declaration on one of its endpoints — consumer-side in
 * the consumer's `depends_on`, OR provider-side in the provider's `consumed_by` — with a small
 * blessed set of shared substrate/ports always allowed. Because the studio forest renders
 * `depends_on`, declaring every code edge also makes it UI-visible (one rule, both gaps).
 *
 * **Two classes, ADR-0074 §2 (the hub increment).** The earlier v1 floor exempted the wiring layer
 * (`cli`/`store`) as "composition roots". That exemption is REMOVED: `cli`/`store` are now
 * first-class **hub organisms** — visible and enforced, not trusted — each owning a story + a
 * lightweight UAT (§3) and declaring its full connection set (§4). So there are exactly two package
 * classes: `organism` (owned by one story; the boundary rule applies between organisms) and
 * `substrate` (the shared ports `base`/`verdict-contract`, anyone may depend on, held minimal).
 */

/** The two package classes (ADR-0074 §2). */
export type PackageClass = "organism" | "substrate";

export interface Ownership {
  /** organism package name → the story id that owns it (the boundary rule applies between these). */
  organisms: Record<string, string>;
  /** shared substrate / port packages (no single owner; anyone may depend on them; held minimal). */
  substrate: string[];
}

export interface BoundaryInput {
  ownership: Ownership;
  /**
   * package name → its RUNTIME `@storytree/*` dependencies (from `dependencies`, NOT
   * `devDependencies` — a test reusing another organism's parity suite is scaffolding, never a
   * dependency edge, ADR-0010 §5).
   */
  packageDeps: Record<string, string[]>;
  /** story id → its declared `depends_on` story ids — EVERY story (the acyclicity check needs all). */
  storyGraph: Record<string, string[]>;
  /**
   * story id → its declared `consumed_by` story ids (ADR-0074 §4, provider-side inbound edges): the
   * stories that consume this one. `B`'s `consumed_by` listing `A` declares the edge `A → B` just as
   * `A`'s `depends_on` listing `B` would — the gate accepts either endpoint. Optional per story
   * (default `[]`); only the spokes feeding the cli/store hubs populate it in practice.
   */
  consumedBy?: Record<string, string[]>;
}

export interface BoundaryResult {
  violations: string[];
}

/** Which class a package is in, or null if it is not classified at all (itself a violation). */
export function classOf(pkg: string, o: Ownership): PackageClass | null {
  if (Object.prototype.hasOwnProperty.call(o.organisms, pkg)) return "organism";
  if (o.substrate.includes(pkg)) return "substrate";
  return null;
}

/**
 * Merge the consumer-side (`depends_on`) and provider-side (`consumed_by`) declarations into ONE
 * directed story graph: `A → B` is present iff `A`'s `depends_on` lists `B` OR `B`'s `consumed_by`
 * lists `A`. This is both the membership oracle for edge coverage and the graph the acyclicity check
 * runs over — so a cycle can't be smuggled in through `consumed_by`.
 */
export function mergeDeclaredGraph(
  storyGraph: Record<string, string[]>,
  consumedBy: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, Set<string>> = {};
  const add = (a: string, b: string): void => {
    (merged[a] ??= new Set<string>()).add(b);
  };
  // Keep every story as a node even if it has no outbound edge (so findCycle visits it).
  for (const a of Object.keys(storyGraph)) merged[a] ??= new Set<string>();
  for (const [a, deps] of Object.entries(storyGraph)) for (const b of deps) add(a, b);
  for (const [b, consumers] of Object.entries(consumedBy)) for (const a of consumers) add(a, b);
  const out: Record<string, string[]> = {};
  for (const [a, set] of Object.entries(merged)) out[a] = [...set].sort();
  return out;
}

/** Run every boundary rule over the gathered inputs and return the (possibly empty) violation list. */
export function checkBoundaries(input: BoundaryInput): BoundaryResult {
  const { ownership, packageDeps } = input;
  const consumedBy = input.consumedBy ?? {};
  const declared = mergeDeclaredGraph(input.storyGraph, consumedBy);
  const violations: string[] = [];

  // 0. Every @storytree/* package that appears (as a key or an edge target) must be classified
  //    exactly once — so a new package can't slip in unowned, and a misfile is caught.
  const allPkgs = new Set<string>(Object.keys(packageDeps));
  for (const deps of Object.values(packageDeps)) for (const d of deps) allPkgs.add(d);
  for (const pkg of [...allPkgs].sort()) {
    if (classOf(pkg, ownership) === null) {
      violations.push(
        `unclassified package "${pkg}" — declare it in repo-manifest.json packageOwnership ` +
          `(organisms / substrate)`,
      );
    }
  }
  for (const pkg of Object.keys(ownership.organisms)) {
    if (ownership.substrate.includes(pkg)) {
      violations.push(`package "${pkg}" is classified in more than one category`);
    }
  }

  // 1. Edge rules (ADR-0074 §2).
  for (const [a, deps] of Object.entries(packageDeps)) {
    const ca = classOf(a, ownership);
    for (const b of deps) {
      const cb = classOf(b, ownership);
      if (ca === null || cb === null) continue; // already reported as unclassified
      if (cb === "substrate") continue; // anyone may depend on the substrate/ports
      // cb === "organism" below
      if (ca === "substrate") {
        violations.push(
          `substrate "${a}" depends on organism "${b}" — substrate/ports stay minimal ` +
            `(zod/types only, ADR-0068 §4)`,
        );
        continue;
      }
      // ca === "organism", cb === "organism"
      const storyA = ownership.organisms[a];
      const storyB = ownership.organisms[b];
      if (storyA === undefined || storyB === undefined) continue;
      if (storyA === storyB) continue; // same organism owning multiple packages
      if (!(declared[storyA]?.includes(storyB) ?? false)) {
        violations.push(
          `undeclared cross-story coupling: "${a}" (story ${storyA}) → "${b}" (story ${storyB}). ` +
            `Declare the edge on either endpoint — add "${storyB}" to stories/${storyA}/story.md ` +
            `depends_on, OR add "${storyA}" to stories/${storyB}/story.md consumed_by — so it shows ` +
            `in the forest; or drop the dependency.`,
        );
      }
    }
  }

  // 2. The merged (depends_on ∪ consumed_by) cross-story graph must be acyclic (ADR-0058).
  const cycle = findCycle(declared);
  if (cycle) violations.push(`cross-story dependency cycle: ${cycle.join(" → ")}`);

  return { violations };
}

/**
 * Return one directed cycle in the graph (the node sequence, first repeated at the end) or null.
 * Edges to nodes absent from the graph are ignored (a depends_on referencing an unknown story is
 * out of scope here — the existence check is elsewhere).
 */
export function findCycle(graph: Record<string, string[]>): string[] | null {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color: Record<string, number> = {};
  const stack: string[] = [];
  let found: string[] | null = null;

  const visit = (n: string): void => {
    if (found) return;
    color[n] = GREY;
    stack.push(n);
    for (const m of graph[n] ?? []) {
      if (found) return;
      if (color[m] === GREY) {
        found = [...stack.slice(stack.indexOf(m)), m];
        return;
      }
      if ((color[m] ?? WHITE) === WHITE && Object.prototype.hasOwnProperty.call(graph, m)) visit(m);
    }
    stack.pop();
    color[n] = BLACK;
  };

  for (const n of Object.keys(graph)) {
    if ((color[n] ?? WHITE) === WHITE) visit(n);
  }
  return found;
}
