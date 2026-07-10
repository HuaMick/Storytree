---
id: "credential-broker"
tier: capability
story: desktop
title: "The credential broker safely supplies each independently namespaced runtime credential only to its authorized operation"
outcome: "The desktop safely brokers each independently namespaced runtime credential from the OS keychain to only its authorized operation without renderer disclosure or process-lifetime residue."
status: proposed
proof_mode: contract-test
depends_on: []
decisions: [109, 111, 177]
---

# The credential broker safely supplies each independently namespaced runtime credential only to its authorized operation

**Outcome —** The desktop safely brokers each independently namespaced runtime credential from the OS
keychain to only its authorized operation without renderer disclosure or process-lifetime residue.

This remains **one capability** for the first minimum-green Cursor credential-storage increment. Its
single walkthrough starts with one requested credential kind and proves the same boundary end to end:
that kind is independently stored, exposed to only its authorized operation for only that operation's
lifetime, and never disclosed to the renderer. The new Cursor kind does not create a second consumer
journey; it extends the existing broker vocabulary and exercises the same keychain-to-operation
boundary.

The broker speaks to a narrow **`KeychainPort`** (`set` / `get` / `delete` verbs) rather than to any
concrete secret store. CI uses `InMemoryKeychain` plus an injected environment, so every automated
contract below is offline and cannot touch a real credential. The thin `@napi-rs/keyring` binding and
a real OS-keychain round-trip remain operator-attested under
[`electron-shell`](electron-shell.md) (ADR-0070).

## Proof walkthrough — contract-test

Using `InMemoryKeychain`, an injected environment object, the existing typed IPC/preload API shape,
and stubbed operation runners:

1. Store all three credential kinds through the broker, then read and clear them by kind; observe that
   each kind maps to exactly one environment variable and that changing or clearing one kind cannot
   affect either other kind.
2. Run the package typecheck across the existing main/preload store, status, and sign-out signatures:
   all accept `cursor-api-key`; status and sign-out return only booleans, while store returns `void`,
   so no response shape can carry a raw value.
3. Invoke a generic operation bridge for each kind; observe precedence
   **explicit environment > requested-operation keychain > secrets file**, the selected mapping only
   during the operation, and exact restoration in `finally` after success or failure. An injected
   variable that did not exist before the operation is scrubbed rather than retained.
4. Invoke a Claude build with only `cursor-api-key` stored; observe that Claude selection considers
   only `oauth` or `api-key` and fails closed. Keep sidecar startup outside credential selection: it
   performs no keychain read, while a later Cursor operation can request per-operation injection.

## Guidance

- **The `KeychainPort` seam is what makes these contracts CI-runnable.** Define the port as a narrow
  interface (`set(account, secret)`, `get(account)`, `delete(account)`), inject it into the broker,
  and pass `InMemoryKeychain` in tests. The broker has no dependency on `@napi-rs/keyring` or any OS
  API — only on the port.
- **Exactly three independently namespaced kinds.** The tagged vocabulary is:
  - `oauth` → `CLAUDE_CODE_OAUTH_TOKEN`
  - `api-key` → `ANTHROPIC_API_KEY`
  - `cursor-api-key` → `CURSOR_API_KEY`

  Each kind owns a distinct keychain account key. Reads, writes, and clears are selected by kind;
  there is no shared/default account and no cross-kind fallback.
- **Runtime authorization is narrower than storage support.** A Claude build may select only
  `oauth` or `api-key`. `cursor-api-key` is never a Claude credential and cannot
  authenticate a Claude build; Cursor-only storage therefore makes a Claude build fail closed. A
  Cursor operation requests only `cursor-api-key`.
- **The generic bridge grants a credential for one operation only.** Given the requested kind, it
  resolves the mapped variable with precedence **explicit environment > requested-operation keychain
  > secrets file**, injects only that variable into the operation environment, and restores the
  previous state in `finally` on both success and failure. If the bridge introduced the variable, it
  deletes/scrubs it afterward. It never mutates an unrelated credential variable.
- **Do not park Cursor authentication in the sidecar process.** `CURSOR_API_KEY` is prohibited from
  the sidecar startup environment. The sidecar receives it only through the generic per-operation
  bridge for a Cursor operation, then the bridge scrubs/restores the injected environment.
- **Renderer status is boolean-only; raw-value IPC is store-only.** Typed IPC and preload surfaces may
  accept a raw credential only on the renderer-to-main store call. Status returns only
  `boolean` per requested kind, sign-out returns only `boolean`, and store returns `void`; no response
  shape returns a raw value.
- **The keychain port is the ONLY storage path — this is the safety boundary.** The broker writes the
  credential to nothing else: it holds no `localStorage` reference and writes the token to no file.
- **What is NOT proven here (honest scope).** The real `@napi-rs/keyring` adapter — actually writing
  into Keychain / Credential Manager / libsecret — is thin glue proven by **operator attestation**
  (ADR-0070), not by CI; it round-trips the real OS keychain that CI cannot drive. That attestation
  lives on [`electron-shell`](electron-shell.md). Automated proof never reads or migrates any
  user-level secrets file; `credentialedBuildRunner` tests represent the file tier with an
  already-hydrated injected environment.

## Contracts (4)

1. **`three-kind-keychain-independence`** — all three kinds round-trip, map, and clear independently
   - **asserts —** through `InMemoryKeychain`, each tagged kind maps exactly to its declared environment
     variable and distinct account key; reading one kind never returns another; clearing one leaves
     both others intact.
   - **proven by —** a parameterized broker contract test over the three kinds, including pairwise
     independence and exact mapping assertions.

2. **`typed-ipc-never-discloses`** — renderer status is boolean-only and raw-value IPC is store-only
   - **asserts —** typed main/preload contracts admit a raw value only as store-call input; status is
     a per-kind boolean, sign-out returns only a boolean, and store returns `void`.
   - **proven by —** the package typecheck proving the existing main/preload store, status, and
     sign-out signatures accept the extended `CredentialKind` union including `cursor-api-key`; their
     existing return types prove no raw-valued response surface. No dedicated IPC/preload test is
     required or claimed.

3. **`operation-env-lifetime`** — bridge precedence, namespace isolation, and `finally` scrubbing hold
   - **asserts —** the generic bridge injects only the requested kind's mapped variable; explicit
     environment beats keychain, which beats the already-hydrated environment representing the file
     tier; success and thrown failure both restore the exact prior environment, deleting a newly
     introduced variable.
   - **proven by —** `CredentialBridge` tests cover requested-kind mapping plus success/failure
     restoration, scrubbing, and unrelated-variable isolation; `credentialedBuildRunner` tests cover
     the Claude precedence chain of explicit environment over keychain over the already-hydrated
     environment representing the file tier.

4. **`runtime-credential-partition`** — Cursor storage cannot authenticate Claude or persist at startup
   - **asserts —** the Claude runner considers only `oauth` and `api-key`, then fails
     closed with only `cursor-api-key` stored; a Cursor runner requests only `cursor-api-key`;
     sidecar startup performs no keychain read, so `CURSOR_API_KEY` can enter only inside a requested
     Cursor operation's bridge lifetime.
   - **proven by —** runner tests with `InMemoryKeychain` and injected environments cover the
     Cursor-only/Claude fail-closed case and Cursor's per-operation selection. The startup half is the
     composition boundary itself: sidecar startup has no keychain read; no dedicated startup snapshot
     test is required or claimed.
