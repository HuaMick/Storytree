import { execFileSync } from "node:child_process";

/**
 * The fail-closed signer-identity chain (ported from
 * legacy/Agentic/crates/agentic-signer/src/lib.rs — ADR-0020 §4).
 *
 * A verdict must be attributed to a resolved identity. The chain walks, in strict order,
 * flag -> env -> git email, returning the FIRST value that survives trimming. There is NO
 * default fallback (no "unknown", no unix user, no hostname): if every tier is empty the
 * resolution FAILS CLOSED. The core resolver is pure so the whole chain is table-testable.
 *
 * Validation rule: trimmed length > 0. No email-shape regex, no length cap, no character
 * whitelist — the sandbox convention `sandbox:<model>@<run_id>` must pass.
 */

/** The resolver inputs, one per tier. A missing tier is `undefined`; an empty/blank value falls through. */
export interface SignerInputs {
  flag?: string;
  env?: string;
  gitEmail?: string;
}

/** The result of resolving a signer: either a non-empty identity or a clear error. */
export type SignerResult =
  | { ok: true; signer: string }
  | { ok: false; error: string };

/**
 * PURE signer resolution. Walks flag -> env -> gitEmail; at EACH tier a value that trims to
 * length 0 falls through to the next tier (it does not error — "present but blank" is treated
 * as "absent" here, deliberately simpler than the legacy SignerInvalid distinction so the
 * chain never wedges on a stray empty env var). If all tiers are empty, fails closed.
 */
export function resolveSigner(inputs: SignerInputs): SignerResult {
  const tiers: ReadonlyArray<readonly [string, string | undefined]> = [
    ["flag", inputs.flag],
    ["env", inputs.env],
    ["gitEmail", inputs.gitEmail],
  ];
  for (const [, value] of tiers) {
    if (value !== undefined && value.trim().length > 0) {
      return { ok: true, signer: value.trim() };
    }
  }
  return {
    ok: false,
    error:
      "signer could not be resolved; consulted sources: flag, env (STORYTREE_SIGNER), gitEmail (git config user.email). No default fallback (fail-closed).",
  };
}

/**
 * Thin IMPURE wrapper: reads `process.env.STORYTREE_SIGNER` and `git config user.email`
 * (tolerant of failure -> ''), then delegates to the pure {@link resolveSigner}.
 */
export function resolveSignerFromEnv(opts?: { flag?: string }): SignerResult {
  const inputs: SignerInputs = { gitEmail: readGitEmail() };
  const env = process.env.STORYTREE_SIGNER;
  if (env !== undefined) {
    inputs.env = env;
  }
  if (opts?.flag !== undefined) {
    inputs.flag = opts.flag;
  }
  return resolveSigner(inputs);
}

/** Read `git config user.email`, returning '' on any failure (no repo, unset, git missing). */
function readGitEmail(): string {
  try {
    return execFileSync("git", ["config", "user.email"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}
