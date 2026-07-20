#!/usr/bin/env node
// Broken-worktree DETECTOR — a SessionStart hook that fails LOUD, not open (friction
// `session-worktree-never-created-branch-at-main`, 2026-07-20; ADR-0033 worktree identity,
// ADR-0162 SessionStart heads-up injection).
//
// THE BUG THIS CATCHES: a session is assigned `.claude/worktrees/<name>` but that slot is NOT a
// registered git worktree — the branch is checked out at the MAIN repo instead and git resolves the
// slot UP to main. Two variants produce it:
//   - EMPTY husk: the harness pre-created the dir but `git worktree add` fatally refused because the
//     branch was already checked out at main ("fatal: '<branch>' is already used by worktree at
//     '<main>'"), leaving an empty, unregistered dir. (Un-catchable here — see the LIMIT note below.)
//   - POPULATED husk: `git worktree remove` HALF-SUCCEEDED on Windows (worktree-sprawl-cleanup-trap) —
//     it deleted the slot's `.git` file and deregistered it but left the populated dir (node_modules
//     and all). A later session assigned that slot has a full checkout whose git identity resolves to
//     MAIN. `provision-worktree.mjs` sees node_modules and stays silent; this catches it.
//
// WHY IT MATTERS — it fails OPEN: `git status`, reads, and CLI reads all succeed against main, so
// nothing looks wrong until the FIRST worktree-identity WRITE (`noticeboard declare --pg` →
// "Identity is derived from the session worktree… run from inside a recognised .claude/worktrees/
// <name>"), typically many tool-calls in, after wasted work and pushing toward risky mid-build git
// surgery. This hook moves that discovery to session start: it emits the ADR-0162 SessionStart
// `additionalContext` — the one channel the agent reads — so a broken slot is announced UP FRONT.
//
// LIMIT (the EMPTY-husk variant is a harness bug this cannot auto-catch): every cwd-relative
// SessionStart hook — this one, provision-worktree, presence-hook, prune-hook — needs its script to
// EXIST at the session cwd. An empty slot has no files, so `node packages/cli/worktree-health.mjs`
// there errors MODULE_NOT_FOUND before any logic runs. That variant is covered by process guidance
// (`git worktree list` at session start; CLAUDE.md "Fresh worktree?") and belongs to the
// worktree-creation harness (it must not leave the branch at main). This hook catches every variant
// where the checkout has content — where a false "healthy" would otherwise cost the most.
//
// Constraints (mirror provision-worktree.mjs): BARE NODE, zero non-builtin deps (may run before
// node_modules exists); FAIL-SAFE — `--hook` forces exit 0 on every path so a broken probe never
// breaks the session; and stdout is reserved for the agent-visible `additionalContext` JSON alone
// (human/diagnostic text → stderr), so a healthy session emits nothing.
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

/**
 * Normalise a path for identity comparison: absolute, symlink-resolved when it exists, forward-slashed,
 * trailing-slash-stripped, and lower-cased on win32 (where the filesystem is case-insensitive but the
 * git/`process.cwd()` casings can differ). Two paths are the SAME location iff their norms are equal.
 */
export function normPath(p) {
  let r = resolve(p);
  try {
    r = realpathSync.native(r);
  } catch {
    // Path may not exist (e.g. a git-reported root that moved) — resolve() is still a fair comparison key.
  }
  r = r.replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? r.toLowerCase() : r;
}

/** True when `a` and `b` denote the same filesystem location (see {@link normPath}). */
export function samePath(a, b) {
  return normPath(a) === normPath(b);
}

/** True when `cwd` lives inside `<mainRoot>/.claude/worktrees/` — i.e. it is (meant to be) a worktree slot. */
export function isWorktreeSlot(cwd, mainRoot) {
  const slotsRoot = normPath(join(mainRoot, ".claude", "worktrees")) + "/";
  return normPath(cwd).startsWith(slotsRoot);
}

/** Run a git query from `cwd`; return trimmed stdout, or null on any failure (git absent, not a repo, error). */
function git(cwd, args) {
  try {
    const res = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (res.status !== 0 || typeof res.stdout !== "string") return null;
    const out = res.stdout.trim();
    return out === "" ? null : out;
  } catch {
    return null;
  }
}

/**
 * The git-derived facts a health verdict needs, gathered from `cwd`:
 *   - topLevel: `git rev-parse --show-toplevel` — the working-tree root git resolves cwd to. For a
 *     registered worktree it IS the worktree; for a broken slot it resolves UP to the main checkout.
 *   - mainRoot: the parent of the common git dir (`--git-common-dir`) — always the primary checkout.
 * Returns nulls when cwd is not inside any git repo (both queries fail) — treated as "unknown → healthy".
 */
export function probeGit(cwd) {
  const topLevel = git(cwd, ["rev-parse", "--show-toplevel"]);
  const commonDir = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const mainRoot = commonDir === null ? null : dirname(commonDir);
  return { topLevel, mainRoot };
}

/**
 * PURE health classification (no I/O — every input injected, so the decision is unit-tested without
 * git or a real worktree). A session is UNHEALTHY only when its cwd is a worktree SLOT
 * (`<mainRoot>/.claude/worktrees/<name>`) that git does NOT resolve to itself — the exact broken-slot
 * fingerprint. Every other shape is healthy/none-of-our-business and stays silent:
 *   - unknown        git said nothing (not a repo / git absent) — never break a non-repo session.
 *   - main           cwd IS the primary checkout — a legitimate non-worktree session.
 *   - non-worktree   cwd is elsewhere (a subdir, another checkout) — not a slot, not our concern.
 *   - registered     cwd is a slot AND git resolves it to itself — a real, healthy worktree.
 *   - broken         cwd is a slot but git resolves it to `topLevel` (main) — the failure we announce.
 *
 * @param {{ cwd: string, topLevel: string|null, mainRoot: string|null, hasNodeModules: boolean }} info
 * @returns {{ healthy: boolean, kind: "unknown"|"main"|"non-worktree"|"registered"|"broken",
 *            cwd: string, topLevel: string|null, hasNodeModules: boolean }}
 */
export function classifyWorktreeHealth(info) {
  const { cwd, topLevel, mainRoot, hasNodeModules } = info;
  const base = { cwd, topLevel, hasNodeModules };
  if (topLevel === null || mainRoot === null) return { healthy: true, kind: "unknown", ...base };
  if (!isWorktreeSlot(cwd, mainRoot)) {
    return { healthy: true, kind: samePath(cwd, mainRoot) ? "main" : "non-worktree", ...base };
  }
  if (samePath(cwd, topLevel)) return { healthy: true, kind: "registered", ...base };
  return { healthy: false, kind: "broken", ...base };
}

/**
 * The `SessionStart` `additionalContext` payload for a broken slot — the agent-visible heads-up (stdout,
 * `--hook`) naming the slot, where git actually resolves it, and the DO-NOT-build-here remedy. Pure /
 * string-returning so it is unit-tested without a session. Mirrors provision-worktree's
 * `unprovisionedContext` shape (the one channel the agent reads).
 *
 * @param {{ cwd: string, topLevel: string|null, hasNodeModules: boolean }} v
 */
export function brokenWorktreeContext(v) {
  const nm = v.hasNodeModules ? "present" : "MISSING";
  const text =
    `BROKEN WORKTREE — this session's directory (${v.cwd}) is a .claude/worktrees/ slot but is NOT a ` +
    `registered git worktree: git resolves it UP to the MAIN checkout (${v.topLevel ?? "unknown"}), and its ` +
    `own node_modules are ${nm}. Provisioning did not create the worktree — most likely 'git worktree add' ` +
    `refused because the branch was already checked out at main (ADR-0033 worktree identity), or a prior ` +
    `'git worktree remove' half-succeeded and left this husk. This fails OPEN: git status, reads and CLI ` +
    `reads all succeed against MAIN, so it would otherwise surface only at your first worktree-identity ` +
    `WRITE. DO NOT build, edit, or run the gate here — writes land in MAIN, worktree-identity writes ` +
    `(e.g. 'storytree noticeboard declare --pg') will FAIL, and the gate's check:declared cannot pass. ` +
    `Fix: RESTART the session so the harness recreates the worktree cleanly — do NOT attempt mid-build git ` +
    `surgery on the shared main checkout. If it recurs, escalate: the worktree-creation harness is leaving ` +
    `the branch checked out at main.`;
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } });
}

/**
 * What the entry writes to STDOUT for a verdict: the agent-visible `additionalContext` when (and only
 * when) the slot is broken in `--hook` mode, else "" — a healthy session and every non-hook (doctor)
 * invocation keep stdout empty. Pure, so the emit gating is unit-tested without a session.
 *
 * @param {{ healthy: boolean, cwd: string, topLevel: string|null, hasNodeModules: boolean }} verdict
 * @param {boolean} hookMode
 */
export function hookStdout(verdict, hookMode) {
  return hookMode && !verdict.healthy ? brokenWorktreeContext(verdict) : "";
}

/**
 * The process exit code for a verdict. In `--hook` mode ALWAYS 0 — a broken-slot signal must never
 * break the session (it is a heads-up, not a gate). Standalone (the doctor: `node worktree-health.mjs`)
 * a broken verdict exits 1 so a human/script gets a real signal; healthy exits 0.
 *
 * @param {{ healthy: boolean }} verdict
 * @param {boolean} hookMode
 */
export function exitCode(verdict, hookMode) {
  return hookMode ? 0 : verdict.healthy ? 0 : 1;
}

/** A one-line human summary of a verdict for the diagnostic log (stderr in hook mode, stdout for the doctor). */
export function humanSummary(v) {
  if (v.healthy) return `[worktree-health] OK — ${v.kind} checkout at ${v.cwd}.`;
  return (
    `[worktree-health] BROKEN — ${v.cwd} is an unregistered worktree slot; git resolves it to ` +
    `${v.topLevel ?? "unknown"} (main). Its node_modules are ${v.hasNodeModules ? "present" : "MISSING"}. ` +
    `Do NOT build here — restart the session (see the SessionStart heads-up).`
  );
}

/** Gather the live facts for `cwd` and classify. Injectable `probe`/`nodeModules` keep the entry testable. */
export function checkWorktree(cwd, opts = {}) {
  const { probe = probeGit, nodeModules = (d) => existsSync(join(d, "node_modules")) } = opts;
  const { topLevel, mainRoot } = probe(cwd);
  return classifyWorktreeHealth({ cwd, topLevel, mainRoot, hasNodeModules: nodeModules(cwd) });
}

/** True when this module is the process entry (invoked directly), false when imported (e.g. the test). */
function isEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntry()) {
  const argv = process.argv.slice(2);
  const hookMode = argv.includes("--hook");
  const ci = argv.indexOf("--cwd");
  const cwd = ci !== -1 && argv[ci + 1] ? resolve(argv[ci + 1]) : process.cwd();
  const verdict = checkWorktree(cwd);
  // Diagnostics → stderr in hook mode (stdout is the agent channel); → stdout for the standalone doctor.
  (hookMode ? process.stderr : process.stdout).write(humanSummary(verdict) + "\n");
  const out = hookStdout(verdict, hookMode);
  if (out) process.stdout.write(out + "\n");
  process.exit(exitCode(verdict, hookMode));
}
