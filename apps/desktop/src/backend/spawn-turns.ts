// The chat-spawned story-author turn budget (spawn-visibility follow-on, 2026-07-04).
//
// WHY THIS EXISTS: the desktop chat spawns a story-author to author a story against the WHOLE
// storytree corpus — a legitimately long session. The generic spawn runaway brake is 16 turns
// (runSpawnStoryAuthor's default, ADR-0130), which authoring reliably overruns: the SDK hits the
// ceiling AFTER it has already written valid stories/** files, returns ok:false, and the chat renders
// "✗ story-author failed" for what was actually a successful authoring. A live walk confirmed the same
// spawn finishes clean under a 45-turn ceiling.
//
// So the story-author spawn gets its OWN, higher default here — WITHOUT touching the global 16-turn
// brake other spawn contexts (the builder path) rely on (ADR-0130: the turn cap is the runaway brake;
// don't blindly raise it everywhere). backend-entry.ts threads the resolved value into buildSpawnDeps,
// which applies maxTurns to the story-author path only (the builder dispatch is unaffected — it stays
// at 16).
//
// Env-tunable via STORYTREE_SPAWN_MAX_TURNS for the rare authoring that still needs more (or less);
// env always wins. This module is a pure function so it carries a CI unit test — the backend-entry
// glue that consumes it is operator-attested (a node:test over it would spawn a billed SDK session).

/**
 * Default turn ceiling for the chat-spawned story-author. Authoring a real story against the large
 * corpus needs more than the generic 16-turn runaway brake (ADR-0130); a live walk finished clean at
 * 45, so 40 leaves headroom over the observed need while staying a genuine runaway brake.
 */
export const DEFAULT_STORY_AUTHOR_MAX_TURNS = 40;

/**
 * Resolve the story-author spawn turn ceiling from an env value, falling back to a default.
 *
 * A blank, absent, non-numeric, non-finite, or non-positive value yields the fallback — never a
 * broken cap (a 0/NaN maxTurns would abort the session before it started). A positive value is
 * floored to a whole turn count.
 */
export function resolveSpawnMaxTurns(
  raw: string | undefined,
  fallback: number = DEFAULT_STORY_AUTHOR_MAX_TURNS,
): number {
  const n = Number(raw ?? "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
