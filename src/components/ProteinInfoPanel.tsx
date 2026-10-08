import React from 'react';
import { 
  X, 
  Plus, 
  Loader2, 
  ShieldAlert, 
  Flame, 
  Pill, 
  Dna, 
  Activity, 
  Network, 
  ExternalLink,
  Target,
  Sparkles,
  Info
} from 'lucide-react';
import { ProteinDetails } from '../lib/api';
import { cn } from '../lib/utils';

interface ProteinInfoPanelProps {
  symbol: string;
  details: ProteinDetails | null;
  loading: boolean;
  connectedNodesCount: number;
  graphPathways: string[];
  onClose: () => void;
  onExpand: (symbol: string) => void;
  isExpanding: boolean;
  onSelectPathway?: (pathway: string) => void;
  hotspotData?: {
    frequency: number;
    onTicks: number;
    totalTicks: number;
    isSimulationRunning: boolean;
  };
}

export const ProteinInfoPanel: React.FC<ProteinInfoPanelProps> = ({
  symbol,
  details,
  loading,
  connectedNodesCount,
  graphPathways,
  onClose,
  onExpand,
  isExpanding,
  onSelectPathway,
  hotspotData
}) => {
  const role = details?.inferredRole || 'unknown';
  const roleColors = {
    oncogene: {
      bg: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
      dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
      label: '🔥 Oncogene',
      desc: 'Promotes malignant cellular proliferation, survival, or metastatic transformation when hyperactivated or amplified.'
    },
    tumor_suppressor: {
      bg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
      dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
      label: '🛡️ Tumor Suppressor',
      desc: 'Restrains aberrant cell division, maintains genomic integrity, or executes apoptosis upon oncogenic damage.'
    },
    essential_regulator: {
      bg: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
      dot: 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]',
      label: '⚡ Essential Regulator',
      desc: 'Core physiological mediator required for fundamental signaling cascades and metabolic homeostasis.'
    },
    dual_role: {
      bg: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
      label: '⚖️ Context-Dependent',
      desc: 'Exhibits tumor-promoting or tumor-suppressing characteristics depending on cellular lineage and genetic background.'
    },
    unknown: {
      bg: 'bg-slate-800 border-white/10 text-slate-400',
      dot: 'bg-slate-400',
      label: 'Molecular Target',
      desc: 'Intracellular signaling component in oncogenic regulatory networks.'
    }
  };

  const currentRoleConfig = roleColors[role as keyof typeof roleColors] || roleColors.unknown;
  const depMap = details?.depMap;
  const druggability = details?.druggabilityDetails;
  const bindingSites = details?.bindingSites || [];

  return (
    <div className="w-[380px] ml-4 bg-obsidian-800/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] p-5 flex flex-col h-[calc(100vh-32px)] overflow-y-auto custom-scrollbar animate-slide-left relative z-20">
      {/* Top action row */}
      <div className="flex items-start justify-between mb-3 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-biocyan-500/20 text-biocyan-300 border border-biocyan-500/30">
              TARGET
            </span>
            <span className="text-xs text-slate-400 font-mono">HUMAN [9606]</span>
          </div>
          <h2 className="text-2xl font-black font-sans text-white tracking-tight mt-1 flex items-center gap-2">
            {symbol}
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Full Gene Name */}
      {details?.name && (
        <div className="text-xs text-slate-300 font-sans leading-relaxed mb-3 italic">
          {details.name}
        </div>
      )}

      {/* Role Badge */}
      <div className="mb-4">
        <div className={cn("px-3 py-1.5 rounded-xl border flex items-center justify-between text-xs font-bold", currentRoleConfig.bg)}>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", currentRoleConfig.dot)} />
            <span>{currentRoleConfig.label}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider opacity-80 font-mono">Role Status</span>
        </div>
        <p className="text-[11px] text-slate-400 font-sans mt-1.5 leading-snug">
          {details?.roleDescription || currentRoleConfig.desc}
        </p>
      </div>

      {loading && !details ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-biocyan-400" />
          <span className="text-xs font-mono">Querying MyGene & DepMap Knowledgebase...</span>
        </div>
      ) : (
        <div className="space-y-5 flex-1 text-slate-300 font-sans text-xs">
          
          {/* 50-TICK ACTIVITY HOTSPOT SECTION */}
          {hotspotData && (
            <section className="bg-obsidian-900/90 rounded-xl p-3.5 border border-white/10 space-y-2.5 shadow-inner relative overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  50-Tick Signaling Hotspot
                </h3>
                <span className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1",
                  hotspotData.frequency >= 0.7 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.4)]" :
                  hotspotData.frequency >= 0.4 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                  "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                )}>
                  {hotspotData.frequency >= 0.7 ? "🔥 Hyperactive Hotspot" :
                   hotspotData.frequency >= 0.4 ? "⚡ Active Signaling" :
                   "❄️ Quiescent / Repressed"}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-400">Mean Activation Frequency (ON):</span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-xl font-black font-mono",
                      hotspotData.frequency >= 0.7 ? "text-rose-400" :
                      hotspotData.frequency >= 0.4 ? "text-amber-400" :
                      "text-cyan-400"
                    )}>
                      {(hotspotData.frequency * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({hotspotData.onTicks}/{hotspotData.totalTicks} ticks)
                    </span>
                  </div>
                </div>

                {/* Heatmap Bar */}
                <div className="space-y-1">
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10 relative">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        hotspotData.frequency >= 0.7 
                          ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]" 
                          : hotspotData.frequency >= 0.4 
                            ? "bg-gradient-to-r from-cyan-500 to-amber-400"
                            : "bg-gradient-to-r from-blue-600 to-cyan-500"
                      )}
                      style={{ width: `${Math.max(4, hotspotData.frequency * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>0% (Quiescent)</span>
                    <span className="text-amber-400/80">50% Active</span>
                    <span className="text-rose-400 font-bold">100% Hotspot</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-sans leading-relaxed pt-1 border-t border-white/5">
                  Calculated from the last {hotspotData.totalTicks} Boolean simulation steps. 
                  {hotspotData.isSimulationRunning ? " Updates dynamically each tick." : " Run simulation to observe dynamic cascade."}
                </p>
              </div>
            </section>
          )}

          {/* DEPMAP DEPENDENCY SCORE SECTION */}
          <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-biocyan-400" />
                DepMap Dependency
              </h3>
              {depMap && (
                <span className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase",
                  depMap.score < -1.0 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" :
                  depMap.score < -0.5 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                  depMap.score < 0 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" :
                  "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                )}>
                  {depMap.tier}
                </span>
              )}
            </div>

            {depMap ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-400">Avg Chronos CRISPR Score:</span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-xl font-black font-mono",
                      depMap.score < -0.5 ? "text-rose-400" : depMap.score < 0 ? "text-amber-400" : "text-emerald-400"
                    )}>
                      {depMap.score > 0 ? `+${depMap.score.toFixed(2)}` : depMap.score.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">log2FC</span>
                  </div>
                </div>

                {/* Visual Gauge Bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative border border-white/10">
                    {/* -0.5 dependency threshold indicator */}
                    <div className="absolute top-0 bottom-0 left-[60%] w-0.5 bg-rose-400 z-10" title="Dependency Cutoff (-0.5)" />
                    {/* Marker */}
                    {(() => {
                      // Map score -2.0 -> 0%, 0.0 -> 80%, +0.5 -> 100%
                      const normalized = Math.max(0, Math.min(100, ((depMap.score + 2.0) / 2.5) * 100));
                      return (
                        <div 
                          className={cn(
                            "absolute top-0 bottom-0 w-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-500",
                            depMap.score < -0.5 ? "bg-rose-500" : depMap.score < 0 ? "bg-amber-400" : "bg-emerald-400"
                          )}
                          style={{ left: `calc(${normalized}% - 6px)` }}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>-2.0 (Lethal)</span>
                    <span className="text-rose-400/80 font-bold">-0.5 (Cutoff)</span>
                    <span>0.0 (Neutral)</span>
                    <span>+0.5</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-sans leading-relaxed pt-1 border-t border-white/5">
                  {depMap.summary}
                </p>
              </div>
            ) : (
              <div className="text-slate-400 text-xs italic">
                DepMap dependency metrics calculating...
              </div>
            )}
          </section>

          {/* DRUGGABILITY STATUS SECTION */}
          <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-emerald-400" />
                Druggability Status
              </h3>
              <span className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase",
                details?.druggable 
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                  : "bg-slate-800 text-slate-400 border border-white/10"
              )}>
                {druggability?.status || (details?.druggable ? "Druggable Target" : "Undrugged / Challenge")}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Target Classification:</span>
                <span className="font-mono text-white text-right">
                  {druggability?.targetClass || (details?.druggable ? "Kinase / Catalytic Domain" : "Signaling Scaffolding")}
                </span>
              </div>

              {druggability?.tier && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Pharos Target Tier:</span>
                  <span className="font-mono font-bold text-biocyan-400">
                    {druggability.tier} {druggability.tier === 'Tclin' ? '(Clinical Drug)' : druggability.tier === 'Tchem' ? '(Potent Small Molecule)' : '(Bio Characterized)'}
                  </span>
                </div>
              )}

              {/* Approved / Clinical Inhibitors */}
              {druggability?.approvedInhibitors && druggability.approvedInhibitors.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    Therapeutic Molecules / Inhibitors:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {druggability.approvedInhibitors.map((drug, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-mono">
                        {drug}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RELEVANT BINDING SITES SECTION */}
          <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Dna className="w-3.5 h-3.5 text-biocyan-400" />
                Relevant Binding Sites
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {bindingSites.length} documented
              </span>
            </div>

            {bindingSites.length > 0 ? (
              <div className="space-y-2">
                {bindingSites.map((site, index) => (
                  <div key={index} className="p-2.5 rounded-lg bg-obsidian-800/90 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-[11px] font-sans flex items-center gap-1.5">
                        <span className="text-biocyan-400">▸</span> {site.name}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-biocyan-500/10 text-biocyan-300 border border-biocyan-500/20">
                        {site.type}
                      </span>
                    </div>
                    {site.residues && (
                      <div className="text-[10px] font-mono text-amber-300/90">
                        {site.residues}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-300 leading-snug font-sans">
                      {site.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-xs italic">
                No specific binding site annotations recorded.
              </div>
            )}
          </section>

          {/* PATHWAYS IT CONNECTS TO SECTION */}
          <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-purple-400" />
                Pathways & Systems
              </h3>
              <span className="text-[10px] font-mono text-purple-300 font-bold">
                {connectedNodesCount} interactors
              </span>
            </div>

            {/* In-Graph Systems */}
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Active Poincaré Networks:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {graphPathways.map((p, i) => (
                  <button 
                    key={i} 
                    onClick={() => onSelectPathway?.(p)}
                    className="px-2.5 py-1 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/40 rounded-md text-[10px] font-mono transition-colors flex items-center gap-1"
                    title={`Highlight ${p} system`}
                  >
                    <span>✦ {p}</span>
                  </button>
                ))}
                {graphPathways.length === 0 && (
                  <span className="text-[11px] text-slate-500">Peripheral node</span>
                )}
              </div>
            </div>

            {/* Canonical Biological Pathways */}
            {details?.pathways && details.pathways.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  Canonical Biological Pathways:
                </div>
                <div className="flex flex-wrap gap-1">
                  {details.pathways.slice(0, 5).map((pw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white/5 text-slate-300 border border-white/10 rounded text-[9px] font-sans">
                      {pw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* FUNCTIONAL SUMMARY & ONTOLOGY */}
          {details?.summary && (
            <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2 shadow-inner">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-biocyan-400" />
                Biological Summary
              </h3>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                {details.summary}
              </p>
            </section>
          )}

          {/* PROCESS ONTOLOGY */}
          {details?.go?.BP && details.go.BP.length > 0 && (
            <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2 shadow-inner">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Process Ontology (GO:BP)
              </h3>
              <ul className="text-[10px] text-slate-300 space-y-1 font-sans">
                {details.go.BP.slice(0, 4).map((go, i) => (
                  <li key={i} className="flex gap-1.5 items-start">
                    <span className="text-biocyan-400 font-bold mt-0.5">▸</span>
                    <span>{go.term}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* EXPAND INTERACTORS BUTTON */}
          <div className="pt-2">
            <button 
              onClick={() => onExpand(symbol)}
              disabled={isExpanding}
              className="w-full py-2.5 px-4 bg-biocyan-500/15 hover:bg-biocyan-500/25 text-biocyan-300 border border-biocyan-500/40 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(0,178,255,0.15)]"
            >
              {isExpanding ? <Loader2 className="w-4 h-4 animate-spin text-biocyan-400" /> : <Plus className="w-4 h-4" />}
              <span>EXPAND PPI INTERACTORS VIA STRING</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
