import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { parseCriteria } from "@storytree/model-uat";

const dir = "apps/studio/data/seed-kinds/uat-criterion";
mkdirSync(dir, { recursive: true });

const stories = ["drive-machinery", "library-review", "library-tech-tree-overlay"];
let n = 0;
for (const id of stories) {
  const body = readFileSync(`stories/${id}/story.md`, "utf8");
  const criteria = parseCriteria(id, body);
  for (const c of criteria) {
    const detail = {
      kind: "uat-criterion",
      id: c.id,
      action: `Execute the story UAT walk for "${c.title}" against the real surface named by the criterion.`,
      successConditions: `The success conditions stated on ${c.id} in stories/${id}/story.md hold observably (${c.witness} witness).`,
      evidenceExpectations:
        c.witness === "machine"
          ? "Capture the bound proof-gate command transcript / suite output that witnesses this leg."
          : c.witness === "human"
            ? "Capture operator attestation evidence (screenshot or signed UAT row) for the irreducible judgment gap."
            : "Capture the model-judge structured result (PASS/FAIL/INCONCLUSIVE) with detail-hash anchor and rationale.",
      refs: [],
    };
    // Filename cannot contain `#` on all platforms — use `__` as the join-key separator on disk.
    const path = `${dir}/${c.id.replace(/#/g, "__")}.json`;
    writeFileSync(path, `${JSON.stringify(detail, null, 2)}\n`);
    n += 1;
    console.log("wrote", path);
  }
}
console.log("done", n, "details");
