import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Store } from "@storytree/core";
import { createPool, closePool } from "./connection.js";
import { applySchema } from "./migrate.js";
import { PgLibraryStore } from "./pg-store.js";

/**
 * The corpus migration (survey / Phase 2): seed the runtime store from the studio data files —
 * the 73 knowledge units in `apps/studio/data/knowledge.json` and the comments in
 * `apps/studio/data/comments.json`. Each unit is upserted as an INITIAL artifact (which also
 * appends its `created` event, per the {@link Store} contract).
 *
 * Comments are loaded via {@link Store.appendEvent} as `created` events keyed by the comment id,
 * since the narrow Store seam projects only library artifacts; the comment projection table is
 * populated by the dedicated comment path (out of scope here — we record their history).
 */

/** A loaded knowledge unit, kept as `unknown`-ish so validation happens at the store boundary. */
interface KnowledgeUnitLike {
  id: string;
  kind: string;
  [k: string]: unknown;
}

interface CommentLike {
  id: string;
  [k: string]: unknown;
}

/** Resolve a path inside `apps/studio/data/` relative to the repo root (this file's location). */
function dataPath(file: string): string {
  // packages/store/src/load-corpus.ts -> repo root is three dirs up.
  return fileURLToPath(new URL(`../../../apps/studio/data/${file}`, import.meta.url));
}

export interface LoadCorpusResult {
  knowledge: number;
  comments: number;
}

/**
 * Read the studio data files and upsert each unit into `store`. Returns the counts loaded.
 * Validation happens inside {@link Store.upsertDoc} (the loud write boundary).
 */
export async function loadCorpus(store: Store): Promise<LoadCorpusResult> {
  const knowledgeRaw = await readFile(dataPath("knowledge.json"), "utf8");
  const commentsRaw = await readFile(dataPath("comments.json"), "utf8");

  const units = JSON.parse(knowledgeRaw) as KnowledgeUnitLike[];
  const comments = JSON.parse(commentsRaw) as CommentLike[];

  for (const unit of units) {
    await store.upsertDoc({
      id: unit.id,
      kind: unit.kind,
      doc: unit,
      actor: "corpus-migration",
    });
  }

  for (const comment of comments) {
    await store.appendEvent({
      id: comment.id,
      kind: "comment",
      type: "created",
      doc: comment,
      actor: "corpus-migration",
    });
  }

  return { knowledge: units.length, comments: comments.length };
}

/**
 * Script entry: when this file is the process entry point, build a live pool, apply the schema,
 * load the corpus, then tear down. NEVER invoked during tests (guarded by the entry check).
 */
async function main(): Promise<void> {
  const { pool, connector } = await createPool();
  try {
    await applySchema(pool);
    const store = new PgLibraryStore(pool);
    const counts = await loadCorpus(store);
    console.log(
      `loaded ${counts.knowledge} knowledge units, ${counts.comments} comments`,
    );
  } finally {
    await closePool(pool, connector);
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
