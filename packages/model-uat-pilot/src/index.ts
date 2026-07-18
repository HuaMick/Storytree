/**
 * `@storytree/model-uat-pilot` — the model-uat-pilot organism.
 *
 * Three-story pilot migration harness (ADR-0209 D8): parse/assert/report
 * explicit witness classification + seed-canonical detail coverage for
 * drive-machinery, library-review, and library-tech-tree-overlay.
 * Consumers import `@storytree/model-uat-pilot`, never a sibling file.
 */

export { PILOT_STORY_IDS, isPilotStoryId } from "./pilot-cast.js";
export type { PilotStoryId } from "./pilot-cast.js";

export {
  assertPilotMigrationComplete,
  isMigratedCriterion,
  reportPilotMigration,
  listSeedDetailIds,
  detailSeedFilename,
} from "./pilot-migration-harness.js";
export type {
  PilotPaths,
  PilotMigrationReport,
  StoryMigrationReport,
} from "./pilot-migration-harness.js";
