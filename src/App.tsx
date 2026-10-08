/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import html2canvas from 'html2canvas';
import { Database, LogOut, Loader2, Camera, Check, Download, Settings } from 'lucide-react';
import { Complex, cExp, cAbs, poincareTranslation, hashString } from './lib/math';
import { betweennessCentrality, calculateNetworkMetrics } from './lib/graph';
import { 
  INITIAL_SEEDS, fetchStringNetwork, fetchInteractors, GraphData, fetchProteinDetails, ProteinDetails,
  fetchOmnipathInteractions, fetchContexts, fetchMeasurements, OmnipathInteraction
} from './lib/api';
import { cn } from './lib/utils';
import { api, User } from './lib/auth';
import { Auth } from './components/Auth';
import { ProteinInfoPanel } from './components/ProteinInfoPanel';
import { GeneSearch } from './components/GeneSearch';
import { SettingsPanel } from './components/SettingsPanel';
import { PAN_CANCER_ID, PAN_CANCER_LABEL, type GeneContextMeasurement } from './lib/measurements';
import { buildViewExport, signsForEdge } from './lib/exportView';
import { SETTINGS, defaultPreferences, edgeWidth, validatePreferences, type Preferences } from './lib/settingsRegistry';

function releaseToken(release: string | null): string {
  if (release == null) return "cache not built";
  if (release.length === 0) return "release unavailable";
  return release;
}

function pngStamp(prefs: Preferences, contextLabel: string, release: string | null, date: string) {
  return `POINCARÉ DISC • ${prefs.visualMode} • ${contextLabel} • STRING ${prefs.stringSpecies} score≥${prefs.stringRequiredScore} partners≥${prefs.stringPartnerScore} • DepMap ${releaseToken(release)} • ${date}`;
}

function edgeRegulation(interactions: OmnipathInteraction[], source: string, target: string): "stimulation" | "inhibition" | "both" | "none" {
  const signs = signsForEdge(source, target, interactions);
  let stimulation = false;
  let inhibition = false;
  for (const sign of signs) {
    if (sign.is_stimulation) stimulation = true;
    if (sign.is_inhibition) inhibition = true;
  }
  if (stimulation && inhibition) return "both";
  if (stimulation) return "stimulation";
  if (inhibition) return "inhibition";
  return "none";
}

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

  const [applied, setApplied] = useState<Preferences>(() => defaultPreferences());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const [operatorInfo, setOperatorInfo] = useState<Record<string, unknown> | null>(null);
  const [operatorError, setOperatorError] = useState<string | null>(null);
  const [stringError, setStringError] = useState<string | null>(null);
  const lastGoodGraphs = useRef<Record<string, GraphData> | null>(null);
  const stringBootstrapped = useRef(false);
  const [zeta, setZeta] = useState(defaultPreferences().zeta);
  const [bloomScale, setBloomScale] = useState(defaultPreferences().bloomScale);
  const [primaryCentrality, setPrimaryCentrality] = useState<Record<string, number>>({});
  const [secondaryGraphs, setSecondaryGraphs] = useState<Record<string, GraphData>>({});
  const [globalMetrics, setGlobalMetrics] = useState<{ nodes: number, edges: number, avgClusteringCoefficient: number, avgPathLength: number } | null>(null);
  const hubNodes = useMemo(() => Object.keys(secondaryGraphs), [secondaryGraphs]);
  const [selectedPathways, setSelectedPathways] = useState<string[]>(Object.keys(INITIAL_SEEDS));
  
  const [bloomNode, setBloomNode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<React.ReactNode>("STRING Network Integration Active.");
  
  const [omnipathEdges, setOmnipathEdges] = useState<OmnipathInteraction[]>([]);
  const [omnipathError, setOmnipathError] = useState<string | null>(null);
  const [omnipathForKey, setOmnipathForKey] = useState<string | null>(null);
  const omnipathFetchGen = useRef(0);
  const savedPathwaysRef = useRef<string[] | null>(null);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [contextId, setContextId] = useState(PAN_CANCER_ID);
  const [contexts, setContexts] = useState<{ id: string; label: string }[]>([
    { id: PAN_CANCER_ID, label: PAN_CANCER_LABEL },
  ]);
  const [depmapRelease, setDepmapRelease] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Record<string, GeneContextMeasurement | null>>({});
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [visualMode, setVisualMode] = useState<Preferences["visualMode"]>("chronos");
  const effective: Preferences = { ...applied, zeta, bloomScale, selectedPathways, context: contextId, visualMode };
  const prefsRef = useRef(effective);
  prefsRef.current = effective;
  const graphsRef = useRef(secondaryGraphs);
  graphsRef.current = secondaryGraphs;

  const [loadingString, setLoadingString] = useState(false);
  const [expandingNode, setExpandingNode] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const discExportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [hoveredProtein, setHoveredProtein] = useState<string | null>(null);
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  const [proteinDetailsCache, setProteinDetailsCache] = useState<Record<string, ProteinDetails>>({});

  // Gene Search & Highlight State
  const [searchedGene, setSearchedGene] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlightedPathways, setHighlightedPathways] = useState<string[]>([]);

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
            const checked = validatePreferences(prefs);
            const next = checked.ok ? checked.value : defaultPreferences();
            setApplied(next);
            setZeta(next.zeta);
            setBloomScale(next.bloomScale);
            if (next.selectedPathways.length > 0) {
              savedPathwaysRef.current = next.selectedPathways;
              setSelectedPathways(next.selectedPathways);
            }
            setContextId(next.context);
            setVisualMode(next.visualMode);
          }
          setPrefsHydrated(true);
        }).catch(() => setPrefsHydrated(true));
      } else {
        setPrefsHydrated(true);
      }
      setAuthLoading(false);
    }).catch(err => {
      console.error(err);
      setPrefsHydrated(true);
      setAuthLoading(false);
    });
  }, []);

  // Save preferences when they change (debounced). Wait until the saved
  // selection has been restored so the seed fetch cannot overwrite it.
  const prefsKey = JSON.stringify(effective);
  useEffect(() => {
    if (!user || !prefsHydrated) return;
    const timeout = setTimeout(() => {
      api.savePreferences(prefsRef.current).catch(() => {});
    }, 1000);
    return () => clearTimeout(timeout);
  }, [prefsKey, user, prefsHydrated]);

  useEffect(() => {
    if (!settingsOpen || !user) return;
    api.getOperator().then(info => {
      setOperatorInfo(info);
      setOperatorError(null);
    }).catch(error => {
      setOperatorError(error instanceof Error ? error.message : "Operator readout failed");
    });
  }, [settingsOpen, user]);

  // Initial load of STRING data waits until saved preferences are restored.
  useEffect(() => {
    if (!user || !prefsHydrated || stringBootstrapped.current) return;
    stringBootstrapped.current = true;
    handleRefreshString();
  }, [user, prefsHydrated]);

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
    if (activeNode && !proteinDetailsCache[activeNode]) {
      fetchProteinDetails(activeNode, prefsRef.current.mygeneFields).then(details => {
        if (details) {
          setProteinDetailsCache(prev => ({ ...prev, [activeNode]: details }));
        }
      });
    }
  }, [activeNode, proteinDetailsCache]);

  const updateGlobalCentrality = (graphs: Record<string, GraphData>) => {
    // Merge all currently visible networks to calculate true network centrality
    const allNodes = new Set<string>();
    const allEdges: [string, string][] = [];
    const seenEdges = new Set<string>();
    
    Object.values(graphs).forEach(G => {
      G.nodes.forEach(n => allNodes.add(n));
      G.edges.forEach(([u, v]) => {
        if (u === v) return;
        const key = u < v ? `${u}|${v}` : `${v}|${u}`;
        if (seenEdges.has(key)) return;
        seenEdges.add(key);
        allEdges.push([u, v]);
      });
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

  const handleRefreshString = async (prefs: Preferences = prefsRef.current) => {
    setLoadingString(true);
    try {
      const newGraphs: Record<string, GraphData> = {};
      const errors: string[] = [];
      let usedPrevious = false;
      const absorb = (key: string, result: Awaited<ReturnType<typeof fetchStringNetwork>>) => {
        if (result.error) {
          errors.push(result.error);
          const previous = lastGoodGraphs.current?.[key];
          if (prefs.fallbackStringError === "keep-last-graph" && previous) {
            newGraphs[key] = previous;
            usedPrevious = true;
          } else {
            newGraphs[key] = result.graph;
          }
        } else {
          newGraphs[key] = result.graph;
        }
      };
      for (const [pathway, seeds] of Object.entries(prefs.initialSeeds)) {
        absorb(pathway, await fetchStringNetwork(seeds, prefs.stringNetworkLimit, prefs.stringSpecies, prefs.stringRequiredScore));
      }
      for (const hub of Object.keys(graphsRef.current)) {
        if (hub in newGraphs) continue;
        absorb(hub, await fetchInteractors(hub, prefs.stringExpandLimit, prefs.stringSpecies, prefs.stringPartnerScore));
      }
      setSecondaryGraphs(newGraphs);
      updateGlobalCentrality(newGraphs);
      const available = Object.keys(newGraphs);
      setSelectedPathways(prev => {
        const preferred = savedPathwaysRef.current ?? prev;
        savedPathwaysRef.current = null;
        const kept = preferred.filter(p => available.includes(p));
        return kept.length > 0 ? kept : available;
      });
      if (errors.length > 0) {
        const note = usedPrevious
          ? `${errors[0]}. The drawn graph is the previous success.`
          : errors[0];
        setStringError(note);
        setStatusMsg(<span className="text-red-600 font-medium">{note}</span>);
      } else {
        lastGoodGraphs.current = newGraphs;
        setStringError(null);
        setStatusMsg(<span className="text-emerald-600 font-medium">✅ Initial PPI network seeded.</span>);
      }
    } catch (e) {
      const note = e instanceof Error ? e.message : "Failed to fetch STRING data.";
      setStringError(note);
      setStatusMsg(<span className="text-red-600 font-medium">{note}</span>);
    } finally {
      setLoadingString(false);
    }
  };

  const handleExpandNetwork = async (protein: string) => {
    const prefs = prefsRef.current;
    setExpandingNode(protein);
    setStatusMsg(`Fetching direct interactors for ${protein}...`);
    try {
      const result = await fetchInteractors(protein, prefs.stringExpandLimit, prefs.stringSpecies, prefs.stringPartnerScore);
      if (result.error) {
        const note = prefs.fallbackStringError === "keep-last-graph" && secondaryGraphs[protein]
          ? `${result.error}. The drawn graph is the previous success.`
          : result.error;
        setStringError(note);
        setStatusMsg(<span className="text-red-600 font-medium">{note}</span>);
        if (!(prefs.fallbackStringError === "keep-last-graph" && secondaryGraphs[protein])) {
          setSecondaryGraphs(prev => ({ ...prev, [protein]: result.graph }));
        }
        return;
      }
      setStringError(null);
      setSecondaryGraphs(prev => {
        const next = { ...prev, [protein]: result.graph };
        updateGlobalCentrality(next);
        lastGoodGraphs.current = next;
        return next;
      });
      setSelectedPathways(prev => prev.includes(protein) ? prev : [...prev, protein]);
      setActiveNode(protein);
      setBloomNode(protein);
      setStatusMsg(<span className="text-emerald-600 font-medium">✅ Expanded network for {protein}.</span>);
    } catch (e) {
      const note = e instanceof Error ? e.message : "Failed to expand network.";
      setStringError(note);
      setStatusMsg(<span className="text-red-600 font-medium">{note}</span>);
    } finally {
      setExpandingNode(null);
    }
  };

  const commitPreferences = async (next: Preferences, refresh: boolean, keepDisc = true) => {
    const checked = validatePreferences(keepDisc ? { ...next, zeta, bloomScale, selectedPathways, context: contextId, visualMode } : next);
    if (checked.ok === false) {
      setSettingsError(checked.error);
      return;
    }
    setSettingsError(null);
    if (keepDisc) {
      const allowed = new Set([...Object.keys(checked.value.initialSeeds), ...Object.keys(graphsRef.current)]);
      checked.value.selectedPathways = checked.value.selectedPathways.filter(pathway => allowed.has(pathway));
    }
    setApplied(checked.value);
    setZeta(checked.value.zeta);
    setBloomScale(checked.value.bloomScale);
    setSelectedPathways(checked.value.selectedPathways);
    setContextId(checked.value.context);
    setVisualMode(checked.value.visualMode);
    prefsRef.current = checked.value;
    try {
      await api.savePreferences(checked.value);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not save preferences");
      return;
    }
    if (!keepDisc) savedPathwaysRef.current = checked.value.selectedPathways;
    if (refresh) await handleRefreshString(checked.value);
    if (refresh && activeNode) {
      const details = await fetchProteinDetails(activeNode, checked.value.mygeneFields);
      if (details) setProteinDetailsCache(prev => ({ ...prev, [activeNode]: details }));
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

  // Export Poincaré Disc SVG as PNG using html2canvas for research documentation
  const handleExportPNG = async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    try {
      const targetElement = discExportRef.current || (svgRef.current as unknown as HTMLElement);
      
      // Primary export with html2canvas library
      const canvas = await html2canvas(targetElement, {
        backgroundColor: prefsRef.current.background,
        scale: 2, // 2x high resolution for publication and research figures
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      // Overlay research documentation stamp at bottom
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = 'bold 13px "JetBrains Mono", Menlo, Consolas, monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        const dateStr = new Date().toISOString().slice(0, 10);
        const docText = pngStamp(prefsRef.current, contextLabel, depmapRelease, dateStr);
        ctx.fillText(docText, 24, canvas.height - 20);
        ctx.restore();
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const modeName = visualMode === "expression" ? "expression" : visualMode === "chronos" ? "chronos" : "roles";
      link.download = `poincare-disc-${modeName}-${timestamp}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.warn('html2canvas primary export encountered error, using direct SVG canvas rasterization fallback:', err);
      try {
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const width = Math.max(800, Math.round(rect.width));
        const height = Math.max(600, Math.round(rect.height));
        const svgClone = svg.cloneNode(true) as SVGSVGElement;
        svgClone.setAttribute('width', `${width}`);
        svgClone.setAttribute('height', `${height}`);
        if (!svgClone.getAttribute('xmlns')) {
          svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const blobURL = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = prefsRef.current.background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            ctx.font = 'bold 13px "JetBrains Mono", Menlo, Consolas, monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            const dateStr = new Date().toISOString().slice(0, 10);
            const docText = pngStamp(prefsRef.current, contextLabel, depmapRelease, dateStr);
            ctx.fillText(docText, 24, canvas.height - 20);

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `poincare-disc-${visualMode}-${timestamp}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
          }
          URL.revokeObjectURL(blobURL);
        };
        img.src = blobURL;
      } catch (fallbackErr) {
        console.error('Failed to export Poincaré disc PNG:', fallbackErr);
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Compute all available genes across all loaded subgraphs and initial seeds
  const availableGenes = useMemo(() => {
    const set = new Set<string>();
    (Object.values(secondaryGraphs) as GraphData[]).forEach(g => {
      if (g && g.nodes) {
        g.nodes.forEach(n => set.add(n));
      }
    });
    Object.values(effective.initialSeeds).forEach(seeds => {
      seeds.forEach(s => set.add(s));
    });
    return Array.from(set).sort();
  }, [secondaryGraphs, effective.initialSeeds]);

  // Compute connected pathways for the active node
  const activeNodePathways = useMemo(() => {
    if (!activeNode) return [];
    const pathways = new Set<string>();
    (Object.entries(secondaryGraphs) as [string, GraphData][]).forEach(([pathway, G]) => {
      if (G && G.nodes && G.nodes.includes(activeNode)) pathways.add(pathway);
    });
    Object.entries(effective.initialSeeds).forEach(([pathway, seeds]) => {
      if (seeds.includes(activeNode)) pathways.add(pathway);
    });
    if (proteinDetailsCache[activeNode]?.pathways) {
      proteinDetailsCache[activeNode].pathways!.forEach(p => {
        if (secondaryGraphs[p] || effective.initialSeeds[p]) pathways.add(p);
      });
    }
    return Array.from(pathways);
  }, [activeNode, secondaryGraphs, proteinDetailsCache, effective.initialSeeds]);

  // Gene Search Handler
  const handleGeneSearch = (query: string) => {
    const clean = query.trim().toUpperCase();
    if (!clean) {
      setSearchedGene(null);
      setSearchError(null);
      setHighlightedPathways([]);
      return;
    }

    // Search across secondary graph nodes, availableGenes, and hub nodes
    const allKnown = Array.from(new Set([
      ...Object.keys(secCoords),
      ...availableGenes,
      ...hubNodes
    ]));

    const matched = allKnown.find(g => g.toUpperCase() === clean);

    if (matched) {
      setSearchError(null);
      setSearchedGene(matched);

      // Identify pathways it belongs to
      const pathwaysFound = new Set<string>();
      (Object.entries(secondaryGraphs) as [string, GraphData][]).forEach(([p, G]) => {
        if (G && G.nodes && G.nodes.some(n => n.toUpperCase() === clean)) {
          pathwaysFound.add(p);
        }
      });
      Object.entries(effective.initialSeeds).forEach(([p, seeds]) => {
        if (seeds.some(s => s.toUpperCase() === clean)) {
          pathwaysFound.add(p);
        }
      });
      if (hubNodes.includes(matched)) {
        pathwaysFound.add(matched);
      }

      const pwList = Array.from(pathwaysFound);
      setHighlightedPathways(pwList);

      // Ensure all connected pathways are selected in selectedPathways so user sees them
      if (pwList.length > 0) {
        setSelectedPathways(prev => {
          const next = new Set(prev);
          pwList.forEach(p => next.add(p));
          return Array.from(next);
        });
      }

      // Activate node to open detailed info panel
      setActiveNode(matched);

      // Smooth translation to bring gene into focus
      const targetPos = secCoords[matched] || primCoords[matched];
      if (targetPos) {
        targetCenterRef.current = targetPos;
      }

      setStatusMsg(
        <span className="text-biocyan-400 font-medium">
          🎯 Found <strong className="text-white">{matched}</strong> &mdash; Connected to{' '}
          {pwList.length > 0 ? pwList.join(', ') : 'network'}
        </span>
      );
    } else {
      // Must display 'Gene not found' message as specified by prompt
      setSearchError(`Gene not found`);
      setSearchedGene(null);
      setHighlightedPathways([]);
      setStatusMsg(
        <span className="text-rose-400 font-medium">
          ⚠️ Gene not found: "{query}". Try KRAS, TP53, PIK3CA, CDK4, etc.
        </span>
      );
    }
  };

  const handleClearSearch = () => {
    setSearchedGene(null);
    setSearchError(null);
    setHighlightedPathways([]);
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
    const edgeSet = new Map<string, [string, string, string, number | null]>();
    selectedPathways.forEach(p => {
      const G_s = secondaryGraphs[p];
      if (G_s) {
        G_s.edges.forEach(([u, v, score]) => {
          const key = u < v ? `${u}-${v}` : `${v}-${u}`;
          const existing = edgeSet.get(key);
          const rank = (value: number | null) => value == null ? -1 : value;
          if (!existing || rank(score) > rank(existing[3])) {
             edgeSet.set(key, [u, v, p, score]);
          }
        });
      }
    });
    return Array.from(edgeSet.values());
  }, [selectedPathways, secondaryGraphs]);

  const simNodes = useMemo(() => {
    const nodes = new Set<string>();
    selectedPathways.forEach(p => {
      secondaryGraphs[p]?.nodes.forEach(n => nodes.add(n));
    });
    uniqueEdges.forEach(([u, v]) => {
      nodes.add(u);
      nodes.add(v);
    });
    return Array.from(nodes);
  }, [selectedPathways, secondaryGraphs, uniqueEdges]);

  const edgeKey = useMemo(() => {
    const keys = uniqueEdges.map(([u, v]) => (u < v ? `${u}|${v}` : `${v}|${u}`));
    keys.sort();
    return keys.join(",");
  }, [uniqueEdges]);

  useEffect(() => {
    if (!user) return;
    fetchContexts().then(result => {
      if ("error" in result) {
        setMeasurementError(result.error);
        return;
      }
      setContexts(result.contexts);
      setDepmapRelease(result.release);
      setMeasurementError(null);
    });
  }, [user]);

  useEffect(() => {
    if (!user || simNodes.length === 0) return;
    let cancelled = false;
    fetchMeasurements(simNodes, contextId).then(result => {
      if (cancelled) return;
      if ("error" in result) {
        setMeasurementError(result.error);
        setMeasurements({});
        return;
      }
      setMeasurementError(null);
      setDepmapRelease(result.release);
      setMeasurements(result.genes);
    });
    return () => { cancelled = true; };
  }, [user, simNodes, contextId]);

  // Re-fetch OmniPath signs through the server when the visible edge set changes.
  useEffect(() => {
    const generation = ++omnipathFetchGen.current;
    if (edgeKey === "") {
      setOmnipathEdges([]);
      setOmnipathError(null);
      setOmnipathForKey("");
      return;
    }
    setOmnipathForKey(null);
    const keyAtFetch = edgeKey;
    if (effective.omnipathDatasets.length === 0) {
      setOmnipathEdges([]);
      setOmnipathError(null);
      setOmnipathForKey(edgeKey);
      return;
    }
    const nodes = simNodes;
    const datasets = effective.omnipathDatasets;
    const timeout = setTimeout(() => {
      fetchOmnipathInteractions(nodes, datasets).then(result => {
        if (generation !== omnipathFetchGen.current) return;
        setOmnipathForKey(keyAtFetch);
        if (!result.ok) {
          setOmnipathEdges([]);
          setOmnipathError("error" in result ? result.error : "OmniPath proxy failed");
          return;
        }
        setOmnipathError(null);
        setOmnipathEdges(result.interactions);
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [edgeKey, simNodes, effective.omnipathDatasets]);

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
  
  const chronosColorScale = useMemo(() => {
    return d3.scaleLinear<string>()
      .domain(effective.chronosDomain)
      .range(effective.chronosRange)
      .clamp(effective.chronosClamp);
  }, [effective.chronosDomain, effective.chronosRange, effective.chronosClamp]);

  const expressionColorScale = useMemo(() => {
    return d3.scaleLinear<string>()
      .domain(effective.expressionDomain)
      .range(effective.expressionRange)
      .clamp(effective.expressionClamp);
  }, [effective.expressionDomain, effective.expressionRange, effective.expressionClamp]);

  const getNodeColor = (u: string) => {
    const measurement = measurements[u.toUpperCase()];
    if (visualMode === "chronos") {
      if (measurement?.chronosMean == null) return effective.missingColor;
      return chronosColorScale(measurement.chronosMean);
    }
    if (visualMode === "expression") {
      if (measurement?.exprMean == null) return effective.missingColor;
      return expressionColorScale(measurement.exprMean);
    }
    if (!proteinDetailsCache[u] && effective.fallbackRoleUncached === "missing") return effective.missingColor;
    const cat = getProteinColorCat(u) as keyof Preferences["rolePalette"];
    return effective.rolePalette[cat] ?? effective.missingColor;
  };

  const contextLabel = contexts.find(item => item.id === contextId)?.label ?? PAN_CANCER_LABEL;
  const signedEdgeCount = uniqueEdges.filter(([u, v]) => signsForEdge(u, v, omnipathEdges).length > 0).length;
  const chronosEnds = `${effective.chronosDomain[0]}, ${effective.chronosDomain[effective.chronosDomain.length - 1]}`;
  const expressionStart = effective.expressionDomain[0];
  const expressionEnd = effective.expressionDomain[effective.expressionDomain.length - 1];
  const rolePolicy = effective.fallbackRoleUncached === "hash"
    ? "Uncached genes use placeholder colors from a hash of the symbol. Those colors are not curated roles."
    : "Uncached genes use the missing measurement color.";
  const measurementCaption = visualMode === "chronos"
    ? `Mean Chronos gene effect in ${contextLabel}. More negative means stronger dependency. n is the number of cell lines with a score. ${effective.chronosClamp ? `Display clamped to [${chronosEnds}].` : `Display domain is [${chronosEnds}], not clamped.`}`
    : visualMode === "expression"
    ? `Mean log2(TPM+1) in ${contextLabel}. The DepMap file is already log-transformed. ${effective.expressionClamp ? `Display clamped to ${expressionStart}–${expressionEnd}.` : `Display domain is ${expressionStart} to ${expressionEnd}, not clamped.`}`
    : `Curated role colors. These are annotations, not a DepMap measurement. ${rolePolicy}`;
  const provenanceLine = `DepMap ${releaseToken(depmapRelease)} · ${contextLabel} · STRING ${effective.stringSpecies}, network ≥ ${effective.stringRequiredScore}, partners ≥ ${effective.stringPartnerScore}, partner limit ${effective.stringPartnerLimit}, expand ${effective.stringExpandLimit}, network limit ${effective.stringNetworkLimit}, scale 0–1000 · MyGene human`;

  const handleExportJson = () => {
    const payload = buildViewExport({
      generatedAt: new Date().toISOString(),
      context: { id: contextId, label: contextLabel },
      depmapRelease,
      nodes: simNodes,
      measurements,
      edges: uniqueEdges.map(([source, target, pathway, stringScore]) => ({
        source,
        target,
        pathway,
        stringScore,
      })),
      omnipathInteractions: omnipathEdges,
      omnipathError,
      snapshot: effective,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `poincare-view-${contextId}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
      <div className={`flex-1 flex flex-col transition-all duration-300 ${activeNode ? 'max-w-[calc(100vw-400px)]' : 'w-full'} h-[calc(100vh-32px)]`}>
        
        {/* Header / Breadcrumbs & Gene Search */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4 z-10 relative px-4 py-3 bg-obsidian-800/60 backdrop-blur-md rounded-xl border border-white/5 shadow-lg">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <span className="text-biocyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">🌀</span> Poincaré Disc
            </h1>
            <div className="h-4 w-px bg-white/20 hidden sm:block"></div>
            <div className="text-xs font-medium text-slate-400 hidden sm:flex items-center">
              Global <span className="mx-2 opacity-50">›</span> {activeNode ? <span className="text-biocyan-300 font-bold">{activeNode}</span> : 'Network View'}
            </div>
          </div>

          {/* Gene Search Component & Header Actions */}
          <div className="flex items-center gap-2.5">
            <GeneSearch
              onSearch={handleGeneSearch}
              availableGenes={availableGenes}
              searchedGene={searchedGene}
              searchError={searchError}
              onClear={handleClearSearch}
            />

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all border font-mono font-medium shadow-sm bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
              aria-label="Data sources and settings"
              title="Data sources and settings"
            >
              <Settings className="w-3.5 h-3.5 text-biocyan-400" />
              {settingsPending && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300" />}
            </button>

            {/* Export Poincaré Disc PNG Button (html2canvas) */}
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all border font-mono font-medium shadow-sm bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
              title="Download the current view as JSON with DepMap provenance"
            >
              <Download className="w-3.5 h-3.5 text-biocyan-400" />
              <span className="hidden sm:inline">JSON</span>
            </button>
            <button 
              onClick={handleExportPNG}
              disabled={isExporting}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all border font-mono font-medium shadow-sm",
                exportSuccess
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : isExporting
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 cursor-wait"
                  : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10 hover:border-biocyan-400/40 hover:text-white"
              )}
              title="Export high-resolution PNG image of the Poincaré Disc SVG using html2canvas for research documentation"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : exportSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-biocyan-400" />
              )}
              <span className="hidden sm:inline">
                {isExporting ? "Exporting..." : exportSuccess ? "PNG Saved!" : "Export PNG"}
              </span>
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors border border-white/10"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Disconnect</span>
            </button>
          </div>
        </div>

        {/* The Disc Viewer */}
        <div 
          ref={containerRef} 
          className="flex-1 w-full bg-obsidian-900/50 rounded-2xl border border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-sm"
        >
          <div className="absolute top-4 left-4 z-10 bg-obsidian-800/90 backdrop-blur-xl p-4 rounded-xl border border-white/10 w-80 text-slate-300 space-y-2 pointer-events-none">
            <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              {visualMode === "chronos" ? "Mean Chronos" : visualMode === "expression" ? "Mean expression" : "Curated roles"}
            </span>
            <p className="text-[11px] text-slate-400 leading-snug">{measurementCaption}</p>
            <p className="text-[10px] font-mono text-slate-500 leading-snug">
              {provenanceLine}
            </p>
            {stringError && <p className="text-[10px] leading-snug text-rose-300">{stringError}</p>}
            {(visualMode === "chronos" || visualMode === "expression") && (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 flex-1 rounded-full border border-white/20"
                    style={{ background: `linear-gradient(to right, ${(visualMode === "chronos" ? effective.chronosRange : effective.expressionRange).join(", ")})` }}
                  />
                  <div className="h-3 w-3 rounded-sm border border-white/20" style={{ background: effective.missingColor }} title="Missing measurement" />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>{visualMode === "chronos" ? effective.chronosDomain[0] : effective.expressionDomain[0]}</span>
                  <span>missing</span>
                  <span>{visualMode === "chronos" ? effective.chronosDomain[effective.chronosDomain.length - 1] : effective.expressionDomain[effective.expressionDomain.length - 1]}</span>
                </div>
              </>
            )}
            <p className="text-[10px] text-slate-500 leading-snug">
              {measurementError
                ? measurementError
                : "Genes absent from this DepMap release stay neutral."}
            </p>
            <p className={cn("text-[10px] leading-snug", omnipathError ? "text-rose-300" : "text-slate-500")}>
              {effective.omnipathDatasets.length === 0
                ? "OmniPath signs off"
                : omnipathForKey !== edgeKey
                ? "Loading OmniPath signs..."
                : omnipathError
                ? `OmniPath request failed: ${omnipathError}`
                : `OmniPath signs on ${signedEdgeCount} of ${uniqueEdges.length} STRING edges. Datasets: ${effective.omnipathDatasets.join(", ")}.`}
            </p>
            {effective.omnipathDatasets.length > 0 && (
              <p className="text-[10px] text-slate-500">
                stimulation {effective.signStimulation.color} · inhibition {effective.signInhibition.color} · both {effective.signBoth.color}
              </p>
            )}
          </div>

          {/* Status Indicator Top Right */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2 text-xs">
            <div className="flex items-center gap-2 bg-obsidian-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-slate-300">
              <div className={cn("w-2 h-2 rounded-full", loadingString ? "bg-amber-400 animate-pulse" : stringError ? "bg-rose-400" : "bg-bioemerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]")}></div>
              <span>{loadingString ? "Querying STRING..." : stringError ? "STRING request failed" : "STRING API Active"}</span>
            </div>
            <div className="flex items-center gap-2 bg-obsidian-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-slate-300">
              <div className={cn("w-2 h-2 rounded-full", "bg-biocyan-500 shadow-[0_0_8px_rgba(0,178,255,0.8)]")}></div>
              <span>{activeNode && proteinDetailsCache[activeNode]?.mygeneError ? "MyGene request failed" : "MyGene API Active"}</span>
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

          {/* The Poincaré Disc SVG Canvas (wrapped for research export) */}
          <div ref={discExportRef} className="w-full h-full relative" style={{ background: effective.background }}>
            <svg 
              ref={svgRef} 
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full cursor-crosshair active:cursor-grabbing" 
              onClick={() => setActiveNode(null)}
            >
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
              <filter id="glow-heat" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              {/* Chromatic Edge Gradients */}
              {GRADIENT_PAIRS.map(([c1, c2]) => (
                <linearGradient key={`${c1}-${c2}`} id={`grad-${c1}-${c2}`}>
                  <stop offset="0%" stopColor={effective.rolePalette[c1 as keyof Preferences["rolePalette"]]} />
                  <stop offset="100%" stopColor={effective.rolePalette[c2 as keyof Preferences["rolePalette"]]} />
                </linearGradient>
              ))}
              {GRADIENT_PAIRS.filter(([c1, c2]) => c1 !== c2).map(([c1, c2]) => (
                <linearGradient key={`${c2}-${c1}`} id={`grad-${c2}-${c1}`}>
                   <stop offset="0%" stopColor={effective.rolePalette[c2 as keyof Preferences["rolePalette"]]} />
                   <stop offset="100%" stopColor={effective.rolePalette[c1 as keyof Preferences["rolePalette"]]} />
                </linearGradient>
              ))}
            </defs>
            <g ref={gRef}>
              {/* Grid Background */}
              {[0.2, 0.4, 0.6, 0.8].map(r => (
                <circle key={r} cx={0} cy={0} r={R * r} fill="none" stroke={effective.gridColor} strokeWidth={1} strokeOpacity={0.05} />
              ))}
              {Array.from({length: 12}).map((_, i) => {
                const angle = (i * Math.PI) / 6;
                return (
                  <line key={i} x1={0} y1={0} x2={R * Math.cos(angle)} y2={R * Math.sin(angle)} stroke={effective.gridColor} strokeWidth={1} strokeOpacity={0.03} />
                );
              })}

              {/* Event Horizon Circle */}
              <circle cx={0} cy={0} r={R} fill="none" stroke={effective.gridColor} strokeWidth={2} strokeOpacity={0.4} filter="url(#glow-rim)" />
              
              {/* Primary Nodes (Pathways) */}
              {Object.entries(mappedPrimCoords).map(([node, z]: [string, Complex]) => {
                const centrality = primaryCentrality[node] || 0.5;
                const size = 22 + 28 * centrality;
                const isBloomed = bloomNode === node;
                const isPathwayHighlighted = highlightedPathways.includes(node);
                const opacity = getNodeOpacity(node, true);
                
                return (
                  <g 
                    key={node} 
                    transform={`translate(${z.r * R}, ${-z.i * R})`} 
                    onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }} 
                    className="cursor-pointer transition-opacity duration-500"
                    style={{ opacity: isPathwayHighlighted ? 1 : opacity }}
                  >
                    {/* Highlight Beacon for pathways connected to searched gene */}
                    {isPathwayHighlighted && (
                      <>
                        <circle 
                          r={size + 16} 
                          fill="none" 
                          stroke="#38bdf8" 
                          strokeWidth={2} 
                          strokeDasharray="6,4" 
                          className="animate-spin pointer-events-none" 
                          style={{ animationDuration: '8s' }} 
                        />
                        <circle 
                          r={size + 8} 
                          fill={effective.hubColors.highlight} 
                          stroke={effective.gridColor} 
                          strokeWidth={1.5} 
                          className="animate-pulse pointer-events-none" 
                        />
                      </>
                    )}

                    <circle 
                      r={size} 
                      fill={isPathwayHighlighted ? effective.hubColors.highlight : effective.hubColors.fill}
                      stroke={isPathwayHighlighted ? effective.hubColors.highlight : isBloomed ? effective.hubColors.bloom : effective.hubColors.stroke} 
                      strokeOpacity={isPathwayHighlighted ? 1 : 0.8}
                      strokeWidth={isPathwayHighlighted ? 3.5 : isBloomed ? 3 : 1.5} 
                      filter={isPathwayHighlighted || isBloomed ? "url(#glow-rim)" : undefined}
                      className="transition-all duration-300 hover:fill-[rgba(225,29,72,0.3)]"
                    />
                    <text 
                      y={-size - 8} 
                      textAnchor="middle" 
                      fontSize={14} 
                      fontWeight="700" 
                      fill={isPathwayHighlighted ? effective.searchHighlight[0] : "#e2e8f0"} 
                      pointerEvents="none"
                      className="select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans"
                    >
                      {node}
                    </text>
                    {isPathwayHighlighted ? (
                      <text
                        y={size + 16}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight="700"
                        fill="#38bdf8"
                        pointerEvents="none"
                        className="select-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)] font-mono tracking-wider"
                      >
                        ✦ CONNECTED PATHWAY
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {/* Pathway Ghost Labels - Behind Nodes */}
              {Object.entries(mappedPrimCoords).map(([node, z]: [string, Complex]) => {
                const isBloomed = bloomNode === node;
                const isPathwayHighlighted = highlightedPathways.includes(node);
                const activeOpacity = getNodeOpacity(node, true);
                // Only render if we form part of the background aesthetic or if hovered
                if (!isBloomed && !isPathwayHighlighted && activeOpacity < 0.5) return null;
                return (
                  <text 
                    key={`ghost-${node}`}
                    x={z.r * R}
                    y={-z.i * R + 5} 
                    textAnchor="middle" 
                    fontSize={52} 
                    fontWeight="800" 
                    fill="#ffffff" 
                    opacity={isPathwayHighlighted ? 0.08 : 0.03} 
                    pointerEvents="none"
                    className="select-none uppercase tracking-[0.2em] font-sans pointer-events-none"
                  >
                    {node}
                  </text>
                );
              })}

              {/* Edges */}
              {uniqueEdges.map(([u, v, p, score]) => {
                  const z_u = mappedSecCoords[u];
                  const z_v = mappedSecCoords[v];
                  if (!z_u || !z_v) return null;
                  
                  const isSearchedEdge = Boolean(searchedGene && (u === searchedGene || v === searchedGene));
                  const isConnectedToActive = activeNode && (u === activeNode || v === activeNode);
                  const regulation = edgeRegulation(omnipathEdges, u, v);
                  const scoreWidth = edgeWidth(score);
                  const sign = regulation === "stimulation" ? effective.signStimulation : regulation === "inhibition" ? effective.signInhibition : regulation === "both" ? effective.signBoth : null;
                  
                  let strokeColor = isSearchedEdge
                    ? effective.searchHighlight[0]
                    : sign
                      ? sign.color
                      : isConnectedToActive 
                        ? `url(#grad-${getProteinColorCat(u)}-${getProteinColorCat(v)})` 
                        : effective.edgeDefaultStroke;
                  const strokeWidth = isSearchedEdge ? Math.max(2.5, scoreWidth) : scoreWidth;
                  const edgeOpacity = isSearchedEdge ? 0.95 : activeNode ? (isConnectedToActive ? 0.7 : 0.05) : 0.3;
                  
                  return (
                    <line 
                      key={`${u}-${v}`}
                      x1={z_u.r * R} y1={-z_u.i * R}
                      x2={z_v.r * R} y2={-z_v.i * R}
                      stroke={strokeColor} 
                      strokeWidth={strokeWidth} 
                      strokeDasharray={sign?.dash ?? "none"}
                      opacity={edgeOpacity}
                      className="transition-all duration-500"
                    >
                      <title>{`${u}–${v} · ${p} · ${score == null ? "STRING score invalid" : `STRING score ${score}`}${regulation === "none" ? "" : ` · OmniPath ${regulation}`}`}</title>
                    </line>
                  );
              })}

              {/* Secondary Nodes */}
              {Object.entries(mappedSecCoords).map(([u, z]: [string, Complex]) => {
                const details = proteinDetailsCache[u];
                const druggable = details ? details.druggable : false;
                const color = getNodeColor(u);
                
                const degree = uniqueEdges.filter(([a,b]) => a===u || b===u).length;
                const isCentral = degree > 4;

                const size = druggable ? 14 : Math.max(9, 6 + (hoveredProtein === u ? 2 : 0));
                // Bloom intensity based on degree/centrality
                const blurValue = isCentral ? 5 : 2;
                
                const isSearched = searchedGene === u;
                const opacity = isSearched ? 1 : getNodeOpacity(u, false);
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
                
                const tetherLen = isSearched ? 55 : isActive ? 50 : 30;
                const lx = cx + ux * tetherLen;
                const ly = cy + uy * tetherLen;
                const isRight = cx >= 0;
                
                const showLabel = isSearched || isActive || isHovered || (activeNode && connectedNodes.has(u)) || (!activeNode && isCentral);

                return (
                  <g key={u} className="transition-all duration-500" style={{ opacity }}>
                    {/* The Radial Tether and Label */}
                    {showLabel && (
                      <g className="pointer-events-none">
                        <line 
                          x1={cx} y1={cy} 
                          x2={lx} y2={ly} 
                          stroke={isSearched ? "#38bdf8" : color} 
                          strokeWidth={isSearched ? 1.5 : 1} 
                          opacity={isSearched ? 0.9 : isActive || isHovered ? 0.6 : 0.2} 
                          strokeDasharray={isSearched ? "none" : "2,2"}
                        />
                        <text 
                          x={lx + (isRight ? 6 : -6)} 
                          y={ly + 4} 
                          textAnchor={isRight ? "start" : "end"} 
                          fontSize={isSearched ? 14 : isActive ? 12 : 10} 
                          fontWeight={isSearched ? "800" : isActive ? "700" : "500"} 
                          fill={isSearched ? "#38bdf8" : isActive ? "#ffffff" : color} 
                          className="select-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)] transition-all duration-300 font-mono tracking-wide"
                        >
                          {u}{isSearched ? ' ★' : ''}
                        </text>
                      </g>
                    )}

                    <g transform={`translate(${cx}, ${cy})`}
                       data-symbol={u}
                       onMouseEnter={() => setHoveredProtein(u)}
                       onMouseLeave={() => setHoveredProtein(null)}
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         handleNodeClick(u); 
                       }}
                       className="cursor-pointer"
                    >
                      {isSearched && (
                        <g className="pointer-events-none">
                          <circle r={size + 14} fill="none" stroke={effective.searchHighlight[0]} strokeWidth="2.5" strokeDasharray="4,4" className="animate-spin" style={{ animationDuration: '6s' }} />
                          <circle r={size + 8} fill="none" stroke={effective.searchHighlight[1]} strokeWidth="2" className="animate-ping" style={{ animationDuration: '2.5s' }} />
                          <circle r={size + 3} fill={effective.hubColors.highlight} stroke={effective.searchHighlight[3]} strokeWidth="1.5" />
                        </g>
                      )}

                      {isActive && !isSearched && hudBracket}
                      
                      <circle 
                        r={size + (isSearched || isActive ? 4 : 0)} 
                        fill={isSearched ? "#0ea5e9" : color} 
                        stroke={isSearched || isActive ? "#ffffff" : "#0B0E14"} 
                        strokeWidth={isSearched || isActive ? 2 : 1} 
                        className="transition-all duration-300"
                      />
                      <circle 
                        r={size * 1.5} 
                        fill={isSearched ? "#38bdf8" : color} 
                        opacity={isSearched ? 0.6 : (isCentral ? 0.4 : 0.1)} 
                        filter="url(#glow-emerald)" 
                        className="pointer-events-none transition-all duration-300"
                        style={{ filter: `drop-shadow(0 0 ${isSearched ? 20 : blurValue*2}px ${isSearched ? "#38bdf8" : color})` }}
                      />
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

          {/* Neumorphic Control Pod */}
          <div className="absolute bottom-6 left-6 z-10 w-80 bg-obsidian-800/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">Cell-line context</h3>
            <select
              value={contextId}
              onChange={event => setContextId(event.target.value)}
              className="w-full bg-obsidian-900 border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200"
            >
              {contexts.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Color</h3>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">
                  {visualMode === "chronos" ? "Chronos" : visualMode === "expression" ? "Expression" : "Roles"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-obsidian-900/90 rounded-xl border border-white/10">
                <button
                  onClick={() => setVisualMode("chronos")}
                  className={cn(
                    "py-2 px-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-center",
                    visualMode === "chronos"
                      ? "bg-biocrimson-500/20 text-biocrimson-300 border border-biocrimson-500/50 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                  title="Mean Chronos gene effect in the selected context"
                >
                  Chronos
                </button>
                <button
                  onClick={() => setVisualMode("expression")}
                  className={cn(
                    "py-2 px-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-center",
                    visualMode === "expression"
                      ? "bg-bioemerald-500/20 text-bioemerald-300 border border-bioemerald-500/50 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                  title="Mean log2(TPM+1) from the DepMap expression file"
                >
                  Expression
                </button>
                <button
                  onClick={() => setVisualMode("roles")}
                  className={cn(
                    "py-2 px-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-center",
                    visualMode === "roles"
                      ? "bg-biocyan-500/20 text-biocyan-300 border border-biocyan-500/50 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                  title="Curated role colors. Not a DepMap measurement."
                >
                  Roles
                </button>
              </div>
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

      {/* Detailed Protein Information Panel */}
      {activeNode && (
        <ProteinInfoPanel
          symbol={activeNode}
          details={proteinDetailsCache[activeNode] || null}
          loading={!proteinDetailsCache[activeNode]}
          connectedNodesCount={connectedNodes.size}
          graphPathways={activeNodePathways}
          onClose={() => setActiveNode(null)}
          onExpand={handleExpandNetwork}
          isExpanding={expandingNode === activeNode}
          onSelectPathway={(p) => {
            if (!selectedPathways.includes(p)) {
              setSelectedPathways(prev => [...prev, p]);
            }
            setBloomNode(p);
            const targetPos = primCoords[p];
            if (targetPos) {
              targetCenterRef.current = targetPos;
            }
          }}
          measurement={activeNode.toUpperCase() in measurements ? measurements[activeNode.toUpperCase()] : undefined}
          measurementError={measurementError}
          depmapRelease={depmapRelease}
          contextLabel={contextLabel}
          curatedNoteVisible={effective.curatedNoteVisible}
          taxon={effective.stringSpecies}
        />
      )}

      <SettingsPanel
        open={settingsOpen}
        applied={applied}
        disc={{ zeta, bloomScale, selectedPathways, context: contextId, visualMode }}
        operator={operatorInfo}
        operatorError={operatorError}
        formError={settingsError}
        onPendingChange={setSettingsPending}
        onClose={() => setSettingsOpen(false)}
        onApply={draft => { void commitPreferences(draft, true); }}
        onImmediate={draft => {
          const next = { ...applied };
          for (const item of SETTINGS) {
            if (item.commit !== "immediate" || !item.preferenceKey || item.discControl) continue;
            (next as Record<string, unknown>)[item.preferenceKey] = draft[item.preferenceKey];
          }
          void commitPreferences(next, false);
        }}
        onResetGroup={settings => {
          const next: Preferences = { ...applied, zeta, bloomScale, selectedPathways, context: contextId, visualMode };
          for (const item of settings) {
            if (!item.preferenceKey) continue;
            (next as Record<string, unknown>)[item.preferenceKey] = structuredClone(item.default);
          }
          const refetch = settings.some(item => item.effect === "refetch");
          void commitPreferences(next, refetch, false);
        }}
        onResetAll={() => { void commitPreferences(defaultPreferences(), true, false); }}
      />

    </div>
  );
}
