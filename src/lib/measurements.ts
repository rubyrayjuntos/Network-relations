import { setting } from "./settingsRegistry";

export const PAN_CANCER_ID = String(setting("source.depmap.panCancerId").default);
export const PAN_CANCER_LABEL = String(setting("source.depmap.panCancerLabel").default);

export type GeneContextMeasurement = {
  chronosMean: number | null;
  chronosN: number;
  exprMean: number | null;
  exprN: number;
};

export type ContextInfo = {
  id: string;
  label: string;
};

export type MeasurementCache = {
  release: string;
  sourceFiles: {
    models: string;
    chronos: string;
    expression: string;
  };
  contexts: ContextInfo[];
  genes: Record<string, Record<string, GeneContextMeasurement>>;
};

export class MeasurementSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementSchemaError";
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function geneSymbolFromHeader(header: string): string | null {
  const trimmed = header.trim();
  if (!trimmed || /^(modelid|model_id)$/i.test(trimmed)) return null;
  const match = trimmed.match(new RegExp(String(setting("source.depmap.geneHeaderPattern").default)));
  return match ? match[1].toUpperCase() : null;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === "NA" || trimmed.toUpperCase() === "NAN") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function meanOf(values: number[]): { mean: number | null; n: number } {
  if (values.length === 0) return { mean: null, n: 0 };
  const sum = values.reduce((total, value) => total + value, 0);
  return { mean: sum / values.length, n: values.length };
}

type SymbolValues = Map<string, Map<string, number>>;

function indexMatrix(rows: string[][], label: string): SymbolValues {
  if (rows.length === 0) {
    throw new MeasurementSchemaError(`Missing column: gene symbol (${label})`);
  }
  const header = rows[0];
  const columns: { symbol: string; index: number }[] = [];
  header.forEach((cell, index) => {
    if (index === 0 && geneSymbolFromHeader(cell) === null) return;
    const symbol = geneSymbolFromHeader(cell);
    if (symbol) columns.push({ symbol, index });
  });
  if (columns.length === 0) {
    throw new MeasurementSchemaError(`Missing column: gene symbol (${label})`);
  }

  const bySymbol: SymbolValues = new Map();
  for (const row of rows.slice(1)) {
    const modelId = row[0]?.trim();
    if (!modelId) continue;
    const buckets = new Map<string, number[]>();
    for (const column of columns) {
      const value = parseNumber(row[column.index]);
      if (value === null) continue;
      const list = buckets.get(column.symbol) ?? [];
      list.push(value);
      buckets.set(column.symbol, list);
    }
    for (const [symbol, list] of buckets) {
      const averaged = list.reduce((total, value) => total + value, 0) / list.length;
      let models = bySymbol.get(symbol);
      if (!models) {
        models = new Map();
        bySymbol.set(symbol, models);
      }
      models.set(modelId, averaged);
    }
  }
  return bySymbol;
}

function valuesForContext(
  values: Map<string, number> | undefined,
  lineage: string | null,
  lineageByModel: Map<string, string>
): number[] {
  if (!values) return [];
  const selected: number[] = [];
  for (const [modelId, value] of values) {
    if (lineage !== null && lineageByModel.get(modelId) !== lineage) continue;
    selected.push(value);
  }
  return selected;
}

function measureContext(
  chronos: Map<string, number> | undefined,
  expression: Map<string, number> | undefined,
  lineage: string | null,
  lineageByModel: Map<string, string>
): GeneContextMeasurement {
  const chronosStats = meanOf(valuesForContext(chronos, lineage, lineageByModel));
  const exprStats = meanOf(valuesForContext(expression, lineage, lineageByModel));
  return {
    chronosMean: chronosStats.mean,
    chronosN: chronosStats.n,
    exprMean: exprStats.mean,
    exprN: exprStats.n,
  };
}

export function buildMeasurementCache(input: {
  release: string;
  sourceFiles: MeasurementCache["sourceFiles"];
  modelsCsv: string;
  chronosCsv: string;
  expressionCsv: string;
}): MeasurementCache {
  const modelRows = parseCsv(input.modelsCsv);
  const header = modelRows[0]?.map(cell => cell.trim()) ?? [];
  const idIdx = header.findIndex(cell => cell === "ModelID");
  const lineageIdx = header.findIndex(cell => cell === "OncotreeLineage");
  if (idIdx < 0) throw new MeasurementSchemaError("Missing column: ModelID");
  if (lineageIdx < 0) throw new MeasurementSchemaError("Missing column: OncotreeLineage");

  const lineageByModel = new Map<string, string>();
  for (const row of modelRows.slice(1)) {
    const modelId = row[idIdx]?.trim();
    if (!modelId) continue;
    lineageByModel.set(modelId, (row[lineageIdx] ?? "").trim());
  }

  const chronos = indexMatrix(parseCsv(input.chronosCsv), "CRISPR gene effect");
  const expression = indexMatrix(parseCsv(input.expressionCsv), "expression");
  const symbols = new Set<string>([...chronos.keys(), ...expression.keys()]);
  const lineages = [...new Set([...lineageByModel.values()].filter(Boolean))].sort();

  const genes: MeasurementCache["genes"] = {};
  for (const symbol of symbols) {
    const contexts: Record<string, GeneContextMeasurement> = {
      [PAN_CANCER_ID]: measureContext(chronos.get(symbol), expression.get(symbol), null, lineageByModel),
    };
    for (const lineage of lineages) {
      contexts[lineage] = measureContext(chronos.get(symbol), expression.get(symbol), lineage, lineageByModel);
    }
    genes[symbol] = contexts;
  }

  return {
    release: input.release,
    sourceFiles: input.sourceFiles,
    contexts: [
      { id: PAN_CANCER_ID, label: PAN_CANCER_LABEL },
      ...lineages.map(lineage => ({ id: lineage, label: lineage })),
    ],
    genes,
  };
}

export function queryMeasurements(cache: MeasurementCache, genes: string[], contextId: string) {
  const context = cache.contexts.find(item => item.id === contextId);
  if (!context) throw new MeasurementSchemaError(`Unknown context: ${contextId}`);

  const result: Record<string, GeneContextMeasurement | null> = {};
  for (const gene of genes) {
    const symbol = gene.trim().toUpperCase();
    if (!symbol) continue;
    result[symbol] = cache.genes[symbol]?.[contextId] ?? null;
  }
  return {
    release: cache.release,
    context,
    genes: result,
  };
}
