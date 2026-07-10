import assert from "node:assert/strict";
import { test } from "node:test";

import {
  runCursorReadOnlyHandshake,
  selectDiscoveredCursorModel,
} from "./cursor-handshake.js";
import type {
  CursorHandshakeClient,
  CursorHandshakeCreateOptions,
  CursorHandshakeRun,
  CursorHandshakeSession,
} from "./cursor-handshake.js";

function scriptedRuntime(args?: {
  models?: Array<{
    id: string;
    displayName: string;
    variants?: Array<{
      displayName: string;
      params: Array<{ id: string; value: string }>;
      isDefault?: boolean;
    }>;
  }>;
  createError?: Error;
  sendError?: Error;
  messages?: unknown[];
  terminal?: {
    id: string;
    status: "finished" | "error" | "cancelled";
    result?: string;
    error?: { message: string; code?: string };
    model?: { id: string; params?: Array<{ id: string; value: string }> };
    durationMs?: number;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      totalTokens: number;
      reasoningTokens?: number;
    };
  };
}): {
  client: CursorHandshakeClient;
  creates: CursorHandshakeCreateOptions[];
  prompts: string[];
  closed: () => number;
} {
  const creates: CursorHandshakeCreateOptions[] = [];
  const prompts: string[] = [];
  let closeCount = 0;
  const run: CursorHandshakeRun = {
    id: "run-started",
    model: { id: "model-from-run" },
    stream: () =>
      (async function* () {
        for (const message of args?.messages ?? []) yield message;
      })(),
    wait: async () =>
      args?.terminal ?? {
        id: "run-finished",
        status: "finished",
        result: "done",
        durationMs: 125,
      },
  };
  const session: CursorHandshakeSession = {
    agentId: "agent-1",
    model: { id: "model-from-agent" },
    send: async (prompt) => {
      prompts.push(prompt);
      if (args?.sendError !== undefined) throw args.sendError;
      return run;
    },
    close: async () => {
      closeCount += 1;
    },
  };
  return {
    creates,
    prompts,
    closed: () => closeCount,
    client: {
      listModels: async () =>
        args?.models ?? [
          {
            id: "account-model",
            displayName: "Account model",
            variants: [
              {
                displayName: "default",
                isDefault: true,
                params: [{ id: "reasoning", value: "high" }],
              },
            ],
          },
        ],
      createAgent: async (options) => {
        creates.push(options);
        if (args?.createError !== undefined) throw args.createError;
        return session;
      },
    },
  };
}

test("selectDiscoveredCursorModel chooses the first available model and its declared default variant", () => {
  assert.deepEqual(
    selectDiscoveredCursorModel([
      {
        id: "available-a",
        displayName: "A",
        variants: [
          {
            displayName: "slow",
            params: [{ id: "reasoning", value: "high" }],
          },
          {
            displayName: "default",
            isDefault: true,
            params: [{ id: "reasoning", value: "medium" }],
          },
        ],
      },
      { id: "available-b", displayName: "B" },
    ]),
    {
      id: "available-a",
      params: [{ id: "reasoning", value: "medium" }],
    },
  );
});

test("read-only handshake discovers the model, runs locally in plan mode, and normalizes observations", async () => {
  const runtime = scriptedRuntime({
    messages: [
      {
        type: "assistant",
        agent_id: "agent-1",
        run_id: "run-started",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Repository read." },
            { type: "tool_use", id: "legacy-tool", name: "Read", input: { path: "README.md" } },
          ],
        },
      },
      {
        type: "tool_call",
        agent_id: "agent-1",
        run_id: "run-started",
        call_id: "tool-1",
        name: "Read",
        status: "completed",
        args: { path: "README.md" },
        result: "contents",
      },
    ],
    terminal: {
      id: "run-terminal",
      status: "finished",
      result: "Read-only handshake complete.",
      model: { id: "account-model", params: [{ id: "reasoning", value: "high" }] },
      durationMs: 125,
      usage: {
        inputTokens: 20,
        outputTokens: 8,
        cacheReadTokens: 3,
        cacheWriteTokens: 0,
        totalTokens: 28,
      },
    },
  });
  const ticks = [1_000, 1_140];
  const result = await runCursorReadOnlyHandshake({
    cwd: "C:\\injected\\workspace",
    prompt: "Describe the repository.",
    client: runtime.client,
    now: () => ticks.shift()!,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(runtime.creates, [
    {
      model: {
        id: "account-model",
        params: [{ id: "reasoning", value: "high" }],
      },
      mode: "plan",
      local: {
        cwd: "C:\\injected\\workspace",
        settingSources: [],
      },
    },
  ]);
  assert.match(runtime.prompts[0]!, /^Read-only runtime handshake\./);
  assert.equal(result.runtime, "cursor");
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.runId, "run-terminal");
  assert.deepEqual(result.model, {
    id: "account-model",
    params: [{ id: "reasoning", value: "high" }],
  });
  assert.equal(result.status, "finished");
  assert.equal(result.text, "Repository read.\nRead-only handshake complete.");
  assert.deepEqual(result.toolEvents, [
    {
      callId: "tool-1",
      name: "Read",
      status: "completed",
      args: { path: "README.md" },
      result: "contents",
    },
  ]);
  assert.equal(result.latencyMs, 140);
  assert.equal(result.runtimeDurationMs, 125);
  assert.deepEqual(result.usage, {
    inputTokens: 20,
    outputTokens: 8,
    cacheReadTokens: 3,
    cacheWriteTokens: 0,
    totalTokens: 28,
  });
  assert.equal(runtime.closed(), 1);
});

test("handshake reports model discovery and send exceptions as startup failures", async () => {
  const discoveryFailure: CursorHandshakeClient = {
    listModels: async () => {
      throw Object.assign(new Error("unauthorized"), { code: "AUTH", isRetryable: false });
    },
    createAgent: async () => {
      throw new Error("must not create");
    },
  };
  const noStart = await runCursorReadOnlyHandshake({
    cwd: "C:\\workspace",
    prompt: "read",
    client: discoveryFailure,
    now: () => 10,
  });
  assert.deepEqual(noStart, {
    ok: false,
    runtime: "cursor",
    failure: "startup",
    error: { message: "unauthorized", code: "AUTH", retryable: false },
    latencyMs: 0,
  });

  const sendFailure = scriptedRuntime({ sendError: new Error("bridge unavailable") });
  const sendResult = await runCursorReadOnlyHandshake({
    cwd: "C:\\workspace",
    prompt: "read",
    client: sendFailure.client,
    now: () => 20,
  });
  assert.equal(sendResult.ok, false);
  if (sendResult.ok) return;
  assert.equal(sendResult.failure, "startup");
  assert.match(sendResult.error.message, /bridge unavailable/);
  assert.equal(sendFailure.closed(), 1);
});

test("handshake fails startup when discovery returns no account models", async () => {
  const runtime = scriptedRuntime({ models: [] });
  const result = await runCursorReadOnlyHandshake({
    cwd: "C:\\workspace",
    prompt: "read",
    client: runtime.client,
    now: () => 30,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure, "startup");
  assert.match(result.error.message, /no available models/);
  assert.equal(runtime.creates.length, 0);
});

test("handshake distinguishes a terminal run failure and preserves its observations", async () => {
  const runtime = scriptedRuntime({
    messages: [
      {
        type: "tool_call",
        agent_id: "agent-1",
        run_id: "run-started",
        call_id: "tool-2",
        name: "Grep",
        status: "error",
        result: "permission denied",
      },
    ],
    terminal: {
      id: "run-error",
      status: "error",
      error: { message: "terminal failure", code: "RUN_FAILED" },
      model: { id: "account-model" },
      usage: {
        inputTokens: 9,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 10,
      },
    },
  });
  const result = await runCursorReadOnlyHandshake({
    cwd: "C:\\workspace",
    prompt: "read",
    client: runtime.client,
    now: () => 50,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure, "terminal");
  assert.equal(result.status, "error");
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.runId, "run-error");
  assert.equal(result.error.message, "terminal failure");
  assert.equal(result.error.code, "RUN_FAILED");
  assert.deepEqual(result.toolEvents, [
    {
      callId: "tool-2",
      name: "Grep",
      status: "error",
      result: "permission denied",
    },
  ]);
  assert.equal(result.usage?.totalTokens, 10);
  assert.equal(runtime.closed(), 1);
});

test("an exception after a run starts is a terminal failure, not a startup failure", async () => {
  const runtime = scriptedRuntime();
  runtime.client.createAgent = async (options) => {
    runtime.creates.push(options);
    return {
      agentId: "agent-stream",
      send: async (): Promise<CursorHandshakeRun> => ({
        id: "run-stream",
        stream: () =>
          (async function* () {
            throw new Error("stream disconnected");
            yield {};
          })(),
        wait: async () => ({ id: "run-stream", status: "error" }),
      }),
      close: async () => undefined,
    };
  };
  const result = await runCursorReadOnlyHandshake({
    cwd: "C:\\workspace",
    prompt: "read",
    client: runtime.client,
    now: () => 60,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure, "terminal");
  assert.equal(result.runId, "run-stream");
  assert.match(result.error.message, /stream disconnected/);
});
