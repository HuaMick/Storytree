/** Browser-safe metadata-only traversal event and adapter-coverage vocabulary (ADR-0235). */
import { z } from "zod";

const identity = z.string().trim().min(1);
const count = z.number().int().nonnegative();
const common = {
  eventId: identity,
  sessionId: identity,
  at: z.string().datetime({ offset: true }),
} as const;

const visit = {
  ...common,
  visitId: identity,
  nodeId: identity,
  surfaceId: identity.optional(),
  parentVisitId: identity.optional(),
  priorVisitId: identity.optional(),
  followedEdgeId: identity.optional(),
} as const;

function visitSchema(kind: "front_matter_read" | "full_payload_read") {
  return z
    .object({
      kind: z.literal(kind),
      ...visit,
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.parentVisitId === value.visitId || value.priorVisitId === value.visitId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "a visit cannot name itself as its parent or prior visit",
        });
      }
    });
}

export const FrontMatterReadEvent = visitSchema("front_matter_read");
export const FullPayloadReadEvent = visitSchema("full_payload_read");

export const SearchEvent = z
  .object({
    kind: z.literal("search"),
    ...common,
    searchId: identity,
    surfaceId: identity,
    operation: z.enum(["library_artifact_list", "library_dashboard"]),
    resultNodeIds: z.array(identity),
  })
  .strict();

export const CandidateSetEvent = z
  .object({
    kind: z.literal("candidate_set"),
    ...common,
    candidateSetId: identity,
    surfaceId: identity,
    candidateNodeIds: z.array(identity).min(1),
  })
  .strict();

export const FollowedEdgeEvent = z
  .object({
    kind: z.literal("followed_edge"),
    ...common,
    edgeId: identity,
    candidateSetId: identity,
    fromVisitId: identity,
    toVisitId: identity,
  })
  .strict()
  .refine((value) => value.fromVisitId !== value.toVisitId, {
    message: "a followed edge must connect two different visits",
  });

export const ModelContextEvent = z
  .object({
    kind: z.literal("model_context"),
    ...common,
    modelId: identity.optional(),
    cumulativeInputTokens: count,
    addedInputTokens: count,
    contextWindowCapacity: count.positive().optional(),
  })
  .strict();

export const SpawnHandoffEvent = z
  .object({
    kind: z.literal("spawn_handoff"),
    ...common,
    edgeId: identity,
    parentSessionId: identity,
    childSessionId: identity,
    agentType: identity.optional(),
    payloadTokenCount: count.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.sessionId !== value.parentSessionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "spawn handoff sessionId must be the parent session",
      });
    }
    if (value.parentSessionId === value.childSessionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "spawn handoff must join two independent sessions",
      });
    }
  });

export const ResultReturnEvent = z
  .object({
    kind: z.literal("result_return"),
    ...common,
    edgeId: identity,
    parentSessionId: identity,
    childSessionId: identity,
    resultTokenCount: count.optional(),
    ok: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.sessionId !== value.parentSessionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "result return sessionId must be the parent session",
      });
    }
    if (value.parentSessionId === value.childSessionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "result return must join two independent sessions",
      });
    }
  });

export const ContextTraversalEvent = z.union([
  FrontMatterReadEvent,
  FullPayloadReadEvent,
  SearchEvent,
  CandidateSetEvent,
  FollowedEdgeEvent,
  ModelContextEvent,
  SpawnHandoffEvent,
  ResultReturnEvent,
]);
export type ContextTraversalEvent = z.infer<typeof ContextTraversalEvent>;

export type ContextVisitEvent = z.infer<typeof FrontMatterReadEvent> | z.infer<typeof FullPayloadReadEvent>;
export type ContextModelEvent = z.infer<typeof ModelContextEvent>;

/**
 * One closed domain for both positive coverage and omissions. Keeping both sides in the same
 * vocabulary makes contradictory or conveniently-incomplete declarations mechanically refusible.
 */
export const CoverageFeature = z.enum([
  "surface:create_orientation_runner",
  "surface:direct_cli",
  "surface:claude_sdk",
  "surface:codex",
  "surface:owned_loop",
  "surface:spawned_agent",
  "surface:agents",
  "surface:noticeboard",
  "event:front_matter_read",
  "event:full_payload_read",
  "event:search",
  "event:candidate_set",
  "event:followed_edge",
  "event:model_context",
  "event:spawn_handoff",
  "event:result_return",
  "field:surface_id",
  "field:parent_visit_id",
  "field:prior_visit_id",
  "field:model_tokens",
  "field:context_window_capacity",
  "field:candidate_follow_causality",
  "field:child_context_window",
]);
export type CoverageFeature = z.infer<typeof CoverageFeature>;

const allCoverageFeatures: readonly CoverageFeature[] = CoverageFeature.options;

export const ContextTraversalCoverage = z
  .object({
    adapterId: identity,
    supported: z.array(CoverageFeature),
    omitted: z.array(CoverageFeature),
  })
  .strict()
  .superRefine((value, ctx) => {
    const supported = new Set(value.supported);
    const omitted = new Set(value.omitted);
    if (supported.size !== value.supported.length || omitted.size !== value.omitted.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "coverage features may be declared only once",
      });
    }
    for (const feature of supported) {
      if (omitted.has(feature)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `coverage feature ${feature} cannot be both supported and omitted`,
        });
      }
    }
    for (const feature of allCoverageFeatures) {
      if (!supported.has(feature) && !omitted.has(feature)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `coverage feature ${feature} must be explicitly supported or omitted`,
        });
      }
    }
  });
export type ContextTraversalCoverage = z.infer<typeof ContextTraversalCoverage>;

export function isContextVisitEvent(event: ContextTraversalEvent): event is ContextVisitEvent {
  return event.kind === "front_matter_read" || event.kind === "full_payload_read";
}
