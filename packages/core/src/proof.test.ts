import test from "node:test";
import assert from "node:assert/strict";
import {
  ProofMode,
  Outcome,
  Verdict,
  SigningRow,
  EvidenceRef,
  isProvenStatus,
} from "./proof.js";

test("ProofMode accepts the four ADR-0007 modes", () => {
  for (const m of ["contract", "capability", "story", "operator-attested"]) {
    assert.equal(ProofMode.parse(m), m);
  }
  assert.throws(() => ProofMode.parse("UAT"));
});

test("Outcome is pass|fail", () => {
  assert.equal(Outcome.parse("pass"), "pass");
  assert.equal(Outcome.parse("fail"), "fail");
  assert.throws(() => Outcome.parse("green"));
});

test("EvidenceRef requires kind and ref, note optional", () => {
  assert.deepEqual(EvidenceRef.parse({ kind: "red", ref: "log:1" }), {
    kind: "red",
    ref: "log:1",
  });
  assert.throws(() => EvidenceRef.parse({ kind: "red" }));
});

test("Verdict defaults evidence to []", () => {
  const v = Verdict.parse({
    unitId: "cap-1",
    proofMode: "capability",
    outcome: "pass",
    commitSha: "abc123",
    signer: "me@x",
    runId: "run-9",
    at: "2026-06-08T00:00:00Z",
  });
  assert.deepEqual(v.evidence, []);
});

test("Verdict carries evidence when supplied", () => {
  const v = Verdict.parse({
    unitId: "c1",
    proofMode: "contract",
    outcome: "fail",
    commitSha: "deadbeef",
    signer: "s",
    runId: "r1",
    evidence: [{ kind: "runtime-red", ref: "ev:1", note: "assertion failed" }],
    at: "2026-06-08T00:00:00Z",
  });
  assert.equal(v.evidence.length, 1);
});

test("SigningRow accepts optional verdictRef", () => {
  const row = SigningRow.parse({
    id: "sign-1",
    unitId: "u1",
    proofMode: "story",
    outcome: "pass",
    commitSha: "abc",
    signer: "s",
    at: "2026-06-08T00:00:00Z",
  });
  assert.equal(row.verdictRef, undefined);
});

test("isProvenStatus: only healthy is proven", () => {
  assert.equal(isProvenStatus("healthy"), true);
  assert.equal(isProvenStatus("building"), false);
  assert.equal(isProvenStatus("proposed"), false);
  assert.equal(isProvenStatus("mapped"), false);
});
