import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ScriptedModel } from "./model.js";
import type { ModelRequest, ModelResponse } from "./model.js";
import { runStep, runStepValidated } from "./step.js";

function req(): ModelRequest {
  return { model: "test", messages: [{ role: "user", content: "go" }] };
}

function text(t: string): ModelResponse {
  return { content: [{ type: "text", text: t }], stopReason: "end_turn" };
}

test("runStep: returns terminal text on success", async () => {
  const model = new ScriptedModel([text("hello")]);
  const result = await runStep({ model, request: req() });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.output, "hello");
});

test("runStep: empty terminal text is NoTerminalResult (never empty-but-ok)", async () => {
  const model = new ScriptedModel([text("   ")]);
  const result = await runStep({ model, request: req() });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "NoTerminalResult");
});

test("runStep: loop error surfaces as ModelError", async () => {
  // No-tool model that asks for a tool with no executor -> runTurn throws.
  const model = new ScriptedModel([
    { content: [{ type: "tool_use", id: "x", name: "n", input: {} }], stopReason: "tool_use" },
  ]);
  const result = await runStep({ model, request: req() });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "ModelError");
});

const Schema = z.object({ name: z.string(), count: z.number() });

test("runStepValidated: success on first try", async () => {
  const model = new ScriptedModel([text(JSON.stringify({ name: "a", count: 2 }))]);
  const result = await runStepValidated(Schema, { model, request: req() });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.structuredOutput, { name: "a", count: 2 });
  }
});

test("runStepValidated: strips a json code fence", async () => {
  const fenced = "```json\n{ \"name\": \"x\", \"count\": 1 }\n```";
  const model = new ScriptedModel([text(fenced)]);
  const result = await runStepValidated(Schema, { model, request: req() });
  assert.equal(result.ok, true);
});

test("runStepValidated: retries then succeeds", async () => {
  const model = new ScriptedModel([
    text("not json at all"),
    text(JSON.stringify({ name: "b", count: 5 })),
  ]);
  const result = await runStepValidated(Schema, { model, request: req() }, { maxRetries: 2 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.structuredOutput?.count, 5);
  // one initial + one retry consumed.
  assert.equal(model.calls, 2);
});

test("runStepValidated: validation miss (valid JSON, wrong shape) retries", async () => {
  const model = new ScriptedModel([
    text(JSON.stringify({ name: "b" })), // missing count
    text(JSON.stringify({ name: "b", count: 9 })),
  ]);
  const result = await runStepValidated(Schema, { model, request: req() });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.structuredOutput?.count, 9);
});

test("runStepValidated: exhausts retries -> ValidationFailed", async () => {
  const model = new ScriptedModel(() => text("never valid"));
  const result = await runStepValidated(Schema, { model, request: req() }, { maxRetries: 2 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "ValidationFailed");
  // 1 initial + 2 retries = 3 calls.
  assert.equal(model.calls, 3);
});
