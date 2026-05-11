import { betweennessCentrality } from './graph';

export const PATHWAY_SEEDS: Record<string, string[]> = {
  "RAS_MAPK": ["KRAS", "NRAS", "HRAS", "RAF1", "MAPK1", "MAPK3", "EGFR"],
  "PI3K_AKT": ["PIK3CA", "AKT1", "PTEN", "MTOR", "PIK3R1", "KRAS"],
  "Cell_Cycle": ["TP53", "RB1", "CDK4", "CDK6", "E2F1"],
  "Apoptosis": ["TP53", "BAX", "BCL2", "CASP3"],
  "Angiogenesis": ["VEGFA", "KDR", "HIF1A"]
};

export const PROTEIN_ROLES: Record<string, [string, boolean]> = {
  "KRAS": ["oncogene", true], "RAF1": ["oncogene", true], "PIK3CA": ["oncogene", true],
  "AKT1": ["oncogene", false], "MTOR": ["oncogene", true], "PTEN": ["tumor_suppressor", false],
  "TP53": ["tumor_suppressor", true], "RB1": ["tumor_suppressor", false],
  "BCL2": ["oncogene", true], "VEGFA": ["oncogene", true], "EGFR": ["oncogene", true]
};

export const BINDING_SITES: Record<string, string> = {
  "KRAS": "RAS-RAF or RAS-PI3Kα RBD interface – multi-arm collapse",
  "PIK3CA": "RAS-binding domain – blocks RTK/RAS cross-talk",
  "TP53": "DNA-binding domain – critical regulatory checkpoint",
  "RAF1": "KRAS-RAF interface – classic MAPK pathway vulnerability",
  "PTEN": "Phosphatase domain – loss drives PI3K hyperactivation"
};

export const FALLBACK_CENTRALITY: Record<string, number> = {
  "RAS_MAPK": 0.95, "PI3K_AKT": 0.88, "Cell_Cycle": 0.72,
  "Apoptosis": 0.65, "Angiogenesis": 0.48
};

export type GraphData = { nodes: string[], edges: [string, string][] };

export async function fetchStringNetwork(proteins: string[]): Promise<GraphData> {
  if (!proteins || proteins.length === 0) return { nodes: [], edges: [] };
  
  try {
    const params = new URLSearchParams({
      identifiers: proteins.join('\r'),
      species: '9606',
      required_score: '700'
    });
    
    const res = await fetch(`https://string-db.org/api/json/network?${params}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    
    const nodesSet = new Set<string>();
    const edges: [string, string][] = [];
    
    data.forEach((row: any) => {
      const u = row.preferredName_A;
      const v = row.preferredName_B;
      if (u && v) {
        nodesSet.add(u);
        nodesSet.add(v);
        edges.push([u, v]);
      }
    });
    
    let nodes = Array.from(nodesSet);
    
    if (nodes.length > 25) {
      const bet = betweennessCentrality(nodes, edges);
      nodes.sort((a, b) => bet[b] - bet[a]);
      nodes = nodes.slice(0, 25);
      const topNodesSet = new Set(nodes);
      const prunedEdges = edges.filter(([u, v]) => topNodesSet.has(u) && topNodesSet.has(v));
      return { nodes, edges: prunedEdges };
    }
    
    return { nodes, edges };
  } catch (e) {
    console.error("STRING error:", e);
    // Fallback
    const fallbackNodes = proteins.slice(0, 8);
    return { nodes: fallbackNodes, edges: [] };
  }
}

export type ProteinDetails = {
  name: string;
  summary: string;
  go?: {
    BP?: { term: string }[];
    CC?: { term: string }[];
    MF?: { term: string }[];
  };
  disease?: { term: string }[];
};

export async function fetchProteinDetails(symbol: string): Promise<ProteinDetails | null> {
  try {
    const res = await fetch(`https://mygene.info/v3/query?q=symbol:${symbol}&species=human&fields=go,name,summary,disease`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.hits && data.hits.length > 0) {
      return data.hits[0] as ProteinDetails;
    }
    return null;
  } catch (e) {
    console.error("MyGene error:", e);
    return null;
  }
}
