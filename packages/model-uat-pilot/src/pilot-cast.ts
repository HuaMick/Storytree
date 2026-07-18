/**
 * The locked ADR-0209 D8 three-story pilot cast. One session working the pilot
 * migrates exactly these stories — never a silent fourth, never a missing member.
 */
export const PILOT_STORY_IDS = [
  "drive-machinery",
  "library-review",
  "library-tech-tree-overlay",
] as const;

export type PilotStoryId = (typeof PILOT_STORY_IDS)[number];

export function isPilotStoryId(id: string): id is PilotStoryId {
  return (PILOT_STORY_IDS as readonly string[]).includes(id);
}
