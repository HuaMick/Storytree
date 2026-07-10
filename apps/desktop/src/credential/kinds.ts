// The credential kinds the desktop client hosts. Each names the env var its
// operation reads when the credential is brokered from the OS keychain.

export type CredentialKind = "oauth" | "api-key" | "cursor-api-key";

/** The env var each kind populates for its scoped operation. */
export const CREDENTIAL_ENV_VAR: Record<CredentialKind, string> = {
  oauth: "CLAUDE_CODE_OAUTH_TOKEN",
  "api-key": "ANTHROPIC_API_KEY",
  "cursor-api-key": "CURSOR_API_KEY",
};

export const CREDENTIAL_KINDS: readonly CredentialKind[] = [
  "oauth",
  "api-key",
  "cursor-api-key",
];
