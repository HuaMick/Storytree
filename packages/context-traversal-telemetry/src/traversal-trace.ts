import {
  ContextTraversalCoverage,
  ContextTraversalEvent,
  isContextVisitEvent,
} from "./traversal-events.js";
import type {
  ContextModelEvent,
  ContextTraversalCoverage as ContextTraversalCoverageValue,
  ContextTraversalEvent as ContextTraversalEventValue,
} from "./traversal-events.js";

export type ContextTraversalRelationship =
  | { kind: "parent"; fromVisitId: string; toVisitId: string }
  | { kind: "revisit"; fromVisitId: string; toVisitId: string }
  | { kind: "followed"; edgeId: string; fromVisitId: string; toVisitId: string }
  | { kind: "spawn_handoff"; edgeId: string; parentSessionId: string; childSessionId: string }
  | { kind: "result_return"; edgeId: string; parentSessionId: string; childSessionId: string };

export interface ContextTraversalSessionLane {
  sessionId: string;
  events: ContextTraversalEventValue[];
  modelContext: ContextModelEvent[];
}

export interface ContextTraversalReplay {
  events: ContextTraversalEventValue[];
  coverage: ContextTraversalCoverageValue[];
  relationships: ContextTraversalRelationship[];
  sessions: ContextTraversalSessionLane[];
}

export interface ContextTraversalTrace {
  append(input: unknown): ContextTraversalEventValue;
  declareCoverage(input: unknown): ContextTraversalCoverageValue;
  replay(sessionId?: string): ContextTraversalReplay;
}

/**
 * Deterministic in-memory record/replay. Identity/time originate at the runtime adapter; this
 * recorder validates and orders them but never calls a clock, generates an id, or derives causality.
 */
export function createContextTraversalTrace(): ContextTraversalTrace {
  const recorded: { event: ContextTraversalEventValue; appendOrder: number }[] = [];
  const coverage: ContextTraversalCoverageValue[] = [];
  const eventIds = new Set<string>();
  const visitIds = new Set<string>();
  const adapterIds = new Set<string>();

  return {
    append(input: unknown): ContextTraversalEventValue {
      const event = ContextTraversalEvent.parse(input);
      if (eventIds.has(event.eventId)) {
        throw new Error(`duplicate traversal eventId: ${event.eventId}`);
      }
      if (isContextVisitEvent(event) && visitIds.has(event.visitId)) {
        throw new Error(`duplicate traversal visitId: ${event.visitId}`);
      }

      // Mutate only after every parse/identity check has passed.
      eventIds.add(event.eventId);
      if (isContextVisitEvent(event)) visitIds.add(event.visitId);
      recorded.push({ event, appendOrder: recorded.length });
      return event;
    },

    declareCoverage(input: unknown): ContextTraversalCoverageValue {
      const declaration = ContextTraversalCoverage.parse(input);
      if (adapterIds.has(declaration.adapterId)) {
        throw new Error(`duplicate traversal adapterId: ${declaration.adapterId}`);
      }
      adapterIds.add(declaration.adapterId);
      coverage.push(declaration);
      return declaration;
    },

    replay(sessionId?: string): ContextTraversalReplay {
      const ordered = recorded
        .filter(({ event }) => sessionId === undefined || event.sessionId === sessionId)
        .slice()
        .sort((left, right) => {
          const byTime = left.event.at.localeCompare(right.event.at);
          return byTime === 0 ? left.appendOrder - right.appendOrder : byTime;
        })
        .map(({ event }) => event);

      const relationships: ContextTraversalRelationship[] = [];
      for (const event of ordered) {
        if (isContextVisitEvent(event)) {
          if (event.parentVisitId !== undefined) {
            relationships.push({
              kind: "parent",
              fromVisitId: event.parentVisitId,
              toVisitId: event.visitId,
            });
          }
          if (event.priorVisitId !== undefined) {
            relationships.push({
              kind: "revisit",
              fromVisitId: event.priorVisitId,
              toVisitId: event.visitId,
            });
          }
        } else if (event.kind === "followed_edge") {
          relationships.push({
            kind: "followed",
            edgeId: event.edgeId,
            fromVisitId: event.fromVisitId,
            toVisitId: event.toVisitId,
          });
        } else if (event.kind === "spawn_handoff" || event.kind === "result_return") {
          relationships.push({
            kind: event.kind,
            edgeId: event.edgeId,
            parentSessionId: event.parentSessionId,
            childSessionId: event.childSessionId,
          });
        }
      }

      const bySession = new Map<string, ContextTraversalEventValue[]>();
      for (const event of ordered) {
        const events = bySession.get(event.sessionId) ?? [];
        events.push(event);
        bySession.set(event.sessionId, events);
      }
      const sessions: ContextTraversalSessionLane[] = [...bySession.entries()].map(
        ([laneSessionId, events]) => ({
          sessionId: laneSessionId,
          events,
          modelContext: events.filter(
            (event): event is ContextModelEvent => event.kind === "model_context",
          ),
        }),
      );

      return {
        events: ordered,
        coverage: coverage.slice(),
        relationships,
        sessions,
      };
    },
  };
}
