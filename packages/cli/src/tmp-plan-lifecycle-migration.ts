// ONE-SHOT (ADR-0196 / ADR-0183 D1 back-fill) — NOT COMMITTED. Audits the 12 live
// library-tech-tree-overlay plans' stored `status` against the arc increment log's ground truth
// and (with APPLY=1) flips stale ones: plans consumed by a landed increment → consumed,
// drift-replaced ones → superseded. Idempotent: a row already at target is skipped.
import { loadLocalSecrets } from "./secrets.js";
import { createPool, closePool, PgLibraryStore } from "@storytree/library/store";

const TARGET: Record<string, "consumed" | "superseded"> = {
  "library-tech-tree-overlay-plan-1": "superseded",
  "library-tech-tree-overlay-plan-2": "consumed",
  "library-tech-tree-overlay-plan-3": "consumed",
  "library-tech-tree-overlay-plan-4": "consumed",
  "library-tech-tree-overlay-plan-5": "consumed",
  "library-tech-tree-overlay-plan-6": "consumed",
  "library-tech-tree-overlay-plan-7": "consumed",
  "library-tech-tree-overlay-plan-8": "consumed",
  "library-tech-tree-overlay-plan-9": "consumed",
  "library-tech-tree-overlay-plan-10": "consumed",
  "library-tech-tree-overlay-plan-11": "consumed",
  "library-tech-tree-overlay-plan-12": "superseded",
};

const apply = process.env["APPLY"] === "1";
loadLocalSecrets();

const handle = await createPool();
const store = new PgLibraryStore(handle.pool);
try {
  const plans = await store.queryDocs({ kind: "plan" });
  console.log(`${plans.length} plan docs live; mode = ${apply ? "APPLY" : "AUDIT"}`);
  for (const stored of plans) {
    const doc = stored.doc as { status?: string; [k: string]: unknown };
    const current = doc.status ?? "(absent → draft default)";
    const target = TARGET[stored.id];
    if (target === undefined) {
      console.log(`  ?? ${stored.id}: status=${current} — NOT in target map, untouched`);
      continue;
    }
    if (doc.status === target) {
      console.log(`  ok ${stored.id}: already ${target}`);
      continue;
    }
    console.log(`  -> ${stored.id}: ${current} => ${target}${apply ? "" : " (dry)"}`);
    if (apply) {
      await store.upsertDoc({
        id: stored.id,
        kind: stored.kind,
        doc: { ...doc, status: target },
        actor: "adr-0196-lifecycle-backfill",
      });
    }
  }
} finally {
  await closePool(handle.pool, handle.connector);
}
