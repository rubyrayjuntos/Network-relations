import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";
import { PAN_CANCER_ID, buildMeasurementCache } from "../src/lib/measurements.ts";
import { mountScienceRoutes } from "../src/lib/scienceRoutes.ts";

const cache = buildMeasurementCache({
  release: "fixture-release",
  sourceFiles: {
    models: "Model.csv",
    chronos: "CRISPRGeneEffect.csv",
    expression: "expression.csv",
  },
  modelsCsv: "ModelID,OncotreeLineage\nACH-1,Lung\n",
  chronosCsv: "ModelID,KRAS (3845)\nACH-1,-1.2\n",
  expressionCsv: "ModelID,KRAS (3845)\nACH-1,4\n",
});

async function withServer(fetchImpl: typeof fetch | undefined, run: (base: string) => Promise<void>) {
  const app = express();
  mountScienceRoutes(app, cache, fetchImpl);
  const server: Server = await new Promise(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("measurements cite the fixture release and a missing gene is null", async () => {
  await withServer(undefined, async base => {
    const response = await fetch(`${base}/api/measurements?genes=KRAS,NOT_IN_RELEASE&context=${PAN_CANCER_ID}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.release, "fixture-release");
    assert.equal(body.genes.KRAS.chronosMean, -1.2);
    assert.equal(body.genes.NOT_IN_RELEASE, null);
  });
});

test("the OmniPath route uses the server fetch and returns the upstream error", async () => {
  const calls: string[] = [];
  const mockFetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify([
      { source_genesymbol: "KRAS", target_genesymbol: "RAF1", is_stimulation: true, is_inhibition: false },
    ]), { status: 200 });
  }) as typeof fetch;

  await withServer(mockFetch, async base => {
    const response = await fetch(`${base}/api/omnipath?partners=KRAS,RAF1`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.interactions.length, 1);
    assert.match(calls[0], /^https:\/\/omnipathdb\.org\/interactions\?/);
  });
});
