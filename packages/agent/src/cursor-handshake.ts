/**
 * ADR-0177 Rung A: a read-only Cursor SDK handshake.
 *
 * This is deliberately not a PhaseAuthor. It proves the second harness can discover an
 * account-valid model, start a local run against an injected workspace, and normalize its
 * observations without granting authoring authority. The SDK edge is injected so every decision
 * stays offline-testable; the paid/authenticated path remains operator-attested.
 */

import { Agent, Cursor } from "@cursor/sdk";
import type {
  AgentOptions,
  RunResult,
  SDKAgent,
  SDKMessage,
  SDKModel,
} from "@cursor/sdk";

/** Storytree-owned structural form of Cursor's discovered model selection. */
export interface CursorModelSelection {
  id: string;
  params?: Array<{ id: string; value: string }>;
}

/** Storytree-owned usage shape; absent when the runtime reports no usage. */
export interface CursorTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface CursorDiscoveredModel {
  id: string;
  displayName: string;
  variants?: Array<{
    displayName: string;
    params: Array<{ id: string; value: string }>;
    isDefault?: boolean;
  }>;
}

export interface CursorHandshakeCreateOptions {
  model: CursorModelSelection;
  mode: "plan";
  local: {
    cwd: string;
    settingSources: [];
  };
  apiKey?: string;
}

export interface CursorHandshakeTerminal {
  id: string;
  status: "finished" | "error" | "cancelled";
  result?: string;
  error?: { message: string; code?: string };
  model?: CursorModelSelection;
  durationMs?: number;
  usage?: CursorTokenUsage;
}

export interface CursorHandshakeRun {
  id: string;
  model?: CursorModelSelection;
  stream(): AsyncIterable<unknown>;
  wait(): Promise<CursorHandshakeTerminal>;
}

export interface CursorHandshakeSession {
  agentId: string;
  model?: CursorModelSelection;
  send(prompt: string): Promise<CursorHandshakeRun>;
  close(): void | Promise<void>;
}

/** The narrow runtime seam used by offline tests and the real Cursor SDK adapter. */
export interface CursorHandshakeClient {
  listModels(apiKey?: string): Promise<CursorDiscoveredModel[]>;
  createAgent(options: CursorHandshakeCreateOptions): Promise<CursorHandshakeSession>;
}

export interface CursorToolEvent {
  callId: string;
  name: string;
  status: "running" | "completed" | "error";
  args?: unknown;
  result?: unknown;
}

export interface CursorHandshakeError {
  message: string;
  code?: string;
  retryable?: boolean;
}

interface CursorHandshakeObservations {
  runtime: "cursor";
  agentId: string;
  runId: string;
  model: CursorModelSelection;
  text: string;
  toolEvents: CursorToolEvent[];
  latencyMs: number;
  runtimeDurationMs?: number;
  usage?: CursorTokenUsage;
}

export type CursorHandshakeResult =
  | ({ ok: true; status: "finished" } & CursorHandshakeObservations)
  | ({
      ok: false;
      failure: "terminal";
      status: "error" | "cancelled";
      error: CursorHandshakeError;
    } & CursorHandshakeObservations)
  | {
      ok: false;
      runtime: "cursor";
      failure: "startup";
      error: CursorHandshakeError;
      latencyMs: number;
      model?: CursorModelSelection;
    };

export interface CursorHandshakeArgs {
  cwd: string;
  prompt: string;
  apiKey?: string;
  client?: CursorHandshakeClient;
  /** Monotonic milliseconds in production; injected for deterministic latency tests. */
  now?: () => number;
}

const READ_ONLY_PREFIX =
  "Read-only runtime handshake. Do not modify files or execute mutating commands. ";

/**
 * Select only from the account response. Cursor's order is retained; a declared default variant is
 * carried through so no model id or account-specific parameter is invented locally.
 */
export function selectDiscoveredCursorModel(
  models: readonly CursorDiscoveredModel[],
): CursorModelSelection | undefined {
  const model = models[0];
  if (model === undefined) return undefined;
  const defaultVariant = model.variants?.find((variant) => variant.isDefault === true);
  return defaultVariant === undefined
    ? { id: model.id }
    : { id: model.id, params: defaultVariant.params.map((param) => ({ ...param })) };
}

const realCursorClient: CursorHandshakeClient = {
  async listModels(apiKey?: string): Promise<SDKModel[]> {
    return Cursor.models.list(apiKey === undefined ? undefined : { apiKey });
  },
  async createAgent(options): Promise<CursorHandshakeSession> {
    const sdkOptions: AgentOptions = {
      model: options.model,
      mode: options.mode,
      local: {
        cwd: options.local.cwd,
        settingSources: options.local.settingSources,
      },
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    };
    const agent = await Agent.create(sdkOptions);
    return wrapSdkAgent(agent);
  },
};

function wrapSdkAgent(agent: SDKAgent): CursorHandshakeSession {
  return {
    agentId: agent.agentId,
    ...(agent.model !== undefined ? { model: agent.model } : {}),
    async send(prompt): Promise<CursorHandshakeRun> {
      const run = await agent.send(prompt);
      return {
        id: run.id,
        ...(run.model !== undefined ? { model: run.model } : {}),
        stream: (): AsyncIterable<SDKMessage> => run.stream(),
        wait: (): Promise<RunResult> => run.wait(),
      };
    },
    close: (): Promise<void> => agent[Symbol.asyncDispose](),
  };
}

/**
 * Run the bounded probe. Errors before `send()` returns a Run are startup failures; once a Run
 * exists, stream exceptions and non-finished terminal statuses are terminal failures.
 */
export async function runCursorReadOnlyHandshake(
  args: CursorHandshakeArgs,
): Promise<CursorHandshakeResult> {
  const now = args.now ?? (() => performance.now());
  const startedAt = now();
  const client = args.client ?? realCursorClient;
  let selectedModel: CursorModelSelection | undefined;
  let session: CursorHandshakeSession | undefined;
  let run: CursorHandshakeRun | undefined;

  try {
    const models = await client.listModels(args.apiKey);
    selectedModel = selectDiscoveredCursorModel(models);
    if (selectedModel === undefined) {
      return startupFailure(
        new Error("Cursor model discovery returned no available models for this account"),
        now() - startedAt,
      );
    }

    session = await client.createAgent({
      model: selectedModel,
      mode: "plan",
      local: {
        cwd: args.cwd,
        // Rung A does not need subagents, so it loads no ambient settings. A later local session
        // that delegates must opt into project settings per ADR-0178.
        settingSources: [],
      },
      ...(args.apiKey !== undefined ? { apiKey: args.apiKey } : {}),
    });

    try {
      run = await session.send(`${READ_ONLY_PREFIX}${args.prompt}`);
    } catch (error) {
      return startupFailure(error, now() - startedAt, selectedModel);
    }

    const text: string[] = [];
    const toolEvents: CursorToolEvent[] = [];
    try {
      for await (const message of run.stream()) {
        collectMessage(message, text, toolEvents);
      }
      const terminal = await run.wait();
      if (terminal.result !== undefined && terminal.result.length > 0) {
        if (text[text.length - 1] !== terminal.result) text.push(terminal.result);
      }
      const observations = observationsFor({
        session,
        run,
        terminal,
        selectedModel,
        text,
        toolEvents,
        latencyMs: now() - startedAt,
      });
      if (terminal.status === "finished") {
        return { ok: true, status: "finished", ...observations };
      }
      return {
        ok: false,
        failure: "terminal",
        status: terminal.status,
        error: normalizeError(terminal.error ?? `Cursor run ended ${terminal.status}`),
        ...observations,
      };
    } catch (error) {
      return {
        ok: false,
        failure: "terminal",
        status: "error",
        error: normalizeError(error),
        runtime: "cursor",
        agentId: session.agentId,
        runId: run.id,
        model: run.model ?? session.model ?? selectedModel,
        text: text.join("\n"),
        toolEvents,
        latencyMs: now() - startedAt,
      };
    }
  } catch (error) {
    return startupFailure(error, now() - startedAt, selectedModel);
  } finally {
    if (session !== undefined) {
      try {
        await session.close();
      } catch {
        // Cleanup cannot rewrite the already-observed run outcome.
      }
    }
  }
}

function observationsFor(args: {
  session: CursorHandshakeSession;
  run: CursorHandshakeRun;
  terminal: CursorHandshakeTerminal;
  selectedModel: CursorModelSelection;
  text: string[];
  toolEvents: CursorToolEvent[];
  latencyMs: number;
}): CursorHandshakeObservations {
  return {
    runtime: "cursor",
    agentId: args.session.agentId,
    runId: args.terminal.id,
    model: args.terminal.model ?? args.run.model ?? args.session.model ?? args.selectedModel,
    text: args.text.join("\n"),
    toolEvents: args.toolEvents,
    latencyMs: args.latencyMs,
    ...(args.terminal.durationMs !== undefined
      ? { runtimeDurationMs: args.terminal.durationMs }
      : {}),
    ...(args.terminal.usage !== undefined ? { usage: args.terminal.usage } : {}),
  };
}

function collectMessage(
  message: unknown,
  text: string[],
  toolEvents: CursorToolEvent[],
): void {
  if (typeof message !== "object" || message === null) return;
  const typed = message as {
    type?: unknown;
    message?: { content?: unknown };
    call_id?: unknown;
    name?: unknown;
    status?: unknown;
    args?: unknown;
    result?: unknown;
  };
  if (typed.type === "assistant" && Array.isArray(typed.message?.content)) {
    for (const block of typed.message.content) {
      if (
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        text.push((block as { text: string }).text);
      }
    }
    return;
  }
  if (
    typed.type === "tool_call" &&
    typeof typed.call_id === "string" &&
    typeof typed.name === "string" &&
    (typed.status === "running" || typed.status === "completed" || typed.status === "error")
  ) {
    toolEvents.push({
      callId: typed.call_id,
      name: typed.name,
      status: typed.status,
      ...("args" in typed && typed.args !== undefined ? { args: typed.args } : {}),
      ...("result" in typed && typed.result !== undefined ? { result: typed.result } : {}),
    });
  }
}

function startupFailure(
  error: unknown,
  latencyMs: number,
  model?: CursorModelSelection,
): CursorHandshakeResult {
  return {
    ok: false,
    runtime: "cursor",
    failure: "startup",
    error: normalizeError(error),
    latencyMs,
    ...(model !== undefined ? { model } : {}),
  };
}

function normalizeError(error: unknown): CursorHandshakeError {
  if (typeof error === "string") return { message: error };
  if (typeof error !== "object" || error === null) return { message: String(error) };
  const shaped = error as {
    message?: unknown;
    code?: unknown;
    isRetryable?: unknown;
  };
  return {
    message: typeof shaped.message === "string" ? shaped.message : String(error),
    ...(typeof shaped.code === "string" ? { code: shaped.code } : {}),
    ...(typeof shaped.isRetryable === "boolean" ? { retryable: shaped.isRetryable } : {}),
  };
}
