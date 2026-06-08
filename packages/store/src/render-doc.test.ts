import test from "node:test";
import assert from "node:assert/strict";
import type { StoredDoc } from "@storytree/core";
import { renderBody } from "@storytree/core";
import { renderStoredDoc } from "./render-doc.js";

/**
 * Offline + pure: renderStoredDoc maps a StoredDoc into the GuidanceAsset wire shape. Two paths:
 * a structured Knowledge unit (body DERIVED via renderBody, category = kind) and a body-bearing
 * asset/template (body passed THROUGH, category = the doc's own).
 */

test("renderStoredDoc derives the body of a structured principle (category = kind)", () => {
  const principle = {
    kind: "principle",
    id: "less-is-more",
    title: "Less is more",
    description: "prefer the smaller surface",
    references: ["doc:decisions/0017-...md"],
    statement: "Prefer the smaller surface.",
    why: "Smaller surfaces are easier to prove.",
    howToApply: "Ask: can this be removed?",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  };
  const stored: StoredDoc = {
    id: "less-is-more",
    kind: "principle",
    doc: principle,
    createdAt: "2026-06-02T00:00:00Z",
    updatedAt: "2026-06-03T00:00:00Z",
  };

  const rendered = renderStoredDoc(stored);

  assert.equal(rendered.id, "less-is-more");
  assert.equal(rendered.category, "principle", "category is the stored kind");
  assert.equal(rendered.title, "Less is more");
  assert.equal(rendered.description, "prefer the smaller surface");
  assert.deepEqual(rendered.references, ["doc:decisions/0017-...md"]);
  // Body is derived, byte-for-byte, from the structured fields.
  assert.equal(rendered.body, renderBody(principle as never));
  assert.match(rendered.body, /\*\*The principle\.\*\* Prefer the smaller surface\./);
  assert.match(rendered.body, /## Why/);
  // Timestamps come from the StoredDoc envelope, not the inner doc.
  assert.equal(rendered.createdAt, "2026-06-02T00:00:00Z");
  assert.equal(rendered.updatedAt, "2026-06-03T00:00:00Z");
});

test("renderStoredDoc passes through a template's string body (category from the doc)", () => {
  const template = {
    id: "template-principle",
    category: "template",
    title: "Template · principle",
    description: "the shape a principle conforms to",
    body: "**The principle.** _The judgement rule, in one sentence._",
    references: [],
  };
  const stored: StoredDoc = {
    id: "template-principle",
    kind: "template",
    doc: template,
    createdAt: "2026-06-02T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
  };

  const rendered = renderStoredDoc(stored);

  assert.equal(rendered.category, "template", "category from the doc, not derived");
  assert.equal(rendered.body, template.body, "string body passed through verbatim");
  assert.equal(rendered.title, "Template · principle");
  assert.deepEqual(rendered.references, []);
});

test("renderStoredDoc on an edited asset (body present, non-template category) passes through", () => {
  // A structured unit the studio edited and re-stored in rendered form keeps its own category.
  const edited = {
    id: "owned-loop",
    category: "definition",
    title: "Owned loop",
    description: "the agent loop we own",
    body: "**In one line.** Ours, end to end.",
    references: ["doc:decisions/0019-...md"],
  };
  const stored: StoredDoc = {
    id: "owned-loop",
    kind: "definition",
    doc: edited,
    createdAt: "2026-06-02T00:00:00Z",
    updatedAt: "2026-06-05T00:00:00Z",
  };

  const rendered = renderStoredDoc(stored);
  assert.equal(rendered.category, "definition");
  assert.equal(rendered.body, edited.body);
  assert.equal(rendered.updatedAt, "2026-06-05T00:00:00Z");
});

test("renderStoredDoc falls back to the stored kind when a body doc omits category", () => {
  const stored: StoredDoc = {
    id: "x",
    kind: "pattern",
    doc: { id: "x", title: "T", description: "d", body: "b" },
    createdAt: "2026-06-02T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
  };
  const rendered = renderStoredDoc(stored);
  assert.equal(rendered.category, "pattern");
});
