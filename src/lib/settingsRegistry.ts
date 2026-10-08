export const GROUP_ORDER = ["Sources", "Local fallbacks", "Display", "View", "Operator"] as const;

export type SettingGroup = (typeof GROUP_ORDER)[number];
export type SettingKind = "source" | "display" | "view" | "fallback-policy" | "operator";
export type SettingCommit = "apply" | "immediate" | "readonly";
export type SettingControl =
  | "none"
  | "text"
  | "number"
  | "boolean"
  | "enum"
  | "color"
  | "color-list"
  | "dataset-set"
  | "gene-map";

export type Setting = {
  id: string;
  label: string;
  group: SettingGroup;
  kind: SettingKind;
  default: unknown;
  storage: Array<"code default" | "user preference" | "env" | "cache file">;
  commit: SettingCommit;
  effect: "refetch" | "repaint" | "rebuild+restart" | "nothing";
  legend: boolean;
  export: boolean;
  editable: boolean;
  control: SettingControl;
  preferenceKey?: keyof Preferences;
  options?: string[];
  min?: number;
  max?: number;
  help?: string;
  discControl?: boolean;
};

export const OMNIPATH_DATASET_ALLOWLIST = ["omnipath", "pathwayextra", "kinaseextra", "ligrecextra"] as const;
export const MYGENE_FIELD_ALLOWLIST = ["go", "name", "summary", "disease", "pharos", "pathway", "interpro"] as const;
export const CACHE_MISSING_SENTENCE = "DepMap cache is not built. Run npm run cache-depmap.";
export const GENE_ABSENT_SENTENCE = "Genes absent from this DepMap release stay neutral.";

export const DEFAULT_SEEDS: Record<string, string[]> = {
  RAS_MAPK: ["KRAS", "RAF1", "MAPK1"],
  PI3K_AKT: ["PIK3CA", "AKT1", "PTEN"],
  Cell_Cycle: ["TP53", "RB1", "CDK4"],
  Apoptosis: ["BAX", "BCL2", "CASP3"],
  Angiogenesis: ["VEGFA", "KDR", "HIF1A"],
};

const ROLE_PALETTE = {
  azure: "#00B2FF",
  mint: "#00FFC2",
  amber: "#EAB308",
  crimson: "#E11D48",
  slate: "#475569",
};

export type Preferences = {
  zeta: number;
  bloomScale: number;
  selectedPathways: string[];
  context: string;
  visualMode: "chronos" | "expression" | "roles";
  stringSpecies: string;
  stringRequiredScore: number;
  stringPartnerScore: number;
  stringNetworkLimit: number;
  stringPartnerLimit: number;
  stringExpandLimit: number;
  omnipathDatasets: string[];
  mygeneFields: string[];
  initialSeeds: Record<string, string[]>;
  missingColor: string;
  chronosDomain: number[];
  chronosRange: string[];
  chronosClamp: boolean;
  expressionDomain: number[];
  expressionRange: string[];
  expressionClamp: boolean;
  signStimulation: { color: string; dash: string | null };
  signInhibition: { color: string; dash: string | null };
  signBoth: { color: string; dash: string | null };
  rolePalette: typeof ROLE_PALETTE;
  edgeDefaultStroke: string;
  searchHighlight: string[];
  hubColors: { fill: string; stroke: string; bloom: string; highlight: string };
  gridColor: string;
  background: string;
  curatedNoteVisible: boolean;
  fallbackStringError: "seeds-no-edges" | "keep-last-graph";
  fallbackRoleUncached: "hash" | "missing";
};

type Row = Omit<Setting, "storage"> & { storage: Setting["storage"] };

function row(entry: Row): Setting {
  return entry;
}

export const SETTINGS: Setting[] = [
  row({ id: "source.string.networkUrl", label: "STRING network URL", group: "Sources", kind: "source", default: "https://string-db.org/api/json/network", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.string.partnersUrl", label: "STRING interaction-partners URL", group: "Sources", kind: "source", default: "https://string-db.org/api/json/interaction_partners", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.string.identifierDelimiter", label: "STRING network identifier delimiter", group: "Sources", kind: "source", default: "\r", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none", help: "CR between seed symbols. The partner request sends one symbol." }),
  row({ id: "source.string.species", label: "STRING species", group: "Sources", kind: "source", default: "9606", storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: true, export: true, editable: true, control: "text", preferenceKey: "stringSpecies" }),
  row({ id: "source.string.requiredScore", label: "STRING network score cutoff", group: "Sources", kind: "source", default: 700, storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: true, export: true, editable: true, control: "number", preferenceKey: "stringRequiredScore", min: 0, max: 1000 }),
  row({ id: "source.string.partnerScore", label: "STRING partner score cutoff", group: "Sources", kind: "source", default: 800, storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: true, export: true, editable: true, control: "number", preferenceKey: "stringPartnerScore", min: 0, max: 1000 }),
  row({ id: "source.string.networkLimit", label: "STRING network node limit", group: "Sources", kind: "source", default: 25, storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: true, export: true, editable: true, control: "number", preferenceKey: "stringNetworkLimit", min: 1, max: 100 }),
  row({ id: "source.string.partnerLimit", label: "STRING partner default limit", group: "Sources", kind: "source", default: 10, storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: true, export: true, editable: true, control: "number", preferenceKey: "stringPartnerLimit", min: 1, max: 50 }),
  row({ id: "source.string.expandLimit", label: "STRING expand limit", group: "Sources", kind: "source", default: 15, storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: true, export: true, editable: true, control: "number", preferenceKey: "stringExpandLimit", min: 1, max: 50 }),
  row({ id: "source.string.scoreScale", label: "STRING score scale", group: "Sources", kind: "source", default: { min: 0, max: 1000 }, storage: ["code default"], commit: "readonly", effect: "nothing", legend: true, export: true, editable: false, control: "none", help: "API values from 0 to 1 are multiplied by 1000. An invalid score is not published as 0." }),
  row({ id: "source.string.initialSeeds", label: "Starter pathway membership", group: "Sources", kind: "source", default: DEFAULT_SEEDS, storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: false, export: true, editable: true, control: "gene-map", preferenceKey: "initialSeeds" }),
  row({ id: "source.omnipath.host", label: "OmniPath host", group: "Sources", kind: "source", default: "https://omnipathdb.org/interactions", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.omnipath.proxyPath", label: "OmniPath proxy", group: "Sources", kind: "source", default: "/api/omnipath", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none", help: "Empty partners is HTTP 400, not signs-off. A bad symbol is HTTP 400. Upstream failure is HTTP 502." }),
  row({ id: "source.omnipath.genesymbols", label: "OmniPath genesymbols flag", group: "Sources", kind: "source", default: "1", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.omnipath.format", label: "OmniPath format", group: "Sources", kind: "source", default: "json", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.omnipath.datasets", label: "OmniPath datasets", group: "Sources", kind: "source", default: [...OMNIPATH_DATASET_ALLOWLIST], storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: true, export: true, editable: true, control: "dataset-set", preferenceKey: "omnipathDatasets", options: [...OMNIPATH_DATASET_ALLOWLIST], help: "An empty selection is signs off and does not call the proxy." }),
  row({ id: "source.omnipath.endpointFilter", label: "OmniPath row filter", group: "Sources", kind: "source", default: "both endpoints in the partner set", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.mygene.url", label: "MyGene URL", group: "Sources", kind: "source", default: "https://mygene.info/v3/query", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.mygene.species", label: "MyGene species", group: "Sources", kind: "source", default: "human", storage: ["code default"], commit: "readonly", effect: "nothing", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "source.mygene.fields", label: "MyGene fields", group: "Sources", kind: "source", default: [...MYGENE_FIELD_ALLOWLIST], storage: ["code default", "user preference"], commit: "apply", effect: "refetch", legend: false, export: false, editable: true, control: "dataset-set", preferenceKey: "mygeneFields", options: [...MYGENE_FIELD_ALLOWLIST], help: "pharos may be requested. The panel does not render a Pharos section." }),
  row({ id: "source.mygene.roleInference", label: "MyGene role heuristic", group: "Sources", kind: "source", default: "summary text to tumor_suppressor, oncogene, or unknown", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none", help: "Does not invent DepMap numbers, drugs, or binding sites." }),
  row({ id: "source.depmap.panCancerId", label: "Pan-cancer context id", group: "Sources", kind: "source", default: "pan-cancer", storage: ["code default", "cache file"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.depmap.panCancerLabel", label: "Pan-cancer context label", group: "Sources", kind: "source", default: "Pan-cancer (all profiled cell lines)", storage: ["code default", "cache file"], commit: "readonly", effect: "rebuild+restart", legend: true, export: true, editable: false, control: "none" }),
  row({ id: "source.depmap.geneHeaderPattern", label: "DepMap gene header parser", group: "Sources", kind: "source", default: "^([A-Za-z][A-Za-z0-9-]*?)(?:\\s+\\(|$)", storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.depmap.geneJoin", label: "Gene join", group: "Sources", kind: "source", default: "exact HGNC, uppercased", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none", help: "No alias map." }),
  row({ id: "source.depmap.missingCell", label: "DepMap empty cell", group: "Sources", kind: "source", default: "NA, NAN, and blank are excluded from means", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "source.contextsRoute", label: "Contexts route", group: "Sources", kind: "source", default: "GET /api/contexts", storage: ["code default", "cache file"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none", help: CACHE_MISSING_SENTENCE }),
  row({ id: "source.measurementsRoute", label: "Measurements route", group: "Sources", kind: "source", default: "GET /api/measurements", storage: ["code default", "cache file"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),

  row({ id: "fallback.string.error", label: "STRING error", group: "Local fallbacks", kind: "fallback-policy", default: "seeds-no-edges", storage: ["code default", "user preference"], commit: "apply", effect: "nothing", legend: true, export: true, editable: true, control: "enum", preferenceKey: "fallbackStringError", options: ["seeds-no-edges", "keep-last-graph"], help: "Either policy shows the STRING error. Neither uses the success status." }),
  row({ id: "fallback.mygene.error", label: "MyGene error", group: "Local fallbacks", kind: "fallback-policy", default: "MyGene request failed", storage: ["code default"], commit: "readonly", effect: "nothing", legend: true, export: false, editable: false, control: "none", help: "Unknown badge has no biological sentence. No DepMap number." }),
  row({ id: "fallback.depmap.cacheMissing", label: "DepMap cache missing", group: "Local fallbacks", kind: "fallback-policy", default: CACHE_MISSING_SENTENCE, storage: ["code default"], commit: "readonly", effect: "nothing", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "fallback.depmap.geneAbsent", label: "Gene absent from release", group: "Local fallbacks", kind: "fallback-policy", default: GENE_ABSENT_SENTENCE, storage: ["code default"], commit: "readonly", effect: "nothing", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "fallback.role.uncached", label: "Uncached role color", group: "Local fallbacks", kind: "fallback-policy", default: "hash", storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: true, editable: true, control: "enum", preferenceKey: "fallbackRoleUncached", options: ["hash", "missing"], help: "Hash colors are placeholders, not curated roles." }),
  row({ id: "fallback.omnipath.error", label: "OmniPath error", group: "Local fallbacks", kind: "fallback-policy", default: "Show the error. Draw STRING edges with no signs.", storage: ["code default"], commit: "readonly", effect: "nothing", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "fallback.role.druggableDefault", label: "Druggable before details load", group: "Local fallbacks", kind: "fallback-policy", default: false, storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "fallback.layout.centrality", label: "Missing pathway centrality", group: "Local fallbacks", kind: "fallback-policy", default: "0.5, max 1.0", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "fallback.layout.betweenness", label: "Missing betweenness", group: "Local fallbacks", kind: "fallback-policy", default: "0, or 1.0 for a one-node graph", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "fallback.context.unknownLabel", label: "Unknown context label", group: "Local fallbacks", kind: "fallback-policy", default: "pan-cancer label", storage: ["code default"], commit: "readonly", effect: "nothing", legend: true, export: true, editable: false, control: "none" }),
  row({ id: "fallback.string.invalidScore", label: "Non-numeric STRING score", group: "Local fallbacks", kind: "fallback-policy", default: "null, tooltip says invalid", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: true, editable: false, control: "none" }),
  row({ id: "local.curated.table", label: "Curated note source", group: "Local fallbacks", kind: "source", default: "18 curated genes, depMap field unused", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),

  row({ id: "display.missingColor", label: "Missing measurement color", group: "Display", kind: "display", default: "#334155", storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "color", preferenceKey: "missingColor" }),
  row({ id: "display.chronos.domain", label: "Chronos color domain", group: "Display", kind: "display", default: [-2, -0.5, 0, 0.5], storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "text", preferenceKey: "chronosDomain" }),
  row({ id: "display.chronos.range", label: "Chronos color range", group: "Display", kind: "display", default: ["#e11d48", "#fb7185", "#64748b", "#38bdf8"], storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "color-list", preferenceKey: "chronosRange" }),
  row({ id: "display.chronos.clamp", label: "Chronos scale clamp", group: "Display", kind: "display", default: true, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "boolean", preferenceKey: "chronosClamp" }),
  row({ id: "display.expression.domain", label: "Expression color domain", group: "Display", kind: "display", default: [0, 5, 10], storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "text", preferenceKey: "expressionDomain" }),
  row({ id: "display.expression.range", label: "Expression color range", group: "Display", kind: "display", default: ["#0f172a", "#22d3ee", "#f8fafc"], storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "color-list", preferenceKey: "expressionRange" }),
  row({ id: "display.expression.clamp", label: "Expression scale clamp", group: "Display", kind: "display", default: true, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "boolean", preferenceKey: "expressionClamp" }),
  row({ id: "display.chronos.caption", label: "Chronos caption", group: "Display", kind: "display", default: "Mean Chronos gene effect. n is the cell-line count.", storage: ["code default"], commit: "readonly", effect: "repaint", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "display.expression.caption", label: "Expression caption", group: "Display", kind: "display", default: "Mean log2(TPM+1). The file is already log-transformed.", storage: ["code default"], commit: "readonly", effect: "repaint", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "display.roles.caption", label: "Roles caption", group: "Display", kind: "display", default: "Curated role colors. Hash colors on unloaded symbols are placeholders.", storage: ["code default"], commit: "readonly", effect: "repaint", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "display.legend.titles", label: "Legend titles", group: "Display", kind: "display", default: { chronos: "Mean Chronos", expression: "Mean expression", roles: "Curated roles" }, storage: ["code default"], commit: "readonly", effect: "repaint", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "display.panel.depmapHeading", label: "Protein-panel DepMap heading", group: "Display", kind: "display", default: "DepMap measurements", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.panel.pathwayHeadings", label: "Pathway headings", group: "Display", kind: "display", default: "Pathways & Systems", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.panel.roleBadges", label: "Role badge styles", group: "Display", kind: "display", default: "Unknown has no biological sentence", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.panel.missingToken", label: "Panel missing mean", group: "Display", kind: "display", default: "missing", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.roles.categoryMap", label: "Loaded role colors", group: "Display", kind: "display", default: "suppressor azure, oncogene crimson, druggable mint, else amber", storage: ["code default"], commit: "readonly", effect: "repaint", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.roles.palette", label: "Role palette", group: "Display", kind: "display", default: ROLE_PALETTE, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "text", preferenceKey: "rolePalette", help: "Shown as the roles caption. Each value is #rrggbb." }),
  row({ id: "display.layout.secondaryAngle", label: "Secondary layout angle", group: "Display", kind: "display", default: "hashString(symbol) % 1000", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.edges.gradientPairs", label: "Edge gradient pairs", group: "Display", kind: "display", default: "role palette pairs", storage: ["code default"], commit: "readonly", effect: "repaint", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.search.highlight", label: "Search highlight colors", group: "Display", kind: "display", default: ["#38bdf8", "#22d3ee", "#0ea5e9", "#06b6d4"], storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "color-list", preferenceKey: "searchHighlight" }),
  row({ id: "display.hub.colors", label: "Pathway hub colors", group: "Display", kind: "display", default: { fill: "rgba(225,29,72,0.15)", stroke: "#e11d48", bloom: "#fde047", highlight: "#38bdf8" }, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "text", preferenceKey: "hubColors", help: "Fill stays rgba(r,g,b,a). The other three values are #rrggbb." }),
  row({ id: "display.edges.width", label: "Edge width", group: "Display", kind: "display", default: "0.6 + (score/1000)*2.4", storage: ["code default"], commit: "readonly", effect: "repaint", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.edges.searchWidth", label: "Search edge width", group: "Display", kind: "display", default: "max(2.5, scoreWidth)", storage: ["code default"], commit: "readonly", effect: "repaint", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.edges.defaultStroke", label: "Edge stroke without a sign", group: "Display", kind: "display", default: "#475569", storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "color", preferenceKey: "edgeDefaultStroke" }),
  row({ id: "display.edges.opacity", label: "Edge opacity", group: "Display", kind: "display", default: "0.95 / 0.7 / 0.05 / 0.3", storage: ["code default"], commit: "readonly", effect: "repaint", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.edges.tooltip", label: "Edge tooltip", group: "Display", kind: "display", default: "endpoints, pathway, STRING score, OmniPath regulation", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.status.string", label: "STRING status copy", group: "Display", kind: "display", default: "Querying STRING... / STRING API Active / the error", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.signs.stimulation", label: "Stimulation color", group: "Display", kind: "display", default: { color: "#34d399", dash: null }, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "color", preferenceKey: "signStimulation" }),
  row({ id: "display.signs.inhibition", label: "Inhibition color", group: "Display", kind: "display", default: { color: "#fb7185", dash: "2,2" }, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "color", preferenceKey: "signInhibition" }),
  row({ id: "display.signs.both", label: "Both-sign color", group: "Display", kind: "display", default: { color: "#c084fc", dash: "4,3" }, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: false, editable: true, control: "color", preferenceKey: "signBoth" }),
  row({ id: "display.signs.legend", label: "Sign legend line", group: "Display", kind: "display", default: "OmniPath signs on X of Y STRING edges", storage: ["code default"], commit: "readonly", effect: "repaint", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.radius", label: "Disc radius", group: "Display", kind: "display", default: 400, storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.secondaryShell", label: "Secondary shell", group: "Display", kind: "display", default: "min(0.25, localScale * log(n+2))", storage: ["code default"], commit: "readonly", effect: "repaint", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.boundaryClamp", label: "Poincaré boundary", group: "Display", kind: "display", default: 0.99, storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.pathwayNodeSize", label: "Pathway node size", group: "Display", kind: "display", default: "22 + 28 * centrality", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.secondaryNodeSize", label: "Secondary node size", group: "Display", kind: "display", default: "druggable 14, else max(9, 6 + hover)", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.centralDegree", label: "Central-node degree", group: "Display", kind: "display", default: 4, storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.zoom", label: "Zoom extent", group: "Display", kind: "display", default: [0.5, 10], storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.layout.grid", label: "Grid and horizon color", group: "Display", kind: "display", default: "#22d3ee", storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "color", preferenceKey: "gridColor" }),
  row({ id: "display.layout.background", label: "Canvas background", group: "Display", kind: "display", default: "#07090E", storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "color", preferenceKey: "background" }),
  row({ id: "display.export.pngScale", label: "PNG pixel scale", group: "Display", kind: "display", default: 2, storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.search.miss", label: "Gene search miss", group: "Display", kind: "display", default: "Gene not found", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "display.auth.errors", label: "Auth error text", group: "Display", kind: "display", default: "Signup failed / Login failed", storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),

  row({ id: "view.zeta", label: "Zeta", group: "View", kind: "view", default: 1, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "none", preferenceKey: "zeta", discControl: true, help: "Edited on the disc." }),
  row({ id: "view.bloomScale", label: "Bloom", group: "View", kind: "view", default: 1.8, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "none", preferenceKey: "bloomScale", discControl: true, help: "Edited on the disc." }),
  row({ id: "view.zetaBounds", label: "Zeta slider bounds", group: "View", kind: "view", default: { min: 0.5, max: 2.5, step: 0.1 }, storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "view.bloomBounds", label: "Bloom slider bounds", group: "View", kind: "view", default: { min: 1, max: 3.5, step: 0.2 }, storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "view.selectedPathways", label: "Active starter pathways", group: "View", kind: "view", default: Object.keys(DEFAULT_SEEDS), storage: ["code default", "user preference"], commit: "immediate", effect: "refetch", legend: false, export: false, editable: true, control: "none", preferenceKey: "selectedPathways", discControl: true, help: "Edited on the disc." }),
  row({ id: "view.context", label: "DepMap context", group: "View", kind: "view", default: "pan-cancer", storage: ["code default", "user preference"], commit: "immediate", effect: "refetch", legend: true, export: true, editable: true, control: "none", preferenceKey: "context", discControl: true, help: "Edited on the disc. Default is the pan-cancer id." }),
  row({ id: "view.visualMode", label: "Color mode", group: "View", kind: "view", default: "chronos", storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: true, export: true, editable: true, control: "none", preferenceKey: "visualMode", discControl: true, help: "Edited on the disc." }),
  row({ id: "view.curatedNoteVisible", label: "Curated note", group: "View", kind: "view", default: true, storage: ["code default", "user preference"], commit: "immediate", effect: "repaint", legend: false, export: false, editable: true, control: "boolean", preferenceKey: "curatedNoteVisible" }),

  row({ id: "operator.jwtSecret", label: "JWT secret", group: "Operator", kind: "operator", default: "present or absent", storage: ["env"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Set JWT_SECRET in .env and restart. The value is never shown." }),
  row({ id: "operator.host", label: "Listen host", group: "Operator", kind: "operator", default: "127.0.0.1", storage: ["env"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Set HOST and restart." }),
  row({ id: "operator.port", label: "Listen port", group: "Operator", kind: "operator", default: 3000, storage: ["env"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Set PORT and restart." }),
  row({ id: "operator.nodeEnv", label: "Node environment", group: "Operator", kind: "operator", default: "unset", storage: ["env"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Set NODE_ENV and restart." }),
  row({ id: "operator.depmapRelease", label: "DepMap release", group: "Operator", kind: "operator", default: null, storage: ["env", "cache file"], commit: "readonly", effect: "rebuild+restart", legend: true, export: true, editable: false, control: "none", help: "Set DEPMAP_RELEASE, run npm run cache-depmap, then restart." }),
  row({ id: "operator.geminiApiKey", label: "Gemini API key", group: "Operator", kind: "operator", default: "unused", storage: ["env"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none", help: "Unused. Do not add a Gemini client." }),
  row({ id: "operator.appUrl", label: "App URL", group: "Operator", kind: "operator", default: "unused", storage: ["env"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.disableHmr", label: "Vite HMR flag", group: "Operator", kind: "operator", default: "unset", storage: ["env"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Set DISABLE_HMR and restart the dev server." }),
  row({ id: "operator.listenUrl", label: "Listen URL", group: "Operator", kind: "operator", default: "http://127.0.0.1:3000", storage: ["env"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.databasePath", label: "Preference store", group: "Operator", kind: "operator", default: "./database.json", storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.measurementCachePath", label: "DepMap cache path", group: "Operator", kind: "operator", default: "data/cache/measurements.json", storage: ["cache file"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Run npm run cache-depmap, then restart." }),
  row({ id: "operator.cacheLoaded", label: "DepMap cache loaded", group: "Operator", kind: "operator", default: false, storage: ["cache file"], commit: "readonly", effect: "rebuild+restart", legend: true, export: false, editable: false, control: "none" }),
  row({ id: "operator.depmapSourceFiles", label: "DepMap source CSVs", group: "Operator", kind: "operator", default: ["data/depmap/Model.csv", "data/depmap/CRISPRGeneEffect.csv", "data/depmap/OmicsExpressionProteinCodingGenesTPMLogp1.csv"], storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Replace the files and run npm run cache-depmap." }),
  row({ id: "operator.cookieName", label: "Auth cookie name", group: "Operator", kind: "operator", default: "token", storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.cookieHttpOnly", label: "Cookie HttpOnly", group: "Operator", kind: "operator", default: true, storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.cookieSameSite", label: "Cookie SameSite", group: "Operator", kind: "operator", default: "lax", storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.cookieSecure", label: "Cookie Secure", group: "Operator", kind: "operator", default: false, storage: ["code default", "env"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.jwtExpiresIn", label: "JWT lifetime", group: "Operator", kind: "operator", default: "24h", storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.authRoutes", label: "Auth routes", group: "Operator", kind: "operator", default: ["/api/signup", "/api/login", "/api/logout", "/api/me", "/api/preferences", "/api/operator"], storage: ["code default"], commit: "readonly", effect: "nothing", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.dotenvOrder", label: "Env file order", group: "Operator", kind: "operator", default: [".env", ".env.local"], storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none", help: "Vite loadEnv is a build detail, not a second scientific source." }),
  row({ id: "operator.depmapModelColumns", label: "Model.csv columns", group: "Operator", kind: "operator", default: ["ModelID", "OncotreeLineage"], storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
  row({ id: "operator.depmapMatrixLabels", label: "Matrix names in build errors", group: "Operator", kind: "operator", default: ["CRISPR gene effect", "expression"], storage: ["code default"], commit: "readonly", effect: "rebuild+restart", legend: false, export: false, editable: false, control: "none" }),
];

export function setting(id: string): Setting {
  const found = SETTINGS.find(item => item.id === id);
  if (!found) throw new Error(`Unknown setting: ${id}`);
  return found;
}

export function settingsByGroup(list: Setting[] = SETTINGS): { group: SettingGroup; settings: Setting[] }[] {
  return GROUP_ORDER.map(group => ({
    group,
    settings: list.filter(item => item.group === group),
  })).filter(section => section.settings.length > 0);
}

export function defaultPreferences(): Preferences {
  return {
    zeta: setting("view.zeta").default as number,
    bloomScale: setting("view.bloomScale").default as number,
    selectedPathways: Object.keys(DEFAULT_SEEDS),
    context: setting("source.depmap.panCancerId").default as string,
    visualMode: "chronos",
    stringSpecies: "9606",
    stringRequiredScore: 700,
    stringPartnerScore: 800,
    stringNetworkLimit: 25,
    stringPartnerLimit: 10,
    stringExpandLimit: 15,
    omnipathDatasets: [...OMNIPATH_DATASET_ALLOWLIST],
    mygeneFields: [...MYGENE_FIELD_ALLOWLIST],
    initialSeeds: structuredClone(DEFAULT_SEEDS),
    missingColor: "#334155",
    chronosDomain: [-2, -0.5, 0, 0.5],
    chronosRange: ["#e11d48", "#fb7185", "#64748b", "#38bdf8"],
    chronosClamp: true,
    expressionDomain: [0, 5, 10],
    expressionRange: ["#0f172a", "#22d3ee", "#f8fafc"],
    expressionClamp: true,
    signStimulation: { color: "#34d399", dash: null },
    signInhibition: { color: "#fb7185", dash: "2,2" },
    signBoth: { color: "#c084fc", dash: "4,3" },
    rolePalette: { ...ROLE_PALETTE },
    edgeDefaultStroke: "#475569",
    searchHighlight: ["#38bdf8", "#22d3ee", "#0ea5e9", "#06b6d4"],
    hubColors: { fill: "rgba(225,29,72,0.15)", stroke: "#e11d48", bloom: "#fde047", highlight: "#38bdf8" },
    gridColor: "#22d3ee",
    background: "#07090E",
    curatedNoteVisible: true,
    fallbackStringError: "seeds-no-edges",
    fallbackRoleUncached: "hash",
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function asNumberList(value: unknown, count: number): number[] | null {
  if (typeof value === "string") {
    const parts = value.split(",").map(part => Number(part.trim()));
    if (parts.length === count && parts.every(part => Number.isFinite(part))) return parts;
    return null;
  }
  if (!Array.isArray(value) || value.length !== count) return null;
  const numbers = value.map(item => Number(item));
  if (numbers.some(item => !Number.isFinite(item))) return null;
  return numbers;
}

export function validatePreferences(input: unknown): { ok: true; value: Preferences } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "preferences must be an object" };
  const body = input as Record<string, unknown>;
  const defaults = defaultPreferences();
  const allowed = new Set(Object.keys(defaults));
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { ok: false, error: `Unknown preference: ${key}` };
  }
  const merged = { ...defaults, ...body } as Preferences;
  if (!/^\d+$/.test(String(merged.stringSpecies))) return { ok: false, error: "stringSpecies must be a taxon id" };
  for (const key of ["stringRequiredScore", "stringPartnerScore"] as const) {
    const value = Number(merged[key]);
    if (!Number.isInteger(value) || value < 0 || value > 1000) return { ok: false, error: `${key} must be an integer from 0 to 1000` };
    merged[key] = value;
  }
  const networkLimit = Number(merged.stringNetworkLimit);
  if (!Number.isInteger(networkLimit) || networkLimit < 1 || networkLimit > 100) return { ok: false, error: "stringNetworkLimit must be 1 to 100" };
  merged.stringNetworkLimit = networkLimit;
  for (const key of ["stringPartnerLimit", "stringExpandLimit"] as const) {
    const value = Number(merged[key]);
    if (!Number.isInteger(value) || value < 1 || value > 50) return { ok: false, error: `${key} must be 1 to 50` };
    merged[key] = value;
  }
  if (!Array.isArray(merged.omnipathDatasets)) return { ok: false, error: "omnipathDatasets must be a list" };
  const datasets: string[] = [];
  for (const name of merged.omnipathDatasets) {
    if (!OMNIPATH_DATASET_ALLOWLIST.includes(name as typeof OMNIPATH_DATASET_ALLOWLIST[number])) {
      return { ok: false, error: `Unknown OmniPath dataset: ${name}` };
    }
    if (!datasets.includes(name)) datasets.push(name);
  }
  merged.omnipathDatasets = datasets;
  if (!Array.isArray(merged.mygeneFields) || merged.mygeneFields.length === 0) return { ok: false, error: "mygeneFields must be a non-empty list" };
  const fields: string[] = [];
  for (const name of merged.mygeneFields) {
    if (!MYGENE_FIELD_ALLOWLIST.includes(name as typeof MYGENE_FIELD_ALLOWLIST[number])) return { ok: false, error: `Unknown MyGene field: ${name}` };
    if (!fields.includes(name)) fields.push(name);
  }
  merged.mygeneFields = fields;
  if (!merged.initialSeeds || typeof merged.initialSeeds !== "object" || Array.isArray(merged.initialSeeds)) {
    return { ok: false, error: "initialSeeds must be a pathway map" };
  }
  const seeds: Record<string, string[]> = {};
  for (const [pathway, genes] of Object.entries(merged.initialSeeds)) {
    if (!Array.isArray(genes) || genes.length === 0) return { ok: false, error: `initialSeeds.${pathway} needs genes` };
    seeds[pathway] = [];
    for (const gene of genes) {
      const symbol = String(gene).trim().toUpperCase();
      if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(symbol)) return { ok: false, error: `Invalid gene symbol: ${gene}` };
      seeds[pathway].push(symbol);
    }
  }
  if (Object.keys(seeds).length === 0) return { ok: false, error: "initialSeeds needs a pathway" };
  merged.initialSeeds = seeds;
  const chronosDomain = asNumberList(merged.chronosDomain, 4);
  const expressionDomain = asNumberList(merged.expressionDomain, 3);
  if (!chronosDomain || chronosDomain.some((value, index) => index > 0 && value < chronosDomain[index - 1])) {
    return { ok: false, error: "chronosDomain must be four ascending numbers" };
  }
  if (!expressionDomain || expressionDomain.some((value, index) => index > 0 && value < expressionDomain[index - 1])) {
    return { ok: false, error: "expressionDomain must be three ascending numbers" };
  }
  merged.chronosDomain = chronosDomain;
  merged.expressionDomain = expressionDomain;
  if (typeof merged.chronosClamp !== "boolean" || typeof merged.expressionClamp !== "boolean" || typeof merged.curatedNoteVisible !== "boolean") {
    return { ok: false, error: "clamp and curated-note flags must be booleans" };
  }
  if (merged.fallbackStringError !== "seeds-no-edges" && merged.fallbackStringError !== "keep-last-graph") {
    return { ok: false, error: "fallbackStringError is invalid" };
  }
  if (merged.fallbackRoleUncached !== "hash" && merged.fallbackRoleUncached !== "missing") {
    return { ok: false, error: "fallbackRoleUncached is invalid" };
  }
  if (!HEX.test(merged.missingColor) || !HEX.test(merged.edgeDefaultStroke) || !HEX.test(merged.gridColor) || !HEX.test(merged.background)) {
    return { ok: false, error: "colors must be #rrggbb" };
  }
  const zeta = Number(merged.zeta);
  const bloom = Number(merged.bloomScale);
  if (!(zeta >= 0.5 && zeta <= 2.5) || !(bloom >= 1 && bloom <= 3.5)) return { ok: false, error: "zeta or bloom is out of range" };
  merged.zeta = zeta;
  merged.bloomScale = bloom;
  if (!["chronos", "expression", "roles"].includes(merged.visualMode)) return { ok: false, error: "visualMode is invalid" };
  if (typeof merged.context !== "string" || merged.context.trim() === "") {
    return { ok: false, error: "context must be a non-empty string" };
  }
  merged.context = merged.context.trim();
  if (!Array.isArray(merged.selectedPathways)) return { ok: false, error: "selectedPathways must be a list" };
  if (!hexList(merged.chronosRange, merged.chronosDomain.length) || !hexList(merged.expressionRange, merged.expressionDomain.length) || !hexList(merged.searchHighlight)) {
    return { ok: false, error: "color lists must be #rrggbb" };
  }
  for (const key of ["signStimulation", "signInhibition", "signBoth"] as const) {
    const sign = merged[key];
    if (!sign || typeof sign !== "object" || !HEX.test(sign.color) || (sign.dash != null && !/^\d+(?:,\d+)+$/.test(sign.dash))) {
      return { ok: false, error: `${key} needs a #rrggbb color and a dash such as 2,2` };
    }
  }
  const paletteKeys = ["azure", "mint", "amber", "crimson", "slate"] as const;
  if (!merged.rolePalette || paletteKeys.some(key => !HEX.test(merged.rolePalette[key]))) {
    return { ok: false, error: "rolePalette values must be #rrggbb" };
  }
  const hub = merged.hubColors;
  if (!hub || !/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/.test(hub.fill) || !HEX.test(hub.stroke) || !HEX.test(hub.bloom) || !HEX.test(hub.highlight)) {
    return { ok: false, error: "hubColors fill must be rgba() and the other hub colors must be #rrggbb" };
  }
  return { ok: true, value: merged };
}

function hexList(value: unknown, count?: number): boolean {
  if (!Array.isArray(value)) return false;
  if (count != null && value.length !== count) return false;
  return value.length > 0 && value.every(item => typeof item === "string" && HEX.test(item));
}

export function mergePreferences(stored: Partial<Preferences> | null | undefined): Preferences {
  const defaults = defaultPreferences();
  if (!stored) return defaults;
  const known: Partial<Preferences> = {};
  for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
    if (stored[key] !== undefined) (known as Record<string, unknown>)[key] = stored[key];
  }
  const checked = validatePreferences({ ...defaults, ...known });
  return checked.ok ? checked.value : defaults;
}

export function formatSettingValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function operatorReadout(input: {
  env: Record<string, string | undefined>;
  cacheLoaded: boolean;
  cacheRelease: string | null;
}) {
  const host = input.env.HOST || "127.0.0.1";
  const port = Number(input.env.PORT) || 3000;
  const nodeEnv = input.env.NODE_ENV || "unset";
  return {
    jwtSecret: input.env.JWT_SECRET ? "present" : "absent",
    host,
    port,
    nodeEnv,
    listenUrl: `http://${host}:${port}`,
    databasePath: "./database.json",
    measurementCachePath: "data/cache/measurements.json",
    cacheLoaded: input.cacheLoaded,
    depmapRelease: input.cacheRelease,
    depmapReleaseEnv: input.env.DEPMAP_RELEASE ?? null,
    panCancerId: setting("source.depmap.panCancerId").default,
    panCancerLabel: setting("source.depmap.panCancerLabel").default,
    depmapSourceFiles: setting("operator.depmapSourceFiles").default,
    cookieName: "token",
    cookieHttpOnly: true,
    cookieSameSite: "lax",
    cookieSecure: nodeEnv === "production",
    jwtExpiresIn: "24h",
    authRoutes: setting("operator.authRoutes").default,
    dotenvOrder: [".env", ".env.local"],
    geminiApiKey: "unused",
    appUrl: "unused",
    disableHmr: input.env.DISABLE_HMR === "true" ? "true" : "unset",
    depmapModelColumns: ["ModelID", "OncotreeLineage"],
    depmapMatrixLabels: ["CRISPR gene effect", "expression"],
  };
}

export function edgeWidth(score: number | null): number {
  if (score == null || !Number.isFinite(score)) return 0.6;
  const clamped = Math.max(0, Math.min(1000, score));
  return 0.6 + (clamped / 1000) * 2.4;
}
