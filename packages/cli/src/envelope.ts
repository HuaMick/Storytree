// Back-compat shim after the drive extraction: the Envelope type + formatter moved to
// `@storytree/drive`. Re-exported here so every cli file that imports `./envelope.js` is unchanged.
export { formatEnvelope, type Envelope } from "@storytree/drive";
