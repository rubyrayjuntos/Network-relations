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
