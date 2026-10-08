import assert from "node:assert/strict";
import test from "node:test";
import { buildViewExport } from "../src/lib/exportView.ts";

test("view export cites provenance and omits synthetic or curated Chronos fields", () => {
  const exported = buildViewExport({
    generatedAt: "2026-10-08T00:00:00.000Z",
    context: { id: "Lung", label: "Lung" },
    depmapRelease: "fixture-release",
    nodes: ["KRAS", "GAPDH"],
    measurements: {
      KRAS: { chronosMean: -1, chronosN: 2, exprMean: 3, exprN: 2 },
      GAPDH: null,
    },
    edges: [{ source: "KRAS", target: "RAF1", stringScore: 900, pathway: "RAS_MAPK" }],
    omnipathInteractions: [{
      source: "KRAS",
      target: "RAF1",
      is_stimulation: true,
      is_inhibition: false,
    }],
    omnipathError: null,
  });

  assert.equal(exported.depmapRelease, "fixture-release");
  assert.equal(exported.context.label, "Lung");
  assert.equal(exported.string.species, "9606");
  assert.equal(exported.string.requiredScore, 700);
  assert.equal(exported.omnipath.signedEdgeCount, 1);
  assert.deepEqual(Object.keys(exported.nodes[0]).sort(), [
    "chronosMean",
    "chronosN",
    "exprMean",
    "exprN",
    "symbol",
  ]);
  assert.equal(exported.nodes[1].chronosMean, null);
  const serialized = JSON.stringify(exported);
  assert.equal(serialized.includes("syntheticExpressionLevel"), false);
  assert.equal(serialized.includes("depMap"), false);
  assert.equal(serialized.includes("RNA"), false);
});
