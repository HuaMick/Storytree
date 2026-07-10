/**
 * The credential bridge (ADR-0109 Step 2 / ADR-0113 §5).
 *
 * Reads the brokered credential from the in-process keychain and injects it into
 * the backend driver invocation — via the correct env var for the credential kind —
 * without ever returning the raw token to a renderer-reachable surface.
 *
 * The hand-off is entirely in-process (Electron main process): no TLS hop, no HTTP,
 * no server-side persistence. The renderer triggers a build as an INTENT; the
 * credential is attached here, in the main process, and never flows back to the UI.
 */

import type { CredentialBroker } from "../credential/broker.js";
import type { CredentialKind } from "../credential/kinds.js";
import { CREDENTIAL_ENV_VAR } from "../credential/kinds.js";

/** The result type returned to the caller (never carries the raw token). */
export interface BridgeResult {
  ok: boolean;
  body: string;
}

/** The driver invocation seam — injected so the bridge is provable offline. */
export type DriverFn = (
  unitId: string,
  env: Record<string, string>,
  sink: (line: string) => void,
) => Promise<BridgeResult>;

/**
 * Reads the brokered credential and feeds it to the driver invocation in-process.
 *
 * Safety contract (ADR-0109 d.4): no public method returns the raw token; the
 * build() result carries only {ok, body} — no token field, no token value.
 */
export class CredentialBridge {
  readonly #broker: CredentialBroker;
  readonly #driver: DriverFn;
  readonly #env: Record<string, string | undefined>;

  constructor(
    broker: CredentialBroker,
    driver: DriverFn,
    env: Record<string, string | undefined> = process.env,
  ) {
    this.#broker = broker;
    this.#driver = driver;
    this.#env = env;
  }

  /**
   * Reads the credential for `kind` from the broker, injects it under the
   * correct env var, and invokes the driver. Rejects with a typed Error if
   * no credential is held — the driver is never called with an empty token.
   *
   * The returned BridgeResult does NOT carry the raw token (renderer safety).
   */
  async build(
    unitId: string,
    kind: CredentialKind,
    sink: (line: string) => void,
  ): Promise<BridgeResult> {
    const token = await this.#broker.read(kind);
    if (token === null) {
      throw new Error(
        `No credential stored for kind "${kind}" — store a token before building.`,
      );
    }

    const envName = CREDENTIAL_ENV_VAR[kind];
    const previous = this.#env[envName];
    this.#env[envName] = token;
    try {
      return await this.#driver(unitId, { [envName]: token }, sink);
    } finally {
      if (previous === undefined) delete this.#env[envName];
      else this.#env[envName] = previous;
    }
  }
}
