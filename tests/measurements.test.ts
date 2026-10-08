import assert from "node:assert/strict";
import test from "node:test";
import {
  MeasurementSchemaError,
  PAN_CANCER_ID,
  buildMeasurementCache,
  queryMeasurements,
} from "../src/lib/measurements.ts";

const modelsCsv = `ModelID,OncotreeLineage,OncotreePrimaryDisease
ACH-1,Lung,NSCLC
ACH-2,Lung,NSCLC
ACH-3,Breast,BRCA
ACH-4,Breast,BRCA
`;

const chronosCsv = `ModelID,KRAS (3845),TP53 (7157),GAPDH (2597),MISSING (1)
ACH-1,-1.2,-0.2,0.1,
ACH-2,-0.8,-0.4,0.3,0.5
ACH-3,-0.2,0.1,-0.1,
ACH-4,0.0,0.3,,
`;

const expressionCsv = `ModelID,KRAS (3845),EGFR (1956)
ACH-1,2,1
ACH-2,4,
ACH-3,6,3
ACH-4,8,
`;

const sourceFiles = {
  models: "data/depmap/Model.csv",
  chronos: "data/depmap/CRISPRGeneEffect.csv",
  expression: "data/depmap/OmicsExpressionProteinCodingGenesTPMLogp1.csv",
};

function cache() {
  return buildMeasurementCache({
    release: "fixture-release",
    sourceFiles,
    modelsCsv,
    chronosCsv,
    expressionCsv,
  });
}

test("lineage means match the cell-line arithmetic mean", () => {
  const built = cache();
  const krasLung = built.genes.KRAS.Lung;
  const krasBreast = built.genes.KRAS.Breast;
  const krasPan = built.genes.KRAS[PAN_CANCER_ID];
  assert.equal(krasLung.chronosN, 2);
  assert.equal(krasLung.chronosMean, -1);
  assert.equal(krasBreast.chronosMean, -0.1);
  assert.equal(krasPan.chronosN, 4);
  assert.equal(krasPan.chronosMean, -0.55);
  assert.equal(krasPan.exprMean, 5);
  assert.equal(krasPan.exprN, 4);
  assert.ok(Math.abs(built.genes.TP53.Lung.chronosMean! + 0.3) < 1e-12);
  assert.equal(built.genes.GAPDH.Breast.chronosN, 1);
  assert.equal(built.genes.GAPDH.Breast.chronosMean, -0.1);
  assert.equal(built.genes.GAPDH[PAN_CANCER_ID].chronosN, 3);
  assert.ok(Math.abs((built.genes.GAPDH[PAN_CANCER_ID].chronosMean ?? 0) - 0.1) < 1e-12);
  assert.equal(built.genes.MISSING.Breast.chronosMean, null);
  assert.equal(built.genes.MISSING.Breast.chronosN, 0);
  assert.equal(built.genes.EGFR[PAN_CANCER_ID].chronosMean, null);
  assert.equal(built.genes.EGFR[PAN_CANCER_ID].exprMean, 2);
  assert.equal(built.genes.EGFR.Lung.exprN, 1);
});

test("pan-cancer is the mean across cell lines, not the mean of lineage means", () => {
  const uneven = buildMeasurementCache({
    release: "fixture-release",
    sourceFiles,
    modelsCsv: `ModelID,OncotreeLineage
ACH-1,Lung
ACH-2,Lung
ACH-3,Lung
ACH-4,Breast
`,
    chronosCsv: `ModelID,KRAS (3845)
ACH-1,-1
ACH-2,-1
ACH-3,-1
ACH-4,0
`,
    expressionCsv: `ModelID,KRAS (3845)
ACH-1,1
ACH-2,1
ACH-3,1
ACH-4,1
`,
  });
  const pan = uneven.genes.KRAS[PAN_CANCER_ID].chronosMean;
  const lung = uneven.genes.KRAS.Lung.chronosMean ?? 0;
  const breast = uneven.genes.KRAS.Breast.chronosMean ?? 0;
  assert.equal(pan, -0.75);
  assert.notEqual(pan, (lung + breast) / 2);
});

test("a gene absent from the cache is null and the release is cited", () => {
  const response = queryMeasurements(cache(), ["KRAS", "NOT_IN_RELEASE"], PAN_CANCER_ID);
  assert.equal(response.release, "fixture-release");
  assert.equal(response.context.label, "Pan-cancer (all profiled cell lines)");
  assert.equal(response.genes.KRAS?.chronosMean, -0.55);
  assert.equal(response.genes.NOT_IN_RELEASE, null);
});

test("missing OncotreeLineage is a named schema error", () => {
  assert.throws(
    () => buildMeasurementCache({
      release: "fixture-release",
      sourceFiles,
      modelsCsv: "ModelID,Disease\nACH-1,Lung\n",
      chronosCsv,
      expressionCsv,
    }),
    (error: unknown) => error instanceof MeasurementSchemaError && error.message === "Missing column: OncotreeLineage"
  );
});

test("a matrix without gene symbols is a named schema error", () => {
  assert.throws(
    () => buildMeasurementCache({
      release: "fixture-release",
      sourceFiles,
      modelsCsv,
      chronosCsv: "ModelID\nACH-1\n",
      expressionCsv,
    }),
    (error: unknown) => error instanceof MeasurementSchemaError && error.message.includes("gene symbol")
  );
});
