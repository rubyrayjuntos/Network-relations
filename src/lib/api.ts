import { betweennessCentrality } from './graph';

export const INITIAL_SEEDS: Record<string, string[]> = {
  "RAS_MAPK": ["KRAS", "RAF1", "MAPK1"],
  "PI3K_AKT": ["PIK3CA", "AKT1", "PTEN"],
  "Cell_Cycle": ["TP53", "RB1", "CDK4"],
  "Apoptosis": ["BAX", "BCL2", "CASP3"],
  "Angiogenesis": ["VEGFA", "KDR", "HIF1A"]
};

export type GraphData = { nodes: string[], edges: [string, string][] };

export async function fetchStringNetwork(proteins: string[], limit: number = 25): Promise<GraphData> {
  if (!proteins || proteins.length === 0) return { nodes: [], edges: [] };
  
  try {
    const params = new URLSearchParams({
      identifiers: proteins.join('\r'),
      species: '9606',
      required_score: '700'
    });
    
    // Using interaction endpoint to get edges
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
    
    if (nodes.length > limit) {
      // Basic degree centrality for fast pruning if network is too large
      const degrees: Record<string, number> = {};
      nodes.forEach(n => degrees[n] = 0);
      edges.forEach(([u, v]) => { degrees[u]++; degrees[v]++; });
      
      nodes.sort((a, b) => degrees[b] - degrees[a]);
      nodes = nodes.slice(0, limit);
      const topNodesSet = new Set(nodes);
      const prunedEdges = edges.filter(([u, v]) => topNodesSet.has(u) && topNodesSet.has(v));
      return { nodes, edges: prunedEdges };
    }
    
    return { nodes, edges };
  } catch (e) {
    console.error("STRING error:", e);
    return { nodes: proteins.slice(0, limit), edges: [] };
  }
}

export async function fetchInteractors(protein: string, limit: number = 10): Promise<GraphData> {
  try {
    const params = new URLSearchParams({
      identifiers: protein,
      species: '9606',
      limit: limit.toString(),
      required_score: '800'
    });
    
    const res = await fetch(`https://string-db.org/api/json/interaction_partners?${params}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    
    const nodesSet = new Set<string>([protein]);
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
    
    return { nodes: Array.from(nodesSet), edges };
  } catch (e) {
    console.error("STRING interaction error:", e);
    return { nodes: [protein], edges: [] };
  }
}

export type OmnipathInteraction = {
  source: string;
  target: string;
  is_stimulation: boolean;
  is_inhibition: boolean;
};

export async function fetchOmnipathInteractions(proteins: string[]): Promise<OmnipathInteraction[]> {
  if (!proteins || proteins.length === 0) return [];
  
  try {
    // Omnipath API supports GET with partners list
    const params = new URLSearchParams({
      genesymbols: '1',
      format: 'json',
      partners: proteins.join(','),
      datasets: 'omnipath,pathwayextra,kinaseextra,ligrecextra'
    });
    
    const res = await fetch(`https://omnipathdb.org/interactions?${params}`);
    if (!res.ok) throw new Error(`Omnipath error! status: ${res.status}`);
    
    const data = await res.json();
    
    // Filter to only edges where BOTH source and target are in our network
    const proteinSet = new Set(proteins);
    
    const filtered: OmnipathInteraction[] = [];
    
    for (const row of data) {
      const source = row.source_genesymbol;
      const target = row.target_genesymbol;
      
      if (source && target && proteinSet.has(source) && proteinSet.has(target)) {
        filtered.push({
          source,
          target,
          is_stimulation: row.is_stimulation === true || row.consensus_stimulation === true,
          is_inhibition: row.is_inhibition === true || row.consensus_inhibition === true
        });
      }
    }
    
    return filtered;
  } catch (e) {
    console.error("Omnipath error:", e);
    return [];
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
  inferredRole?: "oncogene" | "tumor_suppressor" | "unknown";
  druggable?: boolean;
  expressionLevel?: number; // Synthetic log2FC expression value (-3.0 to +3.0)
};

export async function fetchProteinDetails(symbol: string): Promise<ProteinDetails | null> {
  try {
    const res = await fetch(`https://mygene.info/v3/query?q=symbol:${symbol}&species=human&fields=go,name,summary,disease,pharos`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.hits && data.hits.length > 0) {
      const hit = data.hits[0];
      
      // Dynamically infer role based on text mining the summary
      let inferredRole: "oncogene" | "tumor_suppressor" | "unknown" = "unknown";
      const text = (hit.summary || "").toLowerCase();
      if (text.includes("tumor suppressor") || text.includes("suppressor of")) {
        inferredRole = "tumor_suppressor";
      } else if (text.includes("oncogene") || text.includes("proto-oncogene")) {
        inferredRole = "oncogene";
      }
      
      // Infer druggability (presence of Pharos target data or kinase activity)
      let druggable = false;
      if (hit.pharos && hit.pharos.target_id) druggable = true;
      if (text.includes("kinase") || text.includes("receptor")) druggable = true;

      // Generate synthetic gene expression level (Log2 Fold Change roughly between -3.0 and +3.0)
      let expressionLevel = 0;
      const sumHash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      expressionLevel = ((sumHash % 100) / 100) * 6 - 3;

      return {
        ...hit,
        inferredRole,
        druggable,
        expressionLevel
      } as ProteinDetails;
    }
    return null;
  } catch (e) {
    console.error("MyGene error:", e);
    return null;
  }
}
