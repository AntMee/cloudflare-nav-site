import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettingsPayload } from "../src/worker/index.js";

test("normalizes background blur percent within 0 to 100", () => {
  assert.equal(normalizeSettingsPayload({ backgroundBlur: 35 }).backgroundBlur, 35);
  assert.equal(normalizeSettingsPayload({ backgroundBlur: -10 }).backgroundBlur, 0);
  assert.equal(normalizeSettingsPayload({ backgroundBlur: 150 }).backgroundBlur, 100);
  assert.equal(normalizeSettingsPayload({}).backgroundBlur, 0);
});
