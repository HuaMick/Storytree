---
id: "unified-command-dispatch"
tier: capability
story: cli
title: "storytree <verb> dispatches to the owning organism and returns a typed envelope"
outcome: "storytree <verb> parses args, hydrates credentials, dispatches to the owning organism, and returns a typed Envelope/exit code; offline commands run with no DB."
status: mapped
proof_mode: integration-test
depends_on: []
---

# `storytree <verb>` dispatches to the owning organism and returns a typed envelope

**Outcome —** `storytree <verb>` (`packages/cli/src/main.ts`) parses args, hydrates credentials,
dispatches to the owning organism, and returns a typed `Envelope`/exit code; offline commands run
with no DB.

## Guidance

- `main.ts` is the single entry: parse → `buildStore` (in-memory seed offline, `PgLibraryStore`
  under `--pg`) → dispatch by verb → render the `Envelope` → map `ok` to an exit code.
- Credentials hydrate from `secrets.ts` (`CLAUDE_CODE_OAUTH_TOKEN`, `STORYTREE_DB_USER` from
  `~/.storytree/secrets.json` when unset; env wins), so no command needs an env-var prefix.
- The shim holds no domain logic — every verb forwards into the organism that owns it; the CLI only
  parses, dispatches, and maps to the envelope/exit code.

## Contracts (2)

1. **`verb-dispatch-to-envelope`** — a known verb reaches its organism and returns `ok:true`
   - **asserts —** `storytree library` (and another verb, e.g. `tree`) dispatch to their surface
     and return a well-formed `Envelope` with a `next:` block; an unknown verb returns `ok:false`
     guidance, not a throw.
2. **`offline-safe-and-write-gated`** — reads run offline; writes refuse without `--pg`
   - **asserts —** a read command returns `ok:true` against the in-memory seed with no DB; a write
     without `--pg` returns `ok:false` ("run with --pg") and a non-zero exit code.
