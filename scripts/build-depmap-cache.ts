import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { buildMeasurementCache } from "../src/lib/measurements";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const release = process.env.DEPMAP_RELEASE;
if (!release) {
  console.error("DEPMAP_RELEASE is required. Set it to the DepMap release id for the files in data/depmap/.");
  process.exit(1);
}

const root = process.cwd();
const sourceFiles = {
  models: path.join(root, "data/depmap/Model.csv"),
  chronos: path.join(root, "data/depmap/CRISPRGeneEffect.csv"),
  expression: path.join(root, "data/depmap/OmicsExpressionProteinCodingGenesTPMLogp1.csv"),
};

const [modelsCsv, chronosCsv, expressionCsv] = await Promise.all([
  fs.readFile(sourceFiles.models, "utf8"),
  fs.readFile(sourceFiles.chronos, "utf8"),
  fs.readFile(sourceFiles.expression, "utf8"),
]);

const cache = buildMeasurementCache({
  release,
  sourceFiles: {
    models: "data/depmap/Model.csv",
    chronos: "data/depmap/CRISPRGeneEffect.csv",
    expression: "data/depmap/OmicsExpressionProteinCodingGenesTPMLogp1.csv",
  },
  modelsCsv,
  chronosCsv,
  expressionCsv,
});

const outDir = path.join(root, "data/cache");
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "measurements.json");
await fs.writeFile(outPath, JSON.stringify(cache));
console.log(`Wrote ${outPath} for DepMap ${release} (${Object.keys(cache.genes).length} genes, ${cache.contexts.length} contexts).`);
