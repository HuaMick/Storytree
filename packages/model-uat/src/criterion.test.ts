import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIFIED_WITNESSES,
  ClassifiedWitness,
  CRITERION_WITNESSES,
  CriterionWitness,
  Criterion,
  criterionId,
  parseCriteria,
  isClassifiedWitness,
  isLegacyUnresolved,
} from "./criterion.js";

/**
 * Offline unit tests for the `three-kind-witness` capability (ADR-0209 D1/D8).
 *
 * A UAT criterion's `witness` now classifies as one of THREE distinct kinds —
 * `machine`, `model`, `human` — or remains the legacy pre-migration UNRESOLVED
 * state `either`. `model` is a genuinely new kind, never a spelling of `machine`.
 * An untagged (legacy) criterion parses only to `either` and can never default
 * into `model` — that state stays visibly unresolved until an explicit migration
 * tags it. An explicit-but-invalid witness value is refused, never defaulted.
 */

const STORY = "demo-story";

/** A story body with one leg of each explicit classified kind, plus one untagged legacy leg. */
const BODY = `## UAT Test Criteria

1. **Decompose** _(witness: machine)_: a criterion resolves to addressable ids.
2. **Human relay** _(witness: human)_: the owner tells the agent it works.
3. **Model judged** _(witness: model)_: a model attests structured judgment.
4. **Not yet migrated:** a legacy untagged criterion.
`;

// ── the three classified kinds ──────────────────────────────────────────────

test("classified-witness-enum: exactly three classified kinds — machine, model, human", () => {
  assert.deepEqual(CLASSIFIED_WITNESSES, ["machine", "model", "human"]);
});

test("classified-witness-enum: `model` is a distinct kind, not a spelling of `machine`", () => {
  assert.notEqual("model", "machine");
  assert.ok(ClassifiedWitness.safeParse("model").success, "model is a valid classified witness");
  assert.ok(ClassifiedWitness.safeParse("machine").success, "machine is a valid classified witness");
  assert.deepEqual(
    new Set(CLASSIFIED_WITNESSES).size,
    CLASSIFIED_WITNESSES.length,
    "no duplicate/aliased entries",
  );
});

test("classified-witness-enum: `either` is not a classified kind", () => {
  assert.equal(ClassifiedWitness.safeParse("either").success, false, "either is not classified");
  assert.ok(!(CLASSIFIED_WITNESSES as readonly string[]).includes("either"));
});

test("criterion-witness-enum: the full parseable set is machine|model|human|either", () => {
  assert.deepEqual(CRITERION_WITNESSES, ["machine", "model", "human", "either"]);
  for (const kind of CRITERION_WITNESSES) {
    assert.ok(CriterionWitness.safeParse(kind).success, `${kind} is a valid criterion witness`);
  }
});

// ── explicit classification (new / migrated criteria) ──────────────────────

test("explicit classification: a criterion tagged (witness: machine) classifies as machine", () => {
  const criteria = parseCriteria(STORY, BODY);
  assert.equal(criteria.length, 4);
  assert.equal(criteria[0]!.witness, "machine");
  assert.equal(isClassifiedWitness(criteria[0]!.witness), true);
});

test("explicit classification: a criterion tagged (witness: human) classifies as human", () => {
  const criteria = parseCriteria(STORY, BODY);
  assert.equal(criteria[1]!.witness, "human");
  assert.equal(isClassifiedWitness(criteria[1]!.witness), true);
});

test("explicit classification: a criterion tagged (witness: model) classifies as model, distinct from machine", () => {
  const criteria = parseCriteria(STORY, BODY);
  assert.equal(criteria[2]!.witness, "model");
  assert.notEqual(criteria[2]!.witness, "machine", "model must never collapse to machine");
  assert.equal(isClassifiedWitness(criteria[2]!.witness), true);
});

test("explicit classification: ids are positional <story>#uat-<n>, stable across re-parse", () => {
  const first = parseCriteria(STORY, BODY);
  const second = parseCriteria(STORY, BODY);
  assert.deepEqual(
    first.map((c) => c.id),
    ["demo-story#uat-1", "demo-story#uat-2", "demo-story#uat-3", "demo-story#uat-4"],
  );
  assert.deepEqual(first, second, "re-parsing the same body is deterministic");
});

test("criterionId is the single id-scheme home", () => {
  assert.equal(criterionId("s", 3), "s#uat-3");
});

// ── legacy compatibility without model default (ADR-0209 D8) ───────────────

test("legacy compatibility: an untagged criterion parses only to unresolved `either`", () => {
  const criteria = parseCriteria(STORY, BODY);
  assert.equal(criteria[3]!.witness, "either", "no witness tag → either, the conservative legacy default");
  assert.notEqual(criteria[3]!.witness, "model", "an untagged criterion must never default into model");
});

test("legacy compatibility: an unresolved `either` criterion is not classified", () => {
  const criteria = parseCriteria(STORY, BODY);
  assert.equal(isClassifiedWitness(criteria[3]!.witness), false, "either can never be treated as classified");
  assert.equal(isLegacyUnresolved(criteria[3]!.witness), true);
});

test("legacy compatibility: a classified leg is never reported as legacy-unresolved", () => {
  const criteria = parseCriteria(STORY, BODY);
  assert.equal(isLegacyUnresolved(criteria[0]!.witness), false, "machine");
  assert.equal(isLegacyUnresolved(criteria[1]!.witness), false, "human");
  assert.equal(isLegacyUnresolved(criteria[2]!.witness), false, "model");
});

test("legacy compatibility: a story with no UAT section yields [] (backward-compatible)", () => {
  assert.deepEqual(parseCriteria(STORY, "# Just a heading\n\nno uat here\n"), []);
});

test("legacy compatibility: the schema default for an omitted witness is `either`, never `model`", () => {
  const parsed = Criterion.parse({ id: "s#uat-1", title: "t" });
  assert.equal(parsed.witness, "either");
  assert.notEqual(parsed.witness, "model");
});

// ── explicit-but-invalid witness is refused, never defaulted ───────────────

test("invalid witness: an explicit but unknown prose tag is refused, not silently either", () => {
  const body = "## UAT Test Criteria\n\n1. **Bad** (witness: nobody): oops.\n";
  assert.throws(() => parseCriteria(STORY, body), /invalid witness/i, "refused at the parsing boundary");
});

test("invalid witness: the schema refuses an unknown witness value directly", () => {
  assert.throws(() => Criterion.parse({ id: "s#uat-1", title: "t", witness: "nobody" }));
});

test("invalid witness: the schema rejects unknown fields (strict)", () => {
  assert.throws(() => Criterion.parse({ id: "s#uat-1", title: "t", witness: "human", extra: 1 }));
});
