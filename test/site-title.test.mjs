import assert from "node:assert/strict";
import test from "node:test";
import { resolveSiteTitle } from "../src/app/siteTitle.js";

test("uses configured site title for browser title", () => {
  assert.equal(resolveSiteTitle("平平无奇的导航站"), "平平无奇的导航站");
});

test("falls back to default site title when configured title is blank", () => {
  assert.equal(resolveSiteTitle("   "), "CloudNav");
  assert.equal(resolveSiteTitle(null), "CloudNav");
});
