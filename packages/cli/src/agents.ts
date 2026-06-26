import type { Store } from "@storytree/storage-protocol";
import { renderAgentPrompt } from "@storytree/library/store";

import type { Envelope } from "./envelope.js";

/**
 * The `agents` command shells (ADR-0051): the Envelope-returning CLI surface over the agent renderer.
 * The renderer itself (`renderAgentPrompt` / `renderAgentDigest` / `renderAgentFile` /
 * `delegatableAgentIds`) lives in `@storytree/library` (the organism that owns the artifact schema it
 * reads) — the drive extraction moved it there so the CLI commands, the build drivers, and the
 * generators all assemble prompts from one place. These shells stay in the CLI because they speak the
 * CLI's `Envelope`.
 */

/** `storytree agents <name>` — print one agent's assembled system prompt (ADR-0051). */
export async function agentsCommand(store: Store, name: string | undefined): Promise<Envelope> {
  const result = await renderAgentPrompt(store, name);
  if (!result.ok) {
    return {
      ok: false,
      body: result.reason,
      next: result.available.map((id) => `storytree agents ${id}`),
    };
  }
  const { agent } = result;
  return {
    // A dangling ref is a real defect in the manifest — fail the envelope so a `--check`-style
    // caller (or a human) notices, while still printing the (degraded) prompt for inspection.
    ok: agent.missingRefs.length === 0,
    body:
      agent.prompt +
      (agent.missingRefs.length > 0
        ? `\n\n--- ${agent.missingRefs.length} dangling ref(s): ${agent.missingRefs.join(", ")} ---`
        : ""),
    next: [`storytree library artifact ${agent.name}   (the raw agent artifact)`],
  };
}

/** `storytree agents` help. */
export function agentsHelp(): Envelope {
  return {
    ok: true,
    body: [
      "storytree agents <name> — assemble an agent's system prompt from the Library (ADR-0051).",
      "",
      "Reads the `agent` artifact and INJECTS the content its context/rules/antiPatterns refs point",
      "at (reference-don't-restate, ADR-0029 §7). Offline by default; --pg reads the live store.",
      "",
      "  storytree agents <name>        print the assembled system prompt",
    ].join("\n"),
    next: ["storytree agents orchestrator", "storytree library artifact list agent"],
  };
}
