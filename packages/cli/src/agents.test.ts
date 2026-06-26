import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "@storytree/storage-protocol";

import { agentsCommand } from "./agents.js";
import { run } from "./commands.js";

// The agent RENDERER itself (renderAgentPrompt / renderAgentDigest / renderAgentFile /
// delegatableAgentIds) is tested in @storytree/library (packages/library/src/store/render-agent.test.ts)
// — its home after the drive extraction. Here we test only the CLI surface over it: the
// Envelope-returning `agentsCommand` shell and the `agents` dispatch wiring.

/** A store seeded with a principle + two agents (one clean, one with a dangling ref). */
async function seeded(): Promise<InMemoryStore> {
  const store = new InMemoryStore();
  await store.upsertDoc({
    id: "test-principle",
    kind: "principle",
    doc: {
      kind: "principle",
      title: "Test Principle",
      description: "a principle the agent stands on",
      statement: "Always assemble from the library.",
      why: "one source of truth beats hand-copy drift.",
      howToApply: "render, never restate.",
      references: [],
    },
  });
  await store.upsertDoc({
    id: "clean-agent",
    kind: "agent",
    doc: {
      kind: "agent",
      title: "Clean Agent",
      description: "a role whose refs all resolve",
      oneLine: "The clean agent does one thing.",
      role: "It exists to test the renderer.",
      outcome: "The prompt assembles with injected content.",
      context: ["asset:test-principle"],
      tools: "none",
      workflow: "orient, then stop.",
      rules: ["asset:test-principle"],
      references: [],
    },
  });
  await store.upsertDoc({
    id: "broken-agent",
    kind: "agent",
    doc: {
      kind: "agent",
      title: "Broken Agent",
      description: "a role with a dangling manifest ref",
      oneLine: "The broken agent points at a ghost.",
      role: "It exists to test dangling-ref handling.",
      outcome: "The dangling ref is flagged, never silently dropped.",
      context: ["asset:test-principle"],
      tools: "none",
      workflow: "orient, then stop.",
      antiPatterns: ["asset:ghost-ref"],
      references: [],
    },
  });
  return store;
}

test("agentsCommand: clean agent → ok envelope; dangling agent → not-ok with the dangling note", async () => {
  const store = await seeded();
  const clean = await agentsCommand(store, "clean-agent");
  assert.equal(clean.ok, true);
  const broken = await agentsCommand(store, "broken-agent");
  assert.equal(broken.ok, false);
  assert.match(broken.body, /dangling ref/);
});

test("the `agents` area is wired into the dispatch", async () => {
  const store = await seeded();
  const env = await run(["agents", "clean-agent"], { store });
  assert.equal(env.ok, true);
  assert.match(env.body, /The clean agent does one thing\./);
  // bare `agents` needs a name and lists what exists
  const bare = await run(["agents"], { store });
  assert.equal(bare.ok, false);
});
