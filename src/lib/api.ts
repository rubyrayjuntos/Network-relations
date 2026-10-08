import type { ContextInfo, GeneContextMeasurement } from './measurements';
import type { OmnipathInteraction } from './omnipath';
import { defaultPreferences, setting } from './settingsRegistry';

export { DEFAULT_SEEDS as INITIAL_SEEDS } from './settingsRegistry';

export type StringEdge = [string, string, number | null];
export type GraphData = { nodes: string[], edges: StringEdge[] };
export type StringFetch = { graph: GraphData; error: string | null };

export function stringCombinedScore(value: unknown): number | null {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 0) return null;
  const scaled = raw <= 1 ? raw * 1000 : raw;
  return Math.round(scaled);
}

export async function fetchStringNetwork(
  proteins: string[],
  limit: number = defaultPreferences().stringNetworkLimit,
  species: string = defaultPreferences().stringSpecies,
  requiredScore: number = defaultPreferences().stringRequiredScore
): Promise<StringFetch> {
  if (!proteins || proteins.length === 0) return { graph: { nodes: [], edges: [] }, error: null };
  const networkUrl = String(setting("source.string.networkUrl").default);
  try {
    const params = new URLSearchParams({
      identifiers: proteins.join(String(setting("source.string.identifierDelimiter").default)),
      species,
      required_score: String(requiredScore)
    });
    const res = await fetch(`${networkUrl}?${params}`);
    if (!res.ok) throw new Error(`STRING request failed (${res.status})`);
    const data = await res.json();
    const nodesSet = new Set<string>();
    const edges: StringEdge[] = [];
    data.forEach((row: any) => {
      const u = row.preferredName_A;
      const v = row.preferredName_B;
      if (u && v) {
        nodesSet.add(u);
        nodesSet.add(v);
        edges.push([u, v, stringCombinedScore(row.score)]);
      }
    });
    let nodes = Array.from(nodesSet);
    if (nodes.length > limit) {
      const degrees: Record<string, number> = {};
      nodes.forEach(n => degrees[n] = 0);
      edges.forEach(([u, v]) => { degrees[u] = (degrees[u] ?? 0) + 1; degrees[v] = (degrees[v] ?? 0) + 1; });
      nodes.sort((a, b) => degrees[b] - degrees[a]);
      nodes = nodes.slice(0, limit);
      const topNodesSet = new Set(nodes);
      return { graph: { nodes, edges: edges.filter(([u, v]) => topNodesSet.has(u) && topNodesSet.has(v)) }, error: null };
    }
    return { graph: { nodes, edges }, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "STRING request failed";
    return { graph: { nodes: proteins.slice(0, limit), edges: [] }, error: message };
  }
}

export async function fetchInteractors(
  protein: string,
  limit: number = defaultPreferences().stringPartnerLimit,
  species: string = defaultPreferences().stringSpecies,
  requiredScore: number = defaultPreferences().stringPartnerScore
): Promise<StringFetch> {
  const partnersUrl = String(setting("source.string.partnersUrl").default);
  try {
    const params = new URLSearchParams({
      identifiers: protein,
      species,
      limit: limit.toString(),
      required_score: String(requiredScore)
    });
    const res = await fetch(`${partnersUrl}?${params}`);
    if (!res.ok) throw new Error(`STRING request failed (${res.status})`);
    const data = await res.json();
    const nodesSet = new Set<string>([protein]);
    const edges: StringEdge[] = [];
    data.forEach((row: any) => {
      const u = row.preferredName_A;
      const v = row.preferredName_B;
      if (u && v) {
        nodesSet.add(u);
        nodesSet.add(v);
        edges.push([u, v, stringCombinedScore(row.score)]);
      }
    });
    return { graph: { nodes: Array.from(nodesSet), edges }, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "STRING request failed";
    return { graph: { nodes: [protein], edges: [] }, error: message };
  }
}

export type { OmnipathInteraction } from './omnipath';

export type OmnipathFetchResult =
  | { ok: true; datasets: string[]; interactions: OmnipathInteraction[] }
  | { ok: false; error: string };

export async function fetchOmnipathInteractions(proteins: string[], datasets: string[]): Promise<OmnipathFetchResult> {
  if (datasets.length === 0) return { ok: true, datasets: [], interactions: [] };
  if (!proteins || proteins.length === 0) return { ok: false, error: "partners is required" };
  try {
    const params = new URLSearchParams({ partners: proteins.join(","), datasets: datasets.join(",") });
    const res = await fetch(`${setting("source.omnipath.proxyPath").default}?${params}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body.error || `OmniPath proxy failed (${res.status})` };
    }
    return { ok: true, datasets: body.datasets ?? [], interactions: body.interactions ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "OmniPath proxy failed" };
  }
}

export async function fetchContexts(): Promise<{ release: string; contexts: ContextInfo[] } | { error: string }> {
  const res = await fetch("/api/contexts");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body.error || "DepMap contexts are unavailable" };
  return body;
}

export async function fetchMeasurements(genes: string[], context: string): Promise<{
  release: string;
  context: ContextInfo;
  genes: Record<string, GeneContextMeasurement | null>;
} | { error: string }> {
  const params = new URLSearchParams({ genes: genes.join(","), context });
  const res = await fetch(`/api/measurements?${params}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body.error || "DepMap measurements are unavailable" };
  return body;
}

import { 
  CURATED_CANCER_GENES, 
  generateFallbackGeneData, 
  CuratedGeneData, 
  BindingSiteInfo, 
  DruggabilityInfo, 
  DepMapInfo 
} from './cancerData';

export type { BindingSiteInfo, DruggabilityInfo, DepMapInfo, CuratedGeneData };

export type ProteinDetails = {
  symbol: string;
  name: string;
  summary: string;
  go?: {
    BP?: { term: string }[];
    CC?: { term: string }[];
    MF?: { term: string }[];
  };
  disease?: { term: string }[];
  inferredRole: "oncogene" | "tumor_suppressor" | "dual_role" | "essential_regulator" | "unknown";
  roleDescription?: string;
  druggable: boolean;
  druggabilityDetails?: DruggabilityInfo;
  depMap?: DepMapInfo;
  bindingSites?: BindingSiteInfo[];
  pathways?: string[];
  mygeneError?: boolean;
};

function uncuratedDetails(symbol: string, hit?: any): ProteinDetails {
  const fallback = generateFallbackGeneData(symbol, hit);
  return {
    symbol,
    name: hit?.name || fallback.name,
    summary: hit?.summary || "",
    go: hit?.go,
    disease: hit?.disease,
    inferredRole: fallback.role,
    druggable: false,
    pathways: fallback.pathways,
  };
}

function curatedFailure(symbol: string, curated: CuratedGeneData): ProteinDetails {
  return {
    symbol,
    name: curated.name,
    summary: "",
    inferredRole: "unknown",
    roleDescription: curated.roleDescription,
    druggable: curated.druggability.isDruggable,
    druggabilityDetails: curated.druggability,
    bindingSites: curated.bindingSites,
    pathways: curated.pathways,
    mygeneError: true,
  };
}

export async function fetchProteinDetails(symbol: string, fields: string[] = defaultPreferences().mygeneFields): Promise<ProteinDetails | null> {
  const upperSymbol = symbol.toUpperCase().trim();
  const curated = CURATED_CANCER_GENES[upperSymbol];

  try {
    const res = await fetch(`${setting("source.mygene.url").default}?q=symbol:${upperSymbol}&species=${setting("source.mygene.species").default}&fields=${fields.join(",")}`);
    let hit: any = null;
    if (!res.ok) {
      return curated ? curatedFailure(upperSymbol, curated) : { ...uncuratedDetails(upperSymbol), mygeneError: true, inferredRole: "unknown" as const, druggable: false, summary: "" };
    }
    const data = await res.json();
    if (data.hits && data.hits.length > 0) {
      hit = data.hits[0];
    }

    if (curated) {
      // Merge curated with live MyGene GO/disease terms
      const details: ProteinDetails = {
        symbol: upperSymbol,
        name: hit?.name || curated.name,
        summary: hit?.summary || curated.roleDescription,
        go: hit?.go,
        disease: hit?.disease,
        inferredRole: curated.role,
        roleDescription: curated.roleDescription,
        druggable: curated.druggability.isDruggable,
        druggabilityDetails: curated.druggability,
        bindingSites: curated.bindingSites,
        pathways: curated.pathways,
      };
      return details;
    }

    if (hit) {
      return uncuratedDetails(upperSymbol, hit);
    }

    return uncuratedDetails(upperSymbol);
  } catch (e) {
    console.error("MyGene error:", e);
    if (curated) return curatedFailure(upperSymbol, curated);
    return { ...uncuratedDetails(upperSymbol), mygeneError: true, inferredRole: "unknown" as const, druggable: false, summary: "" };
  }
}
