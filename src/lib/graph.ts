export function betweennessCentrality(nodes: string[], edges: [string, string][]): Record<string, number> {
  const cb: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  
  nodes.forEach(n => { cb[n] = 0; adj[n] = []; });
  edges.forEach(([u, v]) => {
    if (adj[u] && adj[v]) {
      adj[u].push(v);
      adj[v].push(u);
    }
  });

  nodes.forEach(s => {
    const S: string[] = [];
    const P: Record<string, string[]> = {};
    const sigma: Record<string, number> = {};
    const d: Record<string, number> = {};
    
    nodes.forEach(w => {
      P[w] = [];
      sigma[w] = 0;
      d[w] = -1;
    });
    
    sigma[s] = 1;
    d[s] = 0;
    const Q: string[] = [s];
    
    while (Q.length > 0) {
      const v = Q.shift()!;
      S.push(v);
      adj[v].forEach(w => {
        if (d[w] < 0) {
          Q.push(w);
          d[w] = d[v] + 1;
        }
        if (d[w] === d[v] + 1) {
          sigma[w] += sigma[v];
          P[w].push(v);
        }
      });
    }
    
    const delta: Record<string, number> = {};
    nodes.forEach(v => delta[v] = 0);
    
    while (S.length > 0) {
      const w = S.pop()!;
      P[w].forEach(v => {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      });
      if (w !== s) {
        cb[w] += delta[w];
      }
    }
  });

  // Normalize
  const n = nodes.length;
  if (n > 2) {
    const norm = (n - 1) * (n - 2);
    nodes.forEach(v => cb[v] /= norm);
  }
  
  return cb;
}

export function calculateNetworkMetrics(nodes: string[], edges: [string, string][]) {
  const adj: Record<string, string[]> = {};
  nodes.forEach(n => { adj[n] = []; });
  
  edges.forEach(([u, v]) => {
    if (adj[u] && adj[v] && !adj[u].includes(v)) {
      adj[u].push(v);
      adj[v].push(u);
    }
  });

  // Clustering coefficient
  let totalCc = 0;
  nodes.forEach(n => {
    const neighbors = adj[n];
    const k = neighbors.length;
    if (k < 2) return;
    
    let links = 0;
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        if (adj[neighbors[i]].includes(neighbors[j])) {
          links++;
        }
      }
    }
    totalCc += (2 * links) / (k * (k - 1));
  });
  const avgClusteringCoefficient = nodes.length > 0 ? totalCc / nodes.length : 0;

  // Average path length
  let totalPathLength = 0;
  let reachablePairs = 0;
  
  nodes.forEach(s => {
    const d: Record<string, number> = {};
    nodes.forEach(w => { d[w] = -1; });
    
    d[s] = 0;
    const Q: string[] = [s];
    
    while (Q.length > 0) {
      const v = Q.shift()!;
      adj[v].forEach(w => {
        if (d[w] < 0) {
          d[w] = d[v] + 1;
          Q.push(w);
          totalPathLength += d[w];
          reachablePairs++;
        }
      });
    }
  });
  
  const avgPathLength = reachablePairs > 0 ? totalPathLength / reachablePairs : 0;
  
  return {
    nodes: nodes.length,
    edges: edges.length,
    avgClusteringCoefficient,
    avgPathLength
  };
}

