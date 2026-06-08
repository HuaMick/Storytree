import test from "node:test";
import assert from "node:assert/strict";
import { ScriptedModel, AnthropicModel } from "./model.js";
import type { ModelResponse } from "./model.js";

test("ScriptedModel returns scripted responses in order", async () => {
  const a: ModelResponse = { content: [{ type: "text", text: "a" }], stopReason: "end_turn" };
  const b: ModelResponse = { content: [{ type: "text", text: "b" }], stopReason: "end_turn" };
  const model = new ScriptedModel([a, b]);
  assert.equal((await model.createMessage({ model: "m", messages: [] })).content[0]?.type, "text");
  assert.equal(model.calls, 1);
  const second = await model.createMessage({ model: "m", messages: [] });
  assert.equal(second.content[0]?.type === "text" && second.content[0].text, "b");
});

test("ScriptedModel exhaustion rejects loudly", async () => {
  const model = new ScriptedModel([]);
  await assert.rejects(() => model.createMessage({ model: "m", messages: [] }), /exhausted/);
});

test("ScriptedModel supports a function script", async () => {
  const model = new ScriptedModel((req, i) => ({
    content: [{ type: "text", text: `${req.model}:${i}` }],
    stopReason: "end_turn",
  }));
  const r = await model.createMessage({ model: "fn", messages: [] });
  assert.equal(r.content[0]?.type === "text" && r.content[0].text, "fn:0");
});

test("AnthropicModel is constructible (never exercised offline)", () => {
  const model = new AnthropicModel({ apiKey: "sk-test-not-used" });
  assert.ok(model);
  assert.equal(typeof model.createMessage, "function");
});
