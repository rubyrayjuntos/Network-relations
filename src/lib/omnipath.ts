import { OMNIPATH_DATASET_ALLOWLIST, setting } from "./settingsRegistry";

export const OMNIPATH_DATASETS = [...OMNIPATH_DATASET_ALLOWLIST];

export type OmnipathInteraction = {
  source: string;
  target: string;
  is_stimulation: boolean;
  is_inhibition: boolean;
};

export function filterOmnipathRows(rows: any[], partners: string[]): OmnipathInteraction[] {
  const proteinSet = new Set(partners.map(partner => partner.trim().toUpperCase()).filter(Boolean));
  const filtered: OmnipathInteraction[] = [];
  for (const row of rows) {
    const source = typeof row?.source_genesymbol === "string" ? row.source_genesymbol.toUpperCase() : "";
    const target = typeof row?.target_genesymbol === "string" ? row.target_genesymbol.toUpperCase() : "";
    if (!source || !target || !proteinSet.has(source) || !proteinSet.has(target)) continue;
    filtered.push({
      source,
      target,
      is_stimulation: row.is_stimulation === true || row.consensus_stimulation === true,
      is_inhibition: row.is_inhibition === true || row.consensus_inhibition === true,
    });
  }
  return filtered;
}

export async function fetchOmnipathUpstream(
  partners: string[],
  fetchImpl: typeof fetch = fetch,
  datasets: readonly string[] = OMNIPATH_DATASETS
): Promise<{ datasets: string[]; interactions: OmnipathInteraction[] }> {
  const params = new URLSearchParams({
    genesymbols: String(setting("source.omnipath.genesymbols").default),
    format: String(setting("source.omnipath.format").default),
    partners: partners.join(","),
    datasets: datasets.join(","),
  });
  const response = await fetchImpl(`${setting("source.omnipath.host").default}?${params}`);
  if (!response.ok) {
    throw new Error(`OmniPath upstream failed (${response.status})`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("OmniPath upstream returned an unexpected payload");
  }
  return {
    datasets: [...datasets],
    interactions: filterOmnipathRows(rows, partners),
  };
}
