import type { ZodType } from "zod";
import type { Model, ModelMessage, ModelRequest } from "./model.js";
import type { ToolExecutor } from "./tool-executor.js";
import { runTurn } from "./run-turn.js";

/**
 * The fail-closed step (ported from the IDEA of
 * legacy/Agentic/crates/agentic-runtime/src/step.rs). A step wraps {@link runTurn} and captures
 * a TERMINAL result, returning a typed discriminated union. FAIL-CLOSED CONTRACT: a turn that
 * ends without terminal text is `{ ok:false, error:'NoTerminalResult' }`, NEVER an empty-but-ok
 * value — so a sequence can halt deterministically on failure (step.rs §fail-closed).
 */
export type StepResult<T = unknown> =
  | { ok: true; output: string; structuredOutput?: T; transcript: ModelMessage[] }
  | {
      ok: false;
      error: "NoTerminalResult" | "ValidationFailed" | "ModelError";
      detail?: string;
    };

/** The arguments shared by {@link runStep} and {@link runStepValidated}. */
export interface StepArgs {
  model: Model;
  tools?: ToolExecutor;
  request: ModelRequest;
  maxTurns?: number;
}

/**
 * Run a single step: drive the turn to termination and capture the terminal text. A model or
 * loop error (e.g. maxTurns exceeded) becomes `{ ok:false, error:'ModelError' }`; an empty
 * terminal result becomes `{ ok:false, error:'NoTerminalResult' }`.
 */
export async function runStep(args: StepArgs): Promise<StepResult> {
  let result;
  try {
    result = await runTurn(args);
  } catch (err) {
    return {
      ok: false,
      error: "ModelError",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const output = result.finalText.trim();
  if (output.length === 0) {
    return { ok: false, error: "NoTerminalResult" };
  }
  return { ok: true, output, transcript: result.transcript };
}

/**
 * Run a step and extract + zod-validate structured output. The simplest extraction (per spec):
 * parse the terminal text as a JSON object. On a parse/validation miss, RETRY up to `maxRetries`
 * (default 2) with a corrective follow-up user message appended to the request; exhausting the
 * retries is `{ ok:false, error:'ValidationFailed' }` (fail-closed — never a best-effort value).
 */
export async function runStepValidated<T>(
  schema: ZodType<T>,
  args: StepArgs,
  opts?: { maxRetries?: number },
): Promise<StepResult<T>> {
  const maxRetries = opts?.maxRetries ?? 2;

  // We extend the message list with corrective follow-ups between attempts.
  let messages: ModelMessage[] = [...args.request.messages];
  let lastDetail = "";

  // Total attempts = 1 initial + maxRetries.
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const step = await runStep({ ...args, request: { ...args.request, messages } });

    if (!step.ok) {
      // A model/loop error or empty terminal result. Record and (if retries remain) re-prompt.
      lastDetail = step.error === "NoTerminalResult" ? "no terminal result" : (step.detail ?? step.error);
      if (attempt < maxRetries) {
        messages = [
          ...messages,
          {
            role: "user",
            content: "Your previous response was empty. Reply with ONLY the JSON object.",
          },
        ];
        continue;
      }
      break;
    }

    const parsed = tryParseJson(step.output);
    if (parsed.ok) {
      const validation = schema.safeParse(parsed.value);
      if (validation.success) {
        return {
          ok: true,
          output: step.output,
          structuredOutput: validation.data,
          transcript: step.transcript,
        };
      }
      lastDetail = validation.error.message;
    } else {
      lastDetail = parsed.detail;
    }

    if (attempt < maxRetries) {
      messages = [
        ...messages,
        { role: "assistant", content: step.output },
        {
          role: "user",
          content:
            `That did not validate (${lastDetail}). ` +
            "Reply with ONLY a single JSON object matching the required schema.",
        },
      ];
    }
  }

  return { ok: false, error: "ValidationFailed", detail: lastDetail };
}

/** Parse a string as a JSON object. Tolerates surrounding whitespace and a ```json fence. */
function tryParseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; detail: string } {
  const stripped = stripFence(text).trim();
  try {
    return { ok: true, value: JSON.parse(stripped) };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "invalid JSON" };
  }
}

/** Remove a leading/trailing markdown code fence (```json ... ```), if present. */
function stripFence(text: string): string {
  const fence = /^\s*```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/;
  const m = fence.exec(text);
  return m && m[1] !== undefined ? m[1] : text;
}
