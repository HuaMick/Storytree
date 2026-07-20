// Contract for the broken-worktree detector (`packages/cli/worktree-health.mjs`) — the SessionStart
// hook that fails LOUD when the session's `.claude/worktrees/` slot is not a registered git worktree
// (friction `session-worktree-never-created-branch-at-main`; ADR-0033 identity, ADR-0162 heads-up).
//
// The classification is PURE (every git/fs fact injected), so the broken-slot decision — the whole
// point — is proven WITHOUT a real broken worktree or git. One entry spawn proves the wiring:
// `--cwd <main>` (a non-slot cwd) is healthy and stays silent.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normPath,
  samePath,
  isWorktreeSlot,
  classifyWorktreeHealth,
  brokenWorktreeContext,
  hookStdout,
  exitCode,
  checkWorktree,
} from "../worktree-health.mjs";

const SCRIPT = fileURLToPath(new URL("../worktree-health.mjs", import.meta.url));
const MAIN = "/repo/storytree";
const SLOT = "/repo/storytree/.claude/worktrees/mystifying-mestorf";

/** Build the classifier input for a cwd, defaulting the surrounding facts to a healthy main-rooted repo. */
function facts(over: Partial<Parameters<typeof classifyWorktreeHealth>[0]>) {
  return classifyWorktreeHealth({
    cwd: MAIN,
    topLevel: MAIN,
    mainRoot: MAIN,
    hasNodeModules: true,
    ...over,
  });
}

test("samePath / normPath: separators and (win32) case fold to one identity key", () => {
  assert.equal(samePath("/a/b/", "/a/b"), true, "trailing slash is irrelevant");
  assert.equal(samePath("/a/b", "/a/c"), false, "different paths differ");
});

test("isWorktreeSlot: only paths under <main>/.claude/worktrees/ are slots", () => {
  assert.equal(isWorktreeSlot(SLOT, MAIN), true);
  assert.equal(isWorktreeSlot(MAIN, MAIN), false, "the main checkout is not a slot");
  assert.equal(isWorktreeSlot("/repo/storytree/apps/studio", MAIN), false, "a normal subdir is not a slot");
});

test("classify: a registered worktree (git resolves the slot to itself) is healthy", () => {
  const v = facts({ cwd: SLOT, topLevel: SLOT });
  assert.equal(v.healthy, true);
  assert.equal(v.kind, "registered");
});

test("classify: the main checkout is healthy (main kind)", () => {
  const v = facts({ cwd: MAIN, topLevel: MAIN });
  assert.equal(v.healthy, true);
  assert.equal(v.kind, "main");
});

test("classify: a non-slot subdir is healthy (never a false alarm)", () => {
  const sub = "/repo/storytree/apps/studio";
  const v = facts({ cwd: sub, topLevel: MAIN });
  assert.equal(v.healthy, true);
  assert.equal(v.kind, "non-worktree", "a subdir resolving up to main is NOT flagged — only slots are");
});

test("classify: a slot git resolves UP to main is BROKEN (the caught bug)", () => {
  const v = facts({ cwd: SLOT, topLevel: MAIN, hasNodeModules: false });
  assert.equal(v.healthy, false);
  assert.equal(v.kind, "broken");
  assert.equal(v.topLevel, MAIN, "the verdict carries where git actually resolved — main");
});

test("classify: a POPULATED broken slot (node_modules present) is still BROKEN — provision would miss it", () => {
  const v = facts({ cwd: SLOT, topLevel: MAIN, hasNodeModules: true });
  assert.equal(v.healthy, false, "node_modules present must NOT mask a broken git identity");
  assert.equal(v.kind, "broken");
});

test("classify: unknown git facts (not a repo / git absent) are treated as healthy — never break a session", () => {
  assert.equal(facts({ cwd: SLOT, topLevel: null, mainRoot: null }).kind, "unknown");
  assert.equal(facts({ cwd: SLOT, topLevel: MAIN, mainRoot: null }).healthy, true, "no mainRoot ⇒ unknown");
});

test("brokenWorktreeContext: a valid SessionStart payload naming the slot, main, and the DO-NOT-build remedy", () => {
  const parsed = JSON.parse(brokenWorktreeContext({ cwd: SLOT, topLevel: MAIN, hasNodeModules: false }));
  assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
  const ctx: string = parsed.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes(SLOT), "names the broken slot");
  assert.ok(ctx.includes(MAIN), "names where git resolves (main)");
  assert.match(ctx, /RESTART the session/, "gives the remedy");
  assert.match(ctx, /check:declared/, "warns the identity/gate consequence");
  assert.match(ctx, /MISSING/, "reports node_modules state");
});

test("hookStdout: emits the signal only for a broken slot in hook mode, silent otherwise", () => {
  const broken = facts({ cwd: SLOT, topLevel: MAIN });
  const healthy = facts({ cwd: SLOT, topLevel: SLOT });
  assert.equal(hookStdout(healthy, true), "", "a healthy session ⇒ no context noise");
  assert.equal(hookStdout(broken, false), "", "non-hook (doctor) ⇒ no stdout signal");
  assert.equal(hookStdout(broken, true), brokenWorktreeContext(broken), "hook + broken ⇒ the payload");
});

test("exitCode: --hook never breaks the session; the doctor propagates broken as exit 1", () => {
  assert.equal(exitCode({ healthy: false }, true), 0, "hook mode exits 0 even when broken");
  assert.equal(exitCode({ healthy: false }, false), 1, "standalone doctor exits 1 when broken");
  assert.equal(exitCode({ healthy: true }, false), 0);
});

test("checkWorktree: composes an injected probe + node_modules check into a verdict", () => {
  const v = checkWorktree(SLOT, {
    probe: () => ({ topLevel: MAIN, mainRoot: MAIN }),
    nodeModules: () => true,
  });
  assert.equal(v.kind, "broken", "a slot probed as resolving to main is broken");
  assert.equal(v.hasNodeModules, true);
});

test("entry --hook: a healthy cwd exits 0 with a SILENT agent channel (nothing on stdout)", () => {
  // MAIN of THIS repo: the package root's grandparent is the repo root (a non-slot cwd → healthy).
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const res = spawnSync(process.execPath, [SCRIPT, "--hook", "--cwd", repoRoot], { encoding: "utf8" });
  assert.equal(res.status, 0, `--hook must exit 0; stderr: ${res.stderr}`);
  assert.equal(res.stdout.trim(), "", "hook mode: a healthy session writes NO additionalContext to stdout (the agent channel)");
  assert.match(res.stderr, /\[worktree-health\] OK/, "the human summary goes to stderr in hook mode");
});

test("entry (doctor): a healthy cwd exits 0 and prints the OK summary to stdout", () => {
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const res = spawnSync(process.execPath, [SCRIPT, "--cwd", repoRoot], { encoding: "utf8" });
  assert.equal(res.status, 0, `a healthy cwd must exit 0; stderr: ${res.stderr}`);
  assert.match(res.stdout, /\[worktree-health\] OK/, "doctor mode prints the verdict to stdout");
});

test("entry --hook END-TO-END: a REAL unregistered slot (git resolves to main) is caught + announced", (t) => {
  // Build a throwaway repo and an UNREGISTERED `.claude/worktrees/<name>` slot inside it — exactly the
  // broken shape: the dir exists, git was never `worktree add`-ed, so git resolves the slot UP to this
  // repo's root. This exercises the real git reads (probeGit → classify → emit), not injected facts.
  const gitv = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (gitv.status !== 0) return t.skip("git not available");
  const main = mkdtempSync(join(tmpdir(), "st-wt-health-"));
  try {
    const runGit = (args: string[]) => spawnSync("git", args, { cwd: main, encoding: "utf8" });
    runGit(["init", "-q"]);
    runGit(["config", "user.email", "t@t.com"]);
    runGit(["config", "user.name", "t"]);
    runGit(["commit", "-q", "--allow-empty", "-m", "init"]);
    const slot = join(main, ".claude", "worktrees", "phantom-slot");
    mkdirSync(slot, { recursive: true }); // an empty, unregistered slot — the bug

    const res = spawnSync(process.execPath, [SCRIPT, "--hook", "--cwd", slot], { encoding: "utf8" });
    assert.equal(res.status, 0, `--hook must never break the session (exit 0); stderr: ${res.stderr}`);
    assert.notEqual(res.stdout.trim(), "", "a broken slot MUST emit the agent-visible additionalContext");
    const parsed = JSON.parse(res.stdout.trim());
    assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(parsed.hookSpecificOutput.additionalContext, /BROKEN WORKTREE/, "the heads-up flags the break");
    assert.match(res.stderr, /\[worktree-health\] BROKEN/, "the diagnostic line goes to stderr");
  } finally {
    rmSync(main, { recursive: true, force: true });
  }
});
