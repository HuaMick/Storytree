import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseAdrFrontmatter, type AdrMeta } from "./adr-frontmatter.js";

/**
 * The ADR-meta loader (split out of the cli `adr-health.ts` in the drive extraction): the thin
 * fs-backed loader the build drivers need without pulling in the whole `adr-health` check core
 * (which depends on cli's `health.ts` `CheckResult`). `adr-health.ts` stays in cli; this loader
 * moved to drive so `story-build.ts` can consume it without a cli → drive → cli cycle.
 */

/** Parse every `NNNN-*.md` under a decisions dir; parse failures become lines, not throws. */
export function loadAdrMetas(decisionsDir: string): { adrs: AdrMeta[]; parseErrors: string[] } {
  const adrs: AdrMeta[] = [];
  const parseErrors: string[] = [];
  for (const file of readdirSync(decisionsDir).sort()) {
    if (!/^\d{4}-.*\.md$/.test(file)) continue;
    try {
      adrs.push(parseAdrFrontmatter(file, readFileSync(path.join(decisionsDir, file), "utf8")));
    } catch (err) {
      parseErrors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { adrs, parseErrors };
}
