// Contract for the broken-worktree detector (`packages/cli/worktree-health.mjs`) — the SessionStart
// hook that announces (fail-LOUD, ADR-0162 heads-up injection) when the session's `.claude/worktrees/`
// slot is not a registered git worktree (friction `session-worktree-never-created-branch-at-main`).
// Its behavioural invariants:
//   - a slot git resolves to itself (registered) or a non-slot cwd (main/subdir) is HEALTHY → silent;
//   - a slot git resolves UP to the main checkout is BROKEN → the agent-visible SessionStart signal;
//   - `--hook` mode ALWAYS exits 0 (a heads-up, never a gate); standalone (doctor) exits 1 when broken.
// The detector stays plain Node ESM (no tsx/deps — it may run before node_modules exists), so this
// sibling only types the exported surface. (Mirrors provision-worktree.d.mts / scripts/studio.d.mts.)

/** A git-derived fact pair for a cwd: the working-tree root git resolves it to, and the primary checkout. */
export interface GitProbe {
  topLevel: string | null;
  mainRoot: string | null;
}

/** The health verdict kinds — `broken` is the only unhealthy one (see {@link classifyWorktreeHealth}). */
export type WorktreeKind = "unknown" | "main" | "non-worktree" | "registered" | "broken";

/** A health verdict: healthy/unhealthy, its kind, and the facts the heads-up/summary quote. */
export interface WorktreeVerdict {
  healthy: boolean;
  kind: WorktreeKind;
  cwd: string;
  topLevel: string | null;
  hasNodeModules: boolean;
}

/** Absolute + symlink-resolved + case-folded (win32) path key; equal keys ⇒ same location. */
export function normPath(p: string): string;

/** True when `a` and `b` denote the same filesystem location. */
export function samePath(a: string, b: string): boolean;

/** True when `cwd` lives inside `<mainRoot>/.claude/worktrees/` — i.e. it is (meant to be) a worktree slot. */
export function isWorktreeSlot(cwd: string, mainRoot: string): boolean;

/** Gather `git rev-parse --show-toplevel` and the common-dir parent from `cwd`; nulls when not in a repo. */
export function probeGit(cwd: string): GitProbe;

/** PURE health classification — no I/O; the broken-slot fingerprint is `slot AND topLevel !== cwd`. */
export function classifyWorktreeHealth(info: {
  cwd: string;
  topLevel: string | null;
  mainRoot: string | null;
  hasNodeModules: boolean;
}): WorktreeVerdict;

/** The `SessionStart` `additionalContext` JSON payload emitted for a broken slot (the agent-visible signal). */
export function brokenWorktreeContext(v: {
  cwd: string;
  topLevel: string | null;
  hasNodeModules: boolean;
}): string;

/** STDOUT for the entry: the broken-slot payload in `--hook` mode when unhealthy, else "". */
export function hookStdout(verdict: WorktreeVerdict, hookMode: boolean): string;

/** The process exit code: always 0 in `--hook` mode; else 0 healthy / 1 broken (the doctor signal). */
export function exitCode(verdict: { healthy: boolean }, hookMode: boolean): number;

/** A one-line human summary of a verdict for the diagnostic log. */
export function humanSummary(v: WorktreeVerdict): string;

/** Gather the live facts for `cwd` and classify; `probe`/`nodeModules` are injectable for tests. */
export function checkWorktree(
  cwd: string,
  opts?: { probe?: (cwd: string) => GitProbe; nodeModules?: (dir: string) => boolean },
): WorktreeVerdict;
