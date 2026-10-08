import type { OmnipathInteraction } from "./omnipath";
import type { GeneContextMeasurement } from "./measurements";
import { defaultPreferences, type Preferences } from "./settingsRegistry";

export const STRING_SPECIES = defaultPreferences().stringSpecies;
export const STRING_REQUIRED_SCORE = defaultPreferences().stringRequiredScore;

export type ViewNode = {
  symbol: string;
  chronosMean: number | null;
  chronosN: number;
  exprMean: number | null;
  exprN: number;
};

export type ViewEdge = {
  source: string;
  target: string;
  stringScore: number | null;
  pathway: string;
  omnipath: { is_stimulation: boolean; is_inhibition: boolean }[];
};

export type ViewExport = {
  generatedAt: string;
  context: { id: string; label: string };
  depmapRelease: string | null;
  visualMode: Preferences["visualMode"];
  string: {
    species: string;
    requiredScore: number;
    partnerScore: number;
    networkLimit: number;
    partnerLimit: number;
    expandLimit: number;
    scoreScale: { min: number; max: number };
    initialSeeds: Record<string, string[]>;
  };
  omnipath: { datasets: string[]; signedEdgeCount: number; error: string | null };
  fallbacks: Record<string, string>;
  nodes: ViewNode[];
  edges: ViewEdge[];
};

const emptyMeasurement = {
  chronosMean: null,
  chronosN: 0,
  exprMean: null,
  exprN: 0,
};

export function signsForEdge(source: string, target: string, interactions: OmnipathInteraction[]) {
  return interactions
    .filter(interaction =>
      (interaction.source === source && interaction.target === target) ||
      (interaction.source === target && interaction.target === source)
    )
    .map(interaction => ({
      is_stimulation: interaction.is_stimulation,
      is_inhibition: interaction.is_inhibition,
    }));
}

export function buildViewExport(input: {
  generatedAt: string;
  context: { id: string; label: string };
  depmapRelease: string | null;
  nodes: string[];
  measurements: Record<string, GeneContextMeasurement | null | undefined>;
  edges: { source: string; target: string; stringScore: number | null; pathway: string }[];
  omnipathInteractions: OmnipathInteraction[];
  omnipathError: string | null;
  snapshot?: Preferences;
}): ViewExport {
  const prefs = input.snapshot ?? defaultPreferences();
  const edges = input.edges.map(edge => ({
    ...edge,
    stringScore: edge.stringScore,
    omnipath: signsForEdge(edge.source, edge.target, input.omnipathInteractions),
  }));
  const fallbacks: Record<string, string> = {};
  if (prefs.fallbackStringError !== "seeds-no-edges") fallbacks["fallback.string.error"] = prefs.fallbackStringError;
  if (prefs.fallbackRoleUncached !== "hash") fallbacks["fallback.role.uncached"] = prefs.fallbackRoleUncached;
  return {
    generatedAt: input.generatedAt,
    context: input.context,
    depmapRelease: input.depmapRelease,
    visualMode: prefs.visualMode,
    string: {
      species: prefs.stringSpecies,
      requiredScore: prefs.stringRequiredScore,
      partnerScore: prefs.stringPartnerScore,
      networkLimit: prefs.stringNetworkLimit,
      partnerLimit: prefs.stringPartnerLimit,
      expandLimit: prefs.stringExpandLimit,
      scoreScale: { min: 0, max: 1000 },
      initialSeeds: prefs.initialSeeds,
    },
    omnipath: {
      datasets: [...prefs.omnipathDatasets],
      signedEdgeCount: edges.filter(edge => edge.omnipath.length > 0).length,
      error: prefs.omnipathDatasets.length === 0 ? null : input.omnipathError,
    },
    fallbacks,
    nodes: input.nodes.map(symbol => {
    const measurement = input.measurements[symbol] ?? input.measurements[symbol.toUpperCase()] ?? emptyMeasurement;
      return {
        symbol,
        chronosMean: measurement?.chronosMean ?? null,
        chronosN: measurement?.chronosN ?? 0,
        exprMean: measurement?.exprMean ?? null,
        exprN: measurement?.exprN ?? 0,
      };
    }),
    edges,
  };
}
