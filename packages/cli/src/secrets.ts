// Back-compat shim after the drive extraction: the secrets hydration moved to `@storytree/drive`.
// Re-exported here so cli files importing `./secrets.js` + the `@storytree/cli/secrets` subpath are unchanged.
export * from "@storytree/drive/secrets";
