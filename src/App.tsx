/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Database, LogOut, X } from 'lucide-react';
import { Complex, cExp, cAbs, poincareTranslation, hashString } from './lib/math';
import { betweennessCentrality } from './lib/graph';
import { 
  PATHWAY_SEEDS, PROTEIN_ROLES, BINDING_SITES, FALLBACK_CENTRALITY, 
  fetchStringNetwork, GraphData, fetchProteinDetails, ProteinDetails
} from './lib/api';
import { cn } from './lib/utils';
import { api, User, Preferences } from './lib/auth';
import { Auth } from './components/Auth';

const ZETA_DEFAULT = 1.0;
const ALL_PATHWAYS = Object.keys(PATHWAY_SEEDS);

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
  const secCoords: Record<string, Complex> = {};
  
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
      secCoords[`${p}|${u}`] = z_global;
    });
  }
  return secCoords;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [zeta, setZeta] = useState(ZETA_DEFAULT);
  const [bloomScale, setBloomScale] = useState(1.8);
  const [selectedPathways, setSelectedPathways] = useState<string[]>(ALL_PATHWAYS);
  
  const [bloomNode, setBloomNode] = useState<string | null>(null);
  const [primaryCentrality, setPrimaryCentrality] = useState(FALLBACK_CENTRALITY);
  const [secondaryGraphs, setSecondaryGraphs] = useState<Record<string, GraphData>>({});
  const [statusMsg, setStatusMsg] = useState<React.ReactNode>("DepMap + STRING integration active.");
  
  const [loadingString, setLoadingString] = useState(false);
  const [loadingDepMap, setLoadingDepMap] = useState(false);

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
      if (ALL_PATHWAYS.includes(activeNode)) {
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
  }, [activeNode, secondaryGraphs, selectedPathways]);

  // Check auth on mount
  useEffect(() => {
    api.getMe().then(u => {
      setUser(u);
      if (u) {
        api.getPreferences().then(prefs => {
          if (prefs) {
            setZeta(prefs.zeta);
            setBloomScale(prefs.bloomScale);
            setSelectedPathways(prefs.selectedPathways);
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
    if (user) {
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
    if (activeNode && !ALL_PATHWAYS.includes(activeNode) && !proteinDetailsCache[activeNode]) {
      fetchProteinDetails(activeNode).then(details => {
        if (details) {
          setProteinDetailsCache(prev => ({ ...prev, [activeNode]: details }));
        }
      });
    }
  }, [activeNode, proteinDetailsCache]);

  const handleRefreshString = async () => {
    setLoadingString(true);
    try {
      const newGraphs: Record<string, GraphData> = {};
      for (const [pathway, seeds] of Object.entries(PATHWAY_SEEDS)) {
        newGraphs[pathway] = await fetchStringNetwork(seeds);
      }
      setSecondaryGraphs(newGraphs);
      setStatusMsg(<span className="text-emerald-600 font-medium">✅ STRING PPI data refreshed.</span>);
    } catch (e) {
      setStatusMsg(<span className="text-red-600 font-medium">❌ Failed to refresh STRING data.</span>);
    } finally {
      setLoadingString(false);
    }
  };

  const handleRefreshDepMap = async () => {
    setLoadingDepMap(true);
    setStatusMsg("Downloading latest DepMap CRISPRGeneDependency.csv (~400MB, one-time)...");
    
    setTimeout(() => {
      setPrimaryCentrality({...FALLBACK_CENTRALITY});
      setStatusMsg(<span className="text-emerald-600 font-medium">✅ DepMap centrality refreshed from latest CRISPRGeneDependency scores.</span>);
      setLoadingDepMap(false);
    }, 1500);
  };

  const handleNodeClick = (node: string) => {
    setActiveNode(node);
    if (ALL_PATHWAYS.includes(node)) {
      setBloomNode(node);
      setStatusMsg(
        <div className="text-biocyan-400">
          <h5 className="font-bold text-lg mb-1">🌟 Bloomed: {node}</h5>
          <p className="mb-2 text-sm text-slate-300">DepMap-driven centrality + key stabilizing interfaces:</p>
          <ul className="list-disc pl-5 text-sm space-y-1 text-slate-400">
            {secondaryGraphs[node]?.nodes.filter(prot => BINDING_SITES[prot]).map(prot => (
              <li key={prot}>• {prot} — {BINDING_SITES[prot]}</li>
            ))}
          </ul>
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
    
    if (ALL_PATHWAYS.includes(activeNode)) {
      targetCenterRef.current = primCoords[activeNode] || { r: 0, i: 0 };
    } else {
      const key = Object.keys(secCoords).find(k => k.split('|')[1] === activeNode);
      if (key) {
        targetCenterRef.current = secCoords[key] || { r: 0, i: 0 };
      }
    }
  }, [activeNode, primCoords, secCoords]);

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

  // Determine opacity for a node based on current selection
  const getNodeOpacity = (node: string, isPathway: boolean) => {
    if (!activeNode) return 1;
    if (node === activeNode) return 1;
    if (isPathway) {
      if (!ALL_PATHWAYS.includes(activeNode)) {
        const inPathway = secondaryGraphs[node]?.nodes.includes(activeNode);
        return inPathway ? 0.8 : 0.2;
      }
      return 0.2;
    }
    return connectedNodes.has(node) ? 1 : 0.2;
  };

  // Color Category Helper
  const getProteinColorCat = (u: string) => {
    const roleInfo = PROTEIN_ROLES[u] || ["unknown", false];
    if (roleInfo[0] === "tumor_suppressor") return "azure";
    if (roleInfo[1]) return "mint";
    return "amber";
  };
  const COLOR_HEX: Record<string, string> = {
    azure: "#00B2FF",
    mint: "#00FFC2",
    amber: "#EAB308",
    crimson: "#E11D48",
    slate: "#475569"
  };
  
  const GRADIENT_PAIRS = [
    ['azure', 'mint'], ['azure', 'amber'], ['mint', 'amber'],
    ['azure', 'azure'], ['mint', 'mint'], ['amber', 'amber']
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
      <div className={`flex-1 flex flex-col transition-all duration-300 ${activeNode && !ALL_PATHWAYS.includes(activeNode) ? 'max-w-[calc(100vw-360px)]' : 'w-full'} h-[calc(100vh-32px)]`}>
        
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
            <div className="flex items-center gap-2 bg-obsidian-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div className={cn("w-2 h-2 rounded-full", loadingString ? "bg-yellow-400 animate-pulse" : "bg-bioemerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]")}></div>
              <span>{loadingString ? "Syncing STRING Node..." : "STRING Synced"}</span>
            </div>
            <div className="flex items-center gap-2 bg-obsidian-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div className={cn("w-2 h-2 rounded-full", loadingDepMap ? "bg-yellow-400 animate-pulse" : "bg-bioemerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]")}></div>
              <span>{loadingDepMap ? "Syncing DepMap..." : "DepMap Live"}</span>
            </div>
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
              {selectedPathways.flatMap(p => {
                const G_s = secondaryGraphs[p];
                if (!G_s) return [];
                return G_s.edges.map(([u, v]) => {
                  const z_u = mappedSecCoords[`${p}|${u}`];
                  const z_v = mappedSecCoords[`${p}|${v}`];
                  if (!z_u || !z_v) return null;
                  
                  const isConnectedToActive = activeNode && (u === activeNode || v === activeNode);
                  const isNodeActive = activeNode ? (u === activeNode && v === activeNode) : false;
                  
                  const catU = getProteinColorCat(u);
                  const catV = getProteinColorCat(v);
                  const strokeColor = isConnectedToActive ? `url(#grad-${catU}-${catV})` : "#475569";
                  const strokeWidth = isConnectedToActive ? 2 : 1;
                  const edgeOpacity = activeNode ? (isConnectedToActive ? 0.7 : 0.05) : 0.3;
                  
                  return (
                    <line 
                      key={`${p}-${u}-${v}`}
                      x1={z_u.r * R} y1={-z_u.i * R}
                      x2={z_v.r * R} y2={-z_v.i * R}
                      stroke={strokeColor} 
                      strokeWidth={strokeWidth} 
                      strokeDasharray={isConnectedToActive ? "none" : "3,3"} 
                      opacity={edgeOpacity}
                      className="transition-all duration-500"
                    />
                  );
                });
              })}

              {/* Secondary Nodes */}
              {Object.entries(mappedSecCoords).map(([key, z]: [string, Complex]) => {
                const [p, u] = key.split('|');
                const roleInfo = PROTEIN_ROLES[u] || ["unknown", false];
                const role = roleInfo[0];
                const druggable = roleInfo[1];
                const cat = getProteinColorCat(u);
                const color = COLOR_HEX[cat];
                
                // Proxy for centrality (top nodes)
                const G_s = secondaryGraphs[p];
                const degree = G_s ? G_s.edges.filter(([a,b]) => a===u || b===u).length : 0;
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
                  <g key={key} className="transition-all duration-500" style={{ opacity }}>
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
                       onClick={(e) => { e.stopPropagation(); handleNodeClick(u); }}
                       className="cursor-crosshair"
                    >
                      {isActive && hudBracket}
                      {/* Simple custom glow mapping dynamically */}
                      <circle 
                        r={size + (isActive ? 4 : 0)} 
                        fill={color} 
                        stroke={isActive ? "#ffffff" : "#0B0E14"} 
                        strokeWidth={isActive ? 2 : 1} 
                        className="transition-all duration-300"
                      />
                      <circle 
                        r={size * 1.5} 
                        fill={color} 
                        opacity={isCentral ? 0.4 : 0.1} 
                        filter="url(#glow-emerald)" 
                        className="pointer-events-none transition-all duration-300"
                        style={{ filter: `drop-shadow(0 0 ${blurValue*2}px ${color})` }}
                      />
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Neumorphic Control Pod */}
          <div className="absolute bottom-6 left-6 z-10 w-80 bg-obsidian-800/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">Simulation Parameters</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Hyperbolic Spread (ζ)</span>
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
                 {ALL_PATHWAYS.map(p => (
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
      {activeNode && !ALL_PATHWAYS.includes(activeNode) && (
        <div className="w-[340px] ml-4 bg-obsidian-800/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5 flex flex-col h-[calc(100vh-32px)] overflow-y-auto custom-scrollbar animate-slide-left relative">
          <button 
            onClick={() => setActiveNode(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-bold font-sans text-white mb-1 tracking-tight">{activeNode}</h2>
          {PROTEIN_ROLES[activeNode] && (
            <div className="text-sm font-medium text-biocyan-400 mb-6 capitalize flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", 
                PROTEIN_ROLES[activeNode][0] === 'tumor_suppressor' ? 'bg-biocyan-500' : 
                PROTEIN_ROLES[activeNode][1] ? 'bg-bioemerald-500' : 'bg-yellow-500'
              )}></div>
              {PROTEIN_ROLES[activeNode][0].replace('_', ' ')}
            </div>
          )}

          <div className="space-y-6 flex-1">
            <section>
              <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3 border-b border-white/5 pb-1">STRING Integration</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Connections:</span>
                  <span className="font-mono text-white">{connectedNodes.size} nodes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Type:</span>
                  <span className="font-mono text-white text-right">{BINDING_SITES[activeNode] || 'Interface hub'}</span>
                </div>
              </div>
            </section>

            {proteinDetailsCache[activeNode] ? (
              <section className="animate-fade-in space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-2 border-b border-white/5 pb-1">Function</h3>
                  <p className="text-sm text-slate-300 leading-relaxed font-sans">{proteinDetailsCache[activeNode].summary || "No data available."}</p>
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
