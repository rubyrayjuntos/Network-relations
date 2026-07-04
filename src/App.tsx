/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Database, LogOut, X, Search, Plus, Loader2 } from 'lucide-react';
import { Complex, cExp, cAbs, poincareTranslation, hashString } from './lib/math';
import { betweennessCentrality, calculateNetworkMetrics } from './lib/graph';
import { 
  INITIAL_SEEDS, fetchStringNetwork, fetchInteractors, GraphData, fetchProteinDetails, ProteinDetails,
  fetchOmnipathInteractions, OmnipathInteraction
} from './lib/api';
import { cn } from './lib/utils';
import { BooleanNetwork, SimState } from './lib/simulation';
import { api, User, Preferences } from './lib/auth';
import { Auth } from './components/Auth';

const ZETA_DEFAULT = 1.0;
const ALL_PATHWAYS = Object.keys(INITIAL_SEEDS);

function getPrimaryCoords(centralityDict: Record<string, number>, zeta: number, selectedPathways: string[]) {
  const coords: Record<string, Complex> = {};
  if (selectedPathways.length === 0) return coords;
  
  const cMax = Math.max(...selectedPathways.map(p => centralityDict[p] || 1.0), 1.0);
  const theta = Array.from({length: selectedPathways.length}, (_, i) => (i * 2 * Math.PI) / selectedPathways.length);
  
  selectedPathways.forEach((node, i) => {
    const r = Math.tanh((cMax - (centralityDict[node] || 0.5)) / (2 * zeta));
    coords[node] = cExp(r, theta[i]);
  });
  return coords;
}

function getSecondaryCoords(
  primaryCoords: Record<string, Complex>, 
  secondaryGraphs: Record<string, GraphData>, 
  localScale: number,
  selectedPathways: string[]
) {
  const nodePositions: Record<string, Complex[]> = {};
  
  for (const p of selectedPathways) {
    const G_s = secondaryGraphs[p];
    const z_p = primaryCoords[p];
    if (!z_p || !G_s || G_s.nodes.length === 0) continue;
    
    const bet = G_s.nodes.length > 1 
      ? betweennessCentrality(G_s.nodes, G_s.edges) 
      : { [G_s.nodes[0]]: 1.0 };
        
    const c_max = Math.max(...Object.values(bet), 1.0);
    const R_i = Math.min(0.25, localScale * Math.log(G_s.nodes.length + 2));
    
    G_s.nodes.forEach(u => {
      const rho = R_i * (1 - (bet[u] || 0) / c_max);
      const phi = (hashString(u) % 1000 / 1000) * 2 * Math.PI;
      const z_local = cExp(rho, phi);
      let z_global = poincareTranslation(z_p, z_local);
      
      const absZ = cAbs(z_global);
      if (absZ >= 1.0) {
        z_global = { r: z_global.r * 0.99 / absZ, i: z_global.i * 0.99 / absZ };
      }
      if (!nodePositions[u]) nodePositions[u] = [];
      nodePositions[u].push(z_global);
    });
  }
  
  const secCoords: Record<string, Complex> = {};
  for (const [u, positions] of Object.entries(nodePositions)) {
    let sumR = 0, sumI = 0;
    for (const pos of positions) {
      sumR += pos.r;
      sumI += pos.i;
    }
    secCoords[u] = {
      r: sumR / positions.length,
      i: sumI / positions.length
    };
  }
  return secCoords;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [zeta, setZeta] = useState(ZETA_DEFAULT);
  const [bloomScale, setBloomScale] = useState(1.8);
  const [primaryCentrality, setPrimaryCentrality] = useState<Record<string, number>>({});
  const [secondaryGraphs, setSecondaryGraphs] = useState<Record<string, GraphData>>({});
  const [globalMetrics, setGlobalMetrics] = useState<{ nodes: number, edges: number, avgClusteringCoefficient: number, avgPathLength: number } | null>(null);
  const hubNodes = useMemo(() => Object.keys(secondaryGraphs), [secondaryGraphs]);
  const [selectedPathways, setSelectedPathways] = useState<string[]>(Object.keys(INITIAL_SEEDS));
  
  const [bloomNode, setBloomNode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<React.ReactNode>("STRING Network Integration Active.");
  
  const [omnipathEdges, setOmnipathEdges] = useState<OmnipathInteraction[]>([]);

  // Boolean Network Simulation Engine
  const [simEngine, setSimEngine] = useState<BooleanNetwork | null>(null);
  const [simState, setSimState] = useState<SimState>({});
  const [knockouts, setKnockouts] = useState<Set<string>>(new Set());
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [isKnockoutMode, setIsKnockoutMode] = useState(false);
  const [simSpeed, setSimSpeed] = useState(500);
  
  const [showExpression, setShowExpression] = useState(false);

  const [loadingString, setLoadingString] = useState(false);
  const [expandingNode, setExpandingNode] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [hoveredProtein, setHoveredProtein] = useState<string | null>(null);
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  const [proteinDetailsCache, setProteinDetailsCache] = useState<Record<string, ProteinDetails>>({});

  // Compute connected nodes for halo effect
  useEffect(() => {
    const newConnected = new Set<string>();
    if (activeNode) {
      if (hubNodes.includes(activeNode)) {
        if (secondaryGraphs[activeNode]) {
          secondaryGraphs[activeNode].nodes.forEach(n => newConnected.add(n));
        }
      } else {
        selectedPathways.forEach(p => {
          const G = secondaryGraphs[p];
          if (G) {
            G.edges.forEach(([u, v]) => {
              if (u === activeNode) newConnected.add(v);
              if (v === activeNode) newConnected.add(u);
            });
          }
        });
      }
    }
    setConnectedNodes(newConnected);
  }, [activeNode, secondaryGraphs, selectedPathways, hubNodes]);

  // Check auth on mount
  useEffect(() => {
    api.getMe().then(u => {
      setUser(u);
      if (u) {
        api.getPreferences().then(prefs => {
          if (prefs) {
            setZeta(prefs.zeta);
            setBloomScale(prefs.bloomScale);
            // Only restore if valid
            if (prefs.selectedPathways && prefs.selectedPathways.length > 0) {
              setSelectedPathways(prefs.selectedPathways);
            }
          }
        }).catch(console.error);
      }
      setAuthLoading(false);
    }).catch(err => {
      console.error(err);
      setAuthLoading(false);
    });
  }, []);

  // Save preferences when they change (debounced)
  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(() => {
      api.savePreferences({ zeta, bloomScale, selectedPathways });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [zeta, bloomScale, selectedPathways, user]);

  // Initial load of STRING data
  useEffect(() => {
    if (user && Object.keys(secondaryGraphs).length === 0) {
      handleRefreshString();
    }
  }, [user]);

  // Setup D3 Zoom
  useEffect(() => {
    if (!user || !svgRef.current || !gRef.current || !containerRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (e) => {
        g.attr('transform', e.transform);
      });
      
    svg.call(zoom);
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2));
  }, [user]);

  // Fetch protein details when active
  useEffect(() => {
    if (activeNode && !hubNodes.includes(activeNode) && !proteinDetailsCache[activeNode]) {
      fetchProteinDetails(activeNode).then(details => {
        if (details) {
          setProteinDetailsCache(prev => ({ ...prev, [activeNode]: details }));
        }
      });
    }
  }, [activeNode, hubNodes, proteinDetailsCache]);

  const updateGlobalCentrality = (graphs: Record<string, GraphData>) => {
    // Merge all currently visible networks to calculate true network centrality
    const allNodes = new Set<string>();
    const allEdges: [string, string][] = [];
    
    Object.values(graphs).forEach(G => {
      G.nodes.forEach(n => allNodes.add(n));
      G.edges.forEach(e => allEdges.push(e));
    });
    
    if (allNodes.size > 0) {
      const globalBet = betweennessCentrality(Array.from(allNodes), allEdges);
      
      // Calculate hub centrality (max centrality of its nodes)
      const hubCentrality: Record<string, number> = {};
      Object.entries(graphs).forEach(([hub, G]) => {
        let maxC = 0;
        G.nodes.forEach(n => {
          if (globalBet[n] > maxC) maxC = globalBet[n];
        });
        hubCentrality[hub] = maxC;
      });
      
      // Normalize hub centrality
      const maxHubC = Math.max(...Object.values(hubCentrality), 1);
      Object.keys(hubCentrality).forEach(h => hubCentrality[h] /= maxHubC);
      
      setPrimaryCentrality(hubCentrality);
      
      // Calculate global network metrics for the dashboard
      const metrics = calculateNetworkMetrics(Array.from(allNodes), allEdges);
      setGlobalMetrics(metrics);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSimRunning && simEngine) {
      interval = setInterval(() => {
        setSimState(simEngine.tick());
      }, simSpeed);
    }
    return () => clearInterval(interval);
  }, [isSimRunning, simEngine, simSpeed]);

  const handleToggleSim = () => {
    if (isSimRunning) {
      setIsSimRunning(false);
      setStatusMsg("Simulation Paused.");
    } else {
      if (!simEngine) {
        const nodes = Object.keys(mappedSecCoords);
        const edges = uniqueEdges.map(([u, v]) => [u, v] as [string, string]);
        const engine = new BooleanNetwork(nodes, edges, omnipathEdges);
        setSimEngine(engine);
        setSimState(engine.state);
      }
      setIsSimRunning(true);
      setStatusMsg(<span className="text-amber-400 font-medium">⚡ Boolean Network Simulation Running...</span>);
    }
  };

  const handleResetSim = () => {
    setIsSimRunning(false);
    const nodes = Object.keys(mappedSecCoords);
    const edges = uniqueEdges.map(([u, v]) => [u, v] as [string, string]);
    const engine = new BooleanNetwork(nodes, edges, omnipathEdges);
    setSimEngine(engine);
    setSimState(engine.state);
    setKnockouts(new Set());
    setStatusMsg("Simulation Reset.");
  };

  const handleRefreshString = async () => {
    setLoadingString(true);
    try {
      const newGraphs: Record<string, GraphData> = {};
      for (const [pathway, seeds] of Object.entries(INITIAL_SEEDS)) {
        newGraphs[pathway] = await fetchStringNetwork(seeds);
      }
      setSecondaryGraphs(newGraphs);
      updateGlobalCentrality(newGraphs);
      setSelectedPathways(Object.keys(newGraphs));
      setStatusMsg(<span className="text-emerald-600 font-medium">✅ Initial PPI network seeded.</span>);
    } catch (e) {
      setStatusMsg(<span className="text-red-600 font-medium">❌ Failed to fetch STRING data.</span>);
    } finally {
      setLoadingString(false);
    }
  };

  const handleExpandNetwork = async (protein: string) => {
    setExpandingNode(protein);
    setStatusMsg(`Fetching direct interactors for ${protein}...`);
    try {
      const newGraph = await fetchInteractors(protein, 15);
      setSecondaryGraphs(prev => {
        const next = { ...prev, [protein]: newGraph };
        updateGlobalCentrality(next);
        return next;
      });
      setSelectedPathways(prev => prev.includes(protein) ? prev : [...prev, protein]);
      setActiveNode(protein); // Switch focus to the new hub
      setBloomNode(protein);
      setStatusMsg(<span className="text-emerald-600 font-medium">✅ Expanded network for {protein}.</span>);
    } catch (e) {
      setStatusMsg(<span className="text-red-600 font-medium">❌ Failed to expand network.</span>);
    } finally {
      setExpandingNode(null);
    }
  };

  const handleNodeClick = (node: string) => {
    setActiveNode(node);
    if (hubNodes.includes(node)) {
      setBloomNode(node);
      setStatusMsg(
        <div className="text-biocyan-400">
          <h5 className="font-bold text-lg mb-1">🌟 Bloomed Hub: {node}</h5>
          <p className="mb-2 text-sm text-slate-300">Live sub-network focus activated.</p>
        </div>
      );
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  const togglePathway = (pathway: string) => {
    setSelectedPathways(prev => 
      prev.includes(pathway) ? prev.filter(p => p !== pathway) : [...prev, pathway]
    );
  };

  const primCoords = useMemo(() => getPrimaryCoords(primaryCentrality, zeta, selectedPathways), [primaryCentrality, zeta, selectedPathways]);
  const secCoords = useMemo(() => {
    const scale = bloomNode ? 0.22 * bloomScale : 0.22;
    return getSecondaryCoords(primCoords, secondaryGraphs, scale, selectedPathways);
  }, [primCoords, secondaryGraphs, bloomNode, bloomScale, selectedPathways]);

  // Möbius Transform Animation State
  const [currentCenter, setCurrentCenter] = useState<Complex>({ r: 0, i: 0 });
  const targetCenterRef = useRef<Complex>({ r: 0, i: 0 });

  useEffect(() => {
    let frame: number;
    const animate = () => {
      setCurrentCenter(prev => {
        const target = targetCenterRef.current;
        const dr = target.r - prev.r;
        const di = target.i - prev.i;
        if (Math.abs(dr) < 1e-4 && Math.abs(di) < 1e-4) {
          // Bail out of state update if we arrived, to not spam re-renders
          if (prev.r === target.r && prev.i === target.i) return prev;
          return { r: target.r, i: target.i };
        }
        return { r: prev.r + dr * 0.08, i: prev.i + di * 0.08 };
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!activeNode) {
      targetCenterRef.current = { r: 0, i: 0 };
      return;
    }
    
    if (hubNodes.includes(activeNode)) {
      targetCenterRef.current = primCoords[activeNode] || { r: 0, i: 0 };
    } else {
      if (secCoords[activeNode]) {
        targetCenterRef.current = secCoords[activeNode];
      }
    }
  }, [activeNode, primCoords, secCoords, hubNodes]);

  // Mapped coordinates applying the Möbius Transformation
  const mappedPrimCoords = useMemo(() => {
    const res: Record<string, Complex> = {};
    for (const [k, v] of Object.entries(primCoords)) {
      res[k] = poincareTranslation({ r: -currentCenter.r, i: -currentCenter.i }, v as Complex);
    }
    return res;
  }, [primCoords, currentCenter]);

  const mappedSecCoords = useMemo(() => {
    const res: Record<string, Complex> = {};
    for (const [k, v] of Object.entries(secCoords)) {
      res[k] = poincareTranslation({ r: -currentCenter.r, i: -currentCenter.i }, v as Complex);
    }
    return res;
  }, [secCoords, currentCenter]);

  const uniqueEdges = useMemo(() => {
    const edgeSet = new Map<string, [string, string, string]>();
    selectedPathways.forEach(p => {
      const G_s = secondaryGraphs[p];
      if (G_s) {
        G_s.edges.forEach(([u, v]) => {
          const key = u < v ? `${u}-${v}` : `${v}-${u}`;
          if (!edgeSet.has(key)) {
             edgeSet.set(key, [u, v, p]);
          }
        });
      }
    });
    return Array.from(edgeSet.values());
  }, [selectedPathways, secondaryGraphs]);

  // Re-fetch Omnipath when network topology changes significantly
  useEffect(() => {
    const allNodesSet = new Set<string>();
    uniqueEdges.forEach(([u, v]) => {
      allNodesSet.add(u);
      allNodesSet.add(v);
    });
    const allNodes = Array.from(allNodesSet);
    if (allNodes.length === 0) return;
    
    // Throttle / debounce omnipath fetching so it doesn't spam on minor changes
    const timeout = setTimeout(() => {
      fetchOmnipathInteractions(allNodes).then(edges => {
        setOmnipathEdges(edges);
        if (edges.length > 0) {
          setStatusMsg(<span className="text-emerald-500 text-xs">Loaded {edges.length} directed regulatory interactions.</span>);
        }
      });
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [uniqueEdges]);

  // Determine opacity for a node based on current selection
  const getNodeOpacity = (node: string, isPathway: boolean) => {
    if (!activeNode) return 1;
    if (node === activeNode) return 1;
    if (isPathway) {
      if (!hubNodes.includes(activeNode)) {
        const inPathway = secondaryGraphs[node]?.nodes.includes(activeNode);
        return inPathway ? 0.8 : 0.2;
      }
      return 0.2;
    }
    return connectedNodes.has(node) ? 1 : 0.2;
  };

  // Color Category Helper
  const getProteinColorCat = (u: string) => {
    const details = proteinDetailsCache[u];
    if (details) {
      if (details.inferredRole === "tumor_suppressor") return "azure";
      if (details.inferredRole === "oncogene") return "crimson";
      if (details.druggable) return "mint";
      return "amber";
    }
    
    // Stable pseudo-random color assignment for un-cached nodes
    const h = hashString(u) % 4;
    return h === 0 ? "azure" : h === 1 ? "mint" : h === 2 ? "amber" : "slate";
  };
  
  const COLOR_HEX: Record<string, string> = {
    azure: "#00B2FF",
    mint: "#00FFC2",
    amber: "#EAB308",
    crimson: "#E11D48",
    slate: "#475569"
  };
  
  const expressionColorScale = useMemo(() => {
    return d3.scaleLinear<string>()
      .domain([-3, 0, 3])
      .range(["#3b82f6", "#334155", "#ef4444"])
      .clamp(true);
  }, []);

  const getNodeColor = (u: string) => {
    if (showExpression) {
      const details = proteinDetailsCache[u];
      if (details && details.expressionLevel !== undefined) {
        return expressionColorScale(details.expressionLevel);
      }
      return "#334155";
    }
    const cat = getProteinColorCat(u);
    return COLOR_HEX[cat];
  };

  const GRADIENT_PAIRS = [
    ['azure', 'mint'], ['azure', 'amber'], ['mint', 'amber'],
    ['azure', 'azure'], ['mint', 'mint'], ['amber', 'amber'],
    ['crimson', 'amber'], ['crimson', 'azure'], ['slate', 'slate']
  ];

  const R = 400; // Increased radius for extra whitespace padding

  if (authLoading) return <div className="min-h-screen bg-obsidian-900 flex items-center justify-center text-slate-300 font-mono">Initializing...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-obsidian-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-obsidian-800 to-obsidian-900 p-6 text-slate-300 font-mono flex flex-col items-center justify-center">
        <div className="text-center space-y-4 mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">
            🌀 Poincaré Disc Explorer
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Secure access required for Live Oncogenic Network Explorer.
          </p>
        </div>
        <Auth onLogin={setUser} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-obsidian-800 to-obsidian-900 p-4 lg:p-6 font-mono text-slate-300 flex overflow-hidden">
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${activeNode && !hubNodes.includes(activeNode) ? 'max-w-[calc(100vw-360px)]' : 'w-full'} h-[calc(100vh-32px)]`}>
        
        {/* Header / Breadcrumbs */}
        <div className="flex justify-between items-center mb-4 z-10 relative px-4 py-3 bg-obsidian-800/60 backdrop-blur-md rounded-xl border border-white/5 shadow-lg">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <span className="text-biocyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">🌀</span> Poincaré Disc
            </h1>
            <div className="h-4 w-px bg-white/20"></div>
            <div className="text-sm font-medium text-slate-400 flex items-center">
              Global <span className="mx-2 opacity-50">›</span> {activeNode ? <span className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">{activeNode}</span> : 'Network View'}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded-md transition-colors border border-white/10"
          >
            <LogOut className="w-3 h-3" />
            Disconnect
          </button>
        </div>

        {/* The Disc Viewer */}
        <div 
          ref={containerRef} 
          className="flex-1 w-full bg-obsidian-900/50 rounded-2xl border border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-sm"
        >
          {/* Status Indicator Top Right */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2 text-xs">
            <div className="flex items-center gap-2 bg-obsidian-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-slate-300">
              <div className={cn("w-2 h-2 rounded-full", loadingString ? "bg-amber-400 animate-pulse" : "bg-bioemerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]")}></div>
              <span>{loadingString ? "Querying STRING..." : "STRING API Active"}</span>
            </div>
            <div className="flex items-center gap-2 bg-obsidian-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-slate-300">
              <div className={cn("w-2 h-2 rounded-full", "bg-biocyan-500 shadow-[0_0_8px_rgba(0,178,255,0.8)]")}></div>
              <span>MyGene API Active</span>
            </div>
            
            {/* Global Network Metrics Dashboard */}
            {globalMetrics && (
              <div className="mt-2 bg-obsidian-800/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] w-56 text-slate-300">
                <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-2">
                  <Database className="w-3 h-3 text-biocyan-400" />
                  Network Topology
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Nodes</span>
                    <span className="font-mono text-white">{globalMetrics.nodes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Edges</span>
                    <span className="font-mono text-white">{globalMetrics.edges}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400" title="Average Path Length">Avg Path</span>
                    <span className="font-mono text-biocyan-400">{globalMetrics.avgPathLength.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400" title="Clustering Coefficient">Clustering</span>
                    <span className="font-mono text-bioemerald-400">{globalMetrics.avgClusteringCoefficient.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <svg ref={svgRef} className="w-full h-full cursor-crosshair active:cursor-grabbing" onClick={() => setActiveNode(null)}>
            <defs>
              <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="glow-emerald" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="glow-rim" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComponentTransfer in="blur" result="glow">
                  <feFuncA type="linear" slope="0.5" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              {/* Chromatic Edge Gradients */}
              {GRADIENT_PAIRS.map(([c1, c2]) => (
                <linearGradient key={`${c1}-${c2}`} id={`grad-${c1}-${c2}`}>
                  <stop offset="0%" stopColor={COLOR_HEX[c1]} />
                  <stop offset="100%" stopColor={COLOR_HEX[c2]} />
                </linearGradient>
              ))}
              {GRADIENT_PAIRS.filter(([c1, c2]) => c1 !== c2).map(([c1, c2]) => (
                <linearGradient key={`${c2}-${c1}`} id={`grad-${c2}-${c1}`}>
                   <stop offset="0%" stopColor={COLOR_HEX[c2]} />
                   <stop offset="100%" stopColor={COLOR_HEX[c1]} />
                </linearGradient>
              ))}
            </defs>
            <g ref={gRef}>
              {/* Grid Background */}
              {[0.2, 0.4, 0.6, 0.8].map(r => (
                <circle key={r} cx={0} cy={0} r={R * r} fill="none" stroke="#22d3ee" strokeWidth={1} strokeOpacity={0.05} />
              ))}
              {Array.from({length: 12}).map((_, i) => {
                const angle = (i * Math.PI) / 6;
                return (
                  <line key={i} x1={0} y1={0} x2={R * Math.cos(angle)} y2={R * Math.sin(angle)} stroke="#22d3ee" strokeWidth={1} strokeOpacity={0.03} />
                );
              })}

              {/* Event Horizon Circle */}
              <circle cx={0} cy={0} r={R} fill="none" stroke="#22d3ee" strokeWidth={2} strokeOpacity={0.4} filter="url(#glow-rim)" />
              
              {/* Primary Nodes (Pathways) */}
              {Object.entries(mappedPrimCoords).map(([node, z]: [string, Complex]) => {
                const centrality = primaryCentrality[node] || 0.5;
                const size = 22 + 28 * centrality;
                const isBloomed = bloomNode === node;
                const opacity = getNodeOpacity(node, true);
                
                return (
                  <g 
                    key={node} 
                    transform={`translate(${z.r * R}, ${-z.i * R})`} 
                    onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }} 
                    className="cursor-pointer transition-opacity duration-500"
                    style={{ opacity }}
                  >
                    <circle 
                      r={size} 
                      fill="rgba(225, 29, 72, 0.15)"
                      stroke={isBloomed ? "#fde047" : "#e11d48"} 
                      strokeOpacity={0.8}
                      strokeWidth={isBloomed ? 3 : 1.5} 
                      filter={isBloomed ? "url(#glow-rim)" : undefined}
                      className="transition-all duration-300 hover:fill-[rgba(225,29,72,0.3)]"
                    />
                    <text 
                      y={-size - 8} 
                      textAnchor="middle" 
                      fontSize={14} 
                      fontWeight="700" 
                      fill="#e2e8f0" 
                      pointerEvents="none"
                      className="select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans"
                    >
                      {node}
                    </text>
                  </g>
                );
              })}

              {/* Pathway Ghost Labels - Behind Nodes */}
              {Object.entries(mappedPrimCoords).map(([node, z]: [string, Complex]) => {
                const isBloomed = bloomNode === node;
                const activeOpacity = getNodeOpacity(node, true);
                // Only render if we form part of the background aesthetic or if hovered
                if (!isBloomed && activeOpacity < 0.5) return null;
                return (
                  <text 
                    key={`ghost-${node}`}
                    x={z.r * R}
                    y={-z.i * R + 5} 
                    textAnchor="middle" 
                    fontSize={52} 
                    fontWeight="800" 
                    fill="#ffffff" 
                    opacity={0.03}
                    pointerEvents="none"
                    className="select-none uppercase tracking-[0.2em] font-sans pointer-events-none"
                  >
                    {node}
                  </text>
                );
              })}

              {/* Edges */}
              {uniqueEdges.map(([u, v, p]) => {
                  const z_u = mappedSecCoords[u];
                  const z_v = mappedSecCoords[v];
                  if (!z_u || !z_v) return null;
                  
                  const isConnectedToActive = activeNode && (u === activeNode || v === activeNode);
                  
                  let strokeColor = isConnectedToActive ? `url(#grad-${getProteinColorCat(u)}-${getProteinColorCat(v)})` : "#475569";
                  let strokeWidth = isConnectedToActive ? 2 : 1;
                  let edgeOpacity = activeNode ? (isConnectedToActive ? 0.7 : 0.05) : 0.3;
                  
                  if (isSimRunning && simEngine) {
                    const weightForward = simEngine.edgeWeights.get(`${u}-${v}`);
                    const weightBackward = simEngine.edgeWeights.get(`${v}-${u}`);
                    const weight = weightForward !== undefined ? weightForward : (weightBackward !== undefined ? weightBackward : 0);
                    
                    const isActiveEdge = simState[u] || simState[v];
                    
                    if (weight === 0) {
                      strokeColor = "#1e293b";
                      strokeWidth = 1;
                      edgeOpacity = 0.1;
                    } else {
                      strokeColor = weight > 0 ? (isActiveEdge ? "#10b981" : "#064e3b") : (isActiveEdge ? "#f43f5e" : "#881337");
                      strokeWidth = isActiveEdge ? 2 : 1;
                      edgeOpacity = isActiveEdge ? 0.7 : 0.15;
                    }
                  }
                  
                  return (
                    <line 
                      key={`${u}-${v}`}
                      x1={z_u.r * R} y1={-z_u.i * R}
                      x2={z_v.r * R} y2={-z_v.i * R}
                      stroke={strokeColor} 
                      strokeWidth={strokeWidth} 
                      strokeDasharray={isConnectedToActive && !isSimRunning ? "none" : (isSimRunning ? ((simEngine?.edgeWeights.get(`${u}-${v}`) ?? simEngine?.edgeWeights.get(`${v}-${u}`) ?? 0) < 0 ? "4,4" : "none") : "3,3")} 
                      opacity={edgeOpacity}
                      className="transition-all duration-500"
                    />
                  );
              })}

              {/* Secondary Nodes */}
              {Object.entries(mappedSecCoords).map(([u, z]: [string, Complex]) => {
                const details = proteinDetailsCache[u];
                const druggable = details ? details.druggable : false;
                const color = getNodeColor(u);
                
                // Calculate global degree for highlighting top nodes
                const degree = uniqueEdges.filter(([a,b]) => a===u || b===u).length;
                const isCentral = degree > 4;

                const size = druggable ? 14 : Math.max(9, 6 + (hoveredProtein === u ? 2 : 0));
                // Bloom intensity based on degree/centrality
                const blurValue = isCentral ? 5 : 2;
                
                const opacity = getNodeOpacity(u, false);
                const isActive = activeNode === u;
                const isHovered = hoveredProtein === u;
                
                const hudSize = size + 8;
                const hudBracket = (
                  <path 
                    d={`M ${-hudSize} ${-hudSize+6} L ${-hudSize} ${-hudSize} L ${-hudSize+6} ${-hudSize} 
                        M ${hudSize} ${-hudSize+6} L ${hudSize} ${-hudSize} L ${hudSize-6} ${-hudSize}
                        M ${-hudSize} ${hudSize-6} L ${-hudSize} ${hudSize} L ${-hudSize+6} ${hudSize}
                        M ${hudSize} ${hudSize-6} L ${hudSize} ${hudSize} L ${hudSize-6} ${hudSize}`}
                    fill="none" stroke={color} strokeWidth="1.5" opacity={0.9} className="animate-pulse"
                  />
                );

                // Radial Label Positioning
                const cx = z.r * R;
                const cy = -z.i * R;
                const distToCenter = Math.sqrt(cx*cx + cy*cy) || 1;
                const ux = cx / distToCenter;
                const uy = cy / distToCenter;
                
                const tetherLen = isActive ? 50 : 30;
                const lx = cx + ux * tetherLen;
                const ly = cy + uy * tetherLen;
                const isRight = cx >= 0;
                
                const showLabel = isActive || isHovered || (activeNode && connectedNodes.has(u)) || (!activeNode && isCentral);

                return (
                  <g key={u} className="transition-all duration-500" style={{ opacity }}>
                    {/* The Radial Tether and Label */}
                    {showLabel && (
                      <g className="pointer-events-none">
                        <line 
                          x1={cx} y1={cy} 
                          x2={lx} y2={ly} 
                          stroke={color} strokeWidth={1} opacity={isActive || isHovered ? 0.6 : 0.2} 
                          strokeDasharray="2,2"
                        />
                        <text 
                          x={lx + (isRight ? 6 : -6)} 
                          y={ly + 4} 
                          textAnchor={isRight ? "start" : "end"} 
                          fontSize={isActive ? 12 : 10} 
                          fontWeight={isActive ? "700" : "500"} 
                          fill={isActive ? "#ffffff" : color} 
                          className="select-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)] transition-all duration-300 font-mono tracking-wide"
                        >
                          {u}
                        </text>
                      </g>
                    )}

                    <g transform={`translate(${cx}, ${cy})`}
                       onMouseEnter={() => setHoveredProtein(u)}
                       onMouseLeave={() => setHoveredProtein(null)}
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         if (isSimRunning && simEngine) {
                           if (isKnockoutMode) {
                             simEngine.toggleKnockout(u);
                             setKnockouts(new Set(simEngine.knockouts));
                           } else {
                             const newState = !simState[u];
                             simEngine.setState(u, newState);
                             setSimState({ ...simEngine.state });
                           }
                         } else {
                           handleNodeClick(u); 
                         }
                       }}
                       className={isSimRunning ? (isKnockoutMode ? "cursor-alias" : "cursor-pointer") : "cursor-crosshair"}
                    >
                      {isActive && !isSimRunning && hudBracket}
                      {/* Simple custom glow mapping dynamically */}
                      <circle 
                        r={size + (isActive && !isSimRunning ? 4 : 0)} 
                        fill={isSimRunning ? (knockouts.has(u) ? "#0f172a" : (simState[u] ? color : "#1e293b")) : color} 
                        stroke={(isActive && !isSimRunning) || (isSimRunning && simState[u]) ? "#ffffff" : (knockouts.has(u) ? "#ef4444" : "#0B0E14")} 
                        strokeWidth={(isActive && !isSimRunning) || (isSimRunning && simState[u]) || knockouts.has(u) ? 2 : 1} 
                        strokeDasharray={knockouts.has(u) ? "2,2" : "none"}
                        className="transition-all duration-300"
                      />
                      {knockouts.has(u) && (
                        <path d={`M ${-size/2} ${-size/2} L ${size/2} ${size/2} M ${size/2} ${-size/2} L ${-size/2} ${size/2}`} stroke="#ef4444" strokeWidth="2" />
                      )}
                      <circle 
                        r={size * 1.5} 
                        fill={color} 
                        opacity={isSimRunning ? (simState[u] ? 0.8 : 0) : (isCentral ? 0.4 : 0.1)} 
                        filter="url(#glow-emerald)" 
                        className="pointer-events-none transition-all duration-300"
                        style={{ filter: `drop-shadow(0 0 ${isSimRunning && simState[u] ? 15 : blurValue*2}px ${color})` }}
                      />
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Neumorphic Control Pod */}
          <div className="absolute bottom-6 left-6 z-10 w-80 bg-obsidian-800/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">
              {omnipathEdges.length > 0 ? "Systems Biology Knockout Engine" : "Illustrative Boolean Engine"}
            </h3>
            <p className={cn("text-[10px] leading-tight mb-2 -mt-1", omnipathEdges.length > 0 ? "text-emerald-500/80" : "text-slate-500")}>
              {omnipathEdges.length > 0 
                ? `*Simulation powered by ${omnipathEdges.length} directed regulatory interactions from OmniPath.`
                : "*Animation based on randomized weights over undirected STRING edges. Not biologically predictive."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleToggleSim}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border",
                  isSimRunning 
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30" 
                    : "bg-biocyan-500/20 text-biocyan-400 border-biocyan-500/50 hover:bg-biocyan-500/30"
                )}
              >
                {isSimRunning ? "Pause Sim" : "Start Sim"}
              </button>
              <button
                onClick={() => setIsKnockoutMode(!isKnockoutMode)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border",
                  isKnockoutMode
                    ? "bg-biocrimson-500/20 text-biocrimson-400 border-biocrimson-500/50 hover:bg-biocrimson-500/30"
                    : "bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700"
                )}
                title="Toggle Knockout Mode (Click nodes to disable them)"
              >
                Knockouts: {isKnockoutMode ? "ON" : "OFF"}
              </button>
              <button
                onClick={handleResetSim}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-white/10 transition-colors"
                title="Reset Simulation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {simEngine && (
              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Sim Speed</span>
                  <span className="text-amber-400 font-bold">{simSpeed}ms</span>
                </div>
                <input 
                  type="range" min="100" max="2000" step="100" value={simSpeed} 
                  onChange={e => setSimSpeed(parseInt(e.target.value))}
                  className="w-full h-1 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            )}
            
            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2 mt-6">Visual Overlays</h3>
            <div>
              <button
                onClick={() => setShowExpression(!showExpression)}
                className={cn(
                  "w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border",
                  showExpression 
                    ? "bg-bioemerald-500/20 text-bioemerald-400 border-bioemerald-500/50 hover:bg-bioemerald-500/30" 
                    : "bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700"
                )}
              >
                {showExpression ? "Hide Gene Expression" : "Show Gene Expression"}
              </button>
            </div>
            
            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2 mt-6">Hyperbolic View</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Spread (ζ)</span>
                  <span className="text-biocyan-400 font-bold">{zeta.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0.5" max="2.5" step="0.1" value={zeta} 
                  onChange={e => setZeta(parseFloat(e.target.value))}
                  className="w-full h-1 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-biocyan-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Bloom Scale</span>
                  <span className="text-biocyan-400 font-bold">{bloomScale.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="1.0" max="3.5" step="0.2" value={bloomScale} 
                  onChange={e => setBloomScale(parseFloat(e.target.value))}
                  className="w-full h-1 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-biocyan-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
               <div className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">Systems</div>
               <div className="flex flex-wrap gap-2">
                 {hubNodes.map(p => (
                   <label key={p} className={cn(
                     "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border cursor-pointer transition-colors",
                     selectedPathways.includes(p) 
                      ? "bg-biocyan-500/10 border-biocyan-500/50 text-biocyan-100" 
                      : "bg-obsidian-900 border-white/10 text-slate-500 hover:text-slate-300"
                   )}>
                     <input type="checkbox" className="hidden" checked={selectedPathways.includes(p)} onChange={() => togglePathway(p)} />
                     {p}
                   </label>
                 ))}
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* Info-Panel Sidebar */}
      {activeNode && !hubNodes.includes(activeNode) && (
        <div className="w-[340px] ml-4 bg-obsidian-800/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5 flex flex-col h-[calc(100vh-32px)] overflow-y-auto custom-scrollbar animate-slide-left relative">
          <button 
            onClick={() => setActiveNode(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-bold font-sans text-white mb-1 tracking-tight">{activeNode}</h2>
          
          {proteinDetailsCache[activeNode] && proteinDetailsCache[activeNode].inferredRole !== "unknown" && (
            <div className="text-sm font-medium text-biocyan-400 mb-6 capitalize flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", 
                proteinDetailsCache[activeNode].inferredRole === 'tumor_suppressor' ? 'bg-biocyan-500' : 'bg-biocrimson-500'
              )}></div>
              {proteinDetailsCache[activeNode].inferredRole?.replace('_', ' ')}
            </div>
          )}

          <div className="space-y-6 flex-1">
            <section>
              <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3 border-b border-white/5 pb-1">Network Context</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Connections:</span>
                  <span className="font-mono text-white">{connectedNodes.size} visible</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Type:</span>
                  <span className="font-mono text-white text-right">
                    {proteinDetailsCache[activeNode]?.druggable ? 'Druggable Kinase/Receptor' : 'Peripheral Target'}
                  </span>
                </div>
                {proteinDetailsCache[activeNode]?.expressionLevel !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Synthetic Exp (Log2FC):</span>
                    <span className={cn(
                      "font-mono font-bold text-right",
                      proteinDetailsCache[activeNode]!.expressionLevel! > 0 ? "text-red-400" : "text-blue-400"
                    )}>
                      {proteinDetailsCache[activeNode]!.expressionLevel! > 0 ? "+" : ""}{proteinDetailsCache[activeNode]!.expressionLevel!.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {proteinDetailsCache[activeNode] ? (
              <section className="animate-fade-in space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-2 border-b border-white/5 pb-1">Function</h3>
                  <p className="text-sm text-slate-300 leading-relaxed font-sans">{proteinDetailsCache[activeNode].summary || "No automated summary available."}</p>
                </div>
                
                {proteinDetailsCache[activeNode].go?.BP && proteinDetailsCache[activeNode].go!.BP!.length > 0 && (
                  <div>
                     <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-2 border-b border-white/5 pb-1">Process Ontology</h3>
                     <ul className="text-xs text-slate-300 space-y-1.5 font-sans">
                        {proteinDetailsCache[activeNode].go!.BP!.slice(0, 4).map((go, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-biocyan-500/50 block mt-0.5">▸</span>
                            <span>{go.term}</span>
                          </li>
                        ))}
                     </ul>
                  </div>
                )}
                
                {proteinDetailsCache[activeNode].disease && proteinDetailsCache[activeNode].disease!.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-2 border-b border-white/5 pb-1">Pathology</h3>
                    <ul className="text-xs text-slate-300 space-y-1.5 font-sans">
                      {proteinDetailsCache[activeNode].disease!.slice(0, 4).map((d, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-biocrimson-500/50 block mt-0.5">▸</span>
                          <span>{d.term}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="pt-4 pb-2 border-t border-white/5">
                  <button 
                    onClick={() => handleExpandNetwork(activeNode)}
                    disabled={expandingNode === activeNode}
                    className="w-full py-2.5 px-4 bg-biocyan-500/10 hover:bg-biocyan-500/20 text-biocyan-400 border border-biocyan-500/30 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {expandingNode === activeNode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Expand Interactors
                  </button>
                </div>
              </section>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-slate-500 animate-pulse">
                <div className="w-5 h-5 border-2 border-t-biocyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-3"></div>
                <span className="text-xs">Querying MyGene.info...</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
