/**
 * The Claude Code transcript adapter for the onboarding-budget monitor (ADR-0162 Phase 2).
 *
 * A session transcript is JSONL: one JSON object per line. The lines this monitor cares about are the
 * `tool_use` blocks (an `assistant` entry whose `message.content[]` carries `{ type:"tool_use",
 * name, input, id }`) and their matching `tool_result` blocks (a `user` entry whose content carries
 * `{ type:"tool_result", tool_use_id, is_error }`). Every entry has a top-level ISO `timestamp`.
 *
 * PARSING IS PURE over the text: {@link parseTranscript} pairs a `tool_use` with its `tool_result`
 * by id, computes the per-tool latency (`result_ts − use_ts` — the baseline's metric, ADR-0162
 * Context; these are event-emission times, so the numbers are directional by design), extracts a
 * classification target from the tool input, and returns the ordered {@link TraceToolCall}[] the
 * budget core consumes. It never throws on a malformed line — it skips it.
 */

import type { TraceToolCall } from "./onboarding-budget.js";

/** A tool_use block reduced to what we need, keyed while we wait for its result. */
interface PendingUse {
  index: number;
  tool: string;
  target: string;
  useMs: number;
}

/**
 * PURE: derive a classification target from a tool's input object. Read/Edit/Write → the file path;
 * Bash/PowerShell → the command; Grep/Glob → the path or pattern; Agent/Task → the subagent type.
 * Everything else → "" (the classifier then treats it as generic orientation overhead).
 */
export function extractToolTarget(tool: string, input: unknown): string {
  const obj = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const str = (k: string): string => (typeof obj[k] === "string" ? (obj[k] as string) : "");

  switch (tool) {
    case "Read":
    case "Edit":
    case "Write":
    case "MultiEdit":
      return str("file_path");
    case "NotebookEdit":
      return str("notebook_path");
    case "Bash":
    case "PowerShell":
      return str("command");
    case "Grep":
      return str("path") || str("glob") || str("pattern");
    case "Glob":
      return str("path") ? `${str("path")}/${str("pattern")}` : str("pattern");
    case "LS":
      return str("path");
    case "Agent":
    case "Task":
      return str("subagent_type") || str("description");
    default:
      return "";
  }
}

/** Parse an ISO timestamp to epoch ms, or NaN. */
function tsMs(v: unknown): number {
  if (typeof v !== "string") return Number.NaN;
  const t = Date.parse(v);
  return Number.isNaN(t) ? Number.NaN : t;
}

/** The content blocks of a transcript entry, or [] when absent/non-array. */
function contentBlocks(entry: Record<string, unknown>): Record<string, unknown>[] {
  const msg = entry["message"];
  const content = typeof msg === "object" && msg !== null ? (msg as Record<string, unknown>)["content"] : undefined;
  if (!Array.isArray(content)) return [];
  return content.filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null);
}

export interface ParsedTranscript {
  sessionId: string;
  calls: TraceToolCall[];
}

export interface ParseTranscriptOpts {
  /** The session id to stamp on the result; defaults to the transcript's own `sessionId` field, else "unknown". */
  sessionId?: string;
}

/**
 * PURE: parse a Claude Code transcript (JSONL text) into the ordered tool-call trace the budget core
 * measures. Tool calls are ordered by their `tool_use` timestamp; each latency is `result_ts −
 * use_ts` for the matching result, or 0 when there is no matching result (an unpaired trailing call).
 */
export function parseTranscript(jsonl: string, opts: ParseTranscriptOpts = {}): ParsedTranscript {
  const pending = new Map<string, PendingUse>();
  const resultMs = new Map<string, number>();
  const uses: PendingUse[] = [];
  let derivedSessionId: string | undefined;
  let index = 0;

  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let entry: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null) continue;
      entry = parsed as Record<string, unknown>;
    } catch {
      continue; // malformed line — skip, never throw.
    }

    if (derivedSessionId === undefined && typeof entry["sessionId"] === "string") {
      derivedSessionId = entry["sessionId"] as string;
    }

    const at = tsMs(entry["timestamp"]);
    for (const block of contentBlocks(entry)) {
      const btype = block["type"];
      if (btype === "tool_use") {
        const id = typeof block["id"] === "string" ? (block["id"] as string) : "";
        const tool = typeof block["name"] === "string" ? (block["name"] as string) : "";
        const target = extractToolTarget(tool, block["input"]);
        const use: PendingUse = { index: index++, tool, target, useMs: at };
        uses.push(use);
        if (id !== "") pending.set(id, use);
      } else if (btype === "tool_result") {
        const forId = typeof block["tool_use_id"] === "string" ? (block["tool_use_id"] as string) : "";
        if (forId !== "" && !resultMs.has(forId)) resultMs.set(forId, at);
      }
    }
  }

  // Re-associate each pending use with its result timestamp (results may arrive on a later line).
  const useById = new Map<PendingUse, string>();
  for (const [id, use] of pending) useById.set(use, id);

  const calls: TraceToolCall[] = uses.map((use) => {
    const id = useById.get(use);
    const rMs = id !== undefined ? resultMs.get(id) : undefined;
    const latencyMs =
      rMs !== undefined && Number.isFinite(rMs) && Number.isFinite(use.useMs) && rMs > use.useMs
        ? rMs - use.useMs
        : 0;
    return { tool: use.tool, target: use.target, latencyMs };
  });

  return { sessionId: opts.sessionId ?? derivedSessionId ?? "unknown", calls };
}
