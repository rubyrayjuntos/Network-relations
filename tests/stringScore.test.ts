import assert from "node:assert/strict";
import test from "node:test";
import { stringCombinedScore } from "../src/lib/api.ts";

test("STRING combined scores are stored on the 0 to 1000 scale", () => {
  assert.equal(stringCombinedScore(0.999), 999);
  assert.equal(stringCombinedScore(0.7), 700);
  assert.equal(stringCombinedScore(812), 812);
  assert.equal(stringCombinedScore("nope"), null);
});
