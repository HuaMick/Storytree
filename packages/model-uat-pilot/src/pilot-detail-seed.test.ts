import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCriteria } from "@storytree/model-uat";
import {
  parseCriterionPointers,
  UatCriterionDetail,
  displayTitle,
  UAT_CRITERION_DETAIL_SEED_DIR,
} from "@storytree/uat-criterion";
import { PILOT_STORY_IDS } from "./pilot-cast.js";
import { detailSeedFilename } from "./pilot-migration-harness.js";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

test("every-pilot-criterion-has-detail-pointer: full coverage", () => {
  for (const storyId of PILOT_STORY_IDS) {
    const body = readFileSync(join(REPO_ROOT, "stories", storyId, "story.md"), "utf8");
    const criteria = parseCriteria(storyId, body);
    const pointers = parseCriterionPointers(storyId, body);
    assert.equal(pointers.length, criteria.length, `${storyId} pointer coverage`);
  }
});

test("every-pilot-detail-validates: seed bodies are real", () => {
  for (const storyId of PILOT_STORY_IDS) {
    const body = readFileSync(join(REPO_ROOT, "stories", storyId, "story.md"), "utf8");
    for (const binding of parseCriterionPointers(storyId, body)) {
      const path = join(
        REPO_ROOT,
        UAT_CRITERION_DETAIL_SEED_DIR,
        detailSeedFilename(binding.detailArtifactId),
      );
      const detail = UatCriterionDetail.parse(JSON.parse(readFileSync(path, "utf8")));
      assert.equal(detail.id, binding.detailArtifactId);
      assert.equal(detail.kind, "uat-criterion");
    }
  }
});

test("detail-does-not-redefine-title: story stays display-canonical", () => {
  for (const storyId of PILOT_STORY_IDS) {
    const body = readFileSync(join(REPO_ROOT, "stories", storyId, "story.md"), "utf8");
    for (const binding of parseCriterionPointers(storyId, body)) {
      const path = join(
        REPO_ROOT,
        UAT_CRITERION_DETAIL_SEED_DIR,
        detailSeedFilename(binding.detailArtifactId),
      );
      const detail = UatCriterionDetail.parse(JSON.parse(readFileSync(path, "utf8")));
      assert.equal(
        displayTitle({ criterion: binding.criterion, detail }),
        binding.criterion.title,
      );
      assert.equal("title" in detail, false);
    }
  }
});
