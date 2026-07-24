import { CoverageFeature } from "./traversal-events.js";
import type {
  ContextTraversalCoverage,
  ContextTraversalEvent,
} from "./traversal-events.js";
import type { ContextTraversalTrace } from "./traversal-trace.js";

export interface OrientationEnvelope {
  readonly ok: boolean;
  readonly body: string;
  readonly doctrine?: readonly string[];
  readonly next?: readonly string[];
}

export type OrientationRunner = (
  argv: readonly string[],
  deps: unknown,
) => Promise<OrientationEnvelope>;

/** The structured metadata read needed for list/dashboard result identities. */
export interface OrientationNodeStore {
  queryDocs(filter?: { kind?: string }): Promise<readonly { id: string }[]>;
}

const ORIENTATION_SUPPORTED_COVERAGE = [
  "event:front_matter_read",
  "event:full_payload_read",
  "event:search",
  "field:surface_id",
] satisfies ContextTraversalCoverage["supported"];

export const ORIENTATION_RUNNER_ADAPTER_COVERAGE: ContextTraversalCoverage = {
  adapterId: "orientation-runner-decorator",
  supported: ORIENTATION_SUPPORTED_COVERAGE,
  omitted: CoverageFeature.options.filter(
    (feature) => !(ORIENTATION_SUPPORTED_COVERAGE as readonly string[]).includes(feature),
  ),
};

export interface OrientationRunnerTelemetry {
  sessionId: string;
  trace: ContextTraversalTrace;
  nodeStore: OrientationNodeStore;
  /** Deterministic chronological identity from the integrating runtime. */
  nextVisitId: () => string;
  /** Integrating runtime clock; the adapter never calls an ambient clock. */
  now: () => Date;
}

/**
 * Decorate one real orientation boundary. Delegation happens first and unchanged; only a successful,
 * supported request is observed. Content stays inside the base runner's response.
 */
export function withContextTraversalTelemetry(
  runner: OrientationRunner,
  telemetry: OrientationRunnerTelemetry,
): OrientationRunner {
  telemetry.trace.declareCoverage(ORIENTATION_RUNNER_ADAPTER_COVERAGE);

  const appendVisit = (
    kind: "front_matter_read" | "full_payload_read",
    nodeId: string,
    surfaceId: string,
  ): void => {
    const visitId = telemetry.nextVisitId();
    const event: ContextTraversalEvent = {
      kind,
      eventId: `event:${visitId}`,
      sessionId: telemetry.sessionId,
      visitId,
      nodeId,
      surfaceId,
      at: telemetry.now().toISOString(),
    };
    telemetry.trace.append(event);
  };

  const appendSearch = (resultNodeIds: string[]): void => {
    const observationId = telemetry.nextVisitId();
    telemetry.trace.append({
      kind: "search",
      eventId: `event:${observationId}`,
      sessionId: telemetry.sessionId,
      searchId: `search:${observationId}`,
      surfaceId: "library",
      operation: "library_artifact_list",
      resultNodeIds,
      at: telemetry.now().toISOString(),
    });
  };

  return async (argv: readonly string[], deps: unknown): Promise<OrientationEnvelope> => {
    const envelope = await runner(argv, deps);
    if (!envelope.ok) return envelope;

    const [area, sub, third, fourth] = argv;
    if (area === "tree") {
      if (sub === "spec" && third !== undefined) {
        appendVisit("full_payload_read", third, "tree");
      } else if (sub !== undefined) {
        appendVisit("front_matter_read", sub, "tree");
      }
      return envelope;
    }

    if (area !== "library") return envelope;
    if (sub === undefined) {
      const docs = await telemetry.nodeStore.queryDocs();
      for (const doc of docs) appendVisit("front_matter_read", doc.id, "library");
      return envelope;
    }
    if (sub !== "artifact") return envelope;
    if (third === "list") {
      const docs = await telemetry.nodeStore.queryDocs(
        fourth === undefined ? undefined : { kind: fourth },
      );
      appendSearch(docs.map((doc) => doc.id));
    } else if (third !== undefined) {
      appendVisit("full_payload_read", third, "library");
    }
    return envelope;
  };
}
