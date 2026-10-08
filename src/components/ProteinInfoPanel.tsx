import React from 'react';
import { 
  X, 
  Plus, 
  Loader2, 
  Pill, 
  Network, 
  ExternalLink,
  Target,
  Info
} from 'lucide-react';
import { ProteinDetails } from '../lib/api';
import { cn } from '../lib/utils';
import type { GeneContextMeasurement } from '../lib/measurements';

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
  measurement: GeneContextMeasurement | null | undefined;
  measurementError: string | null;
  depmapRelease: string | null;
  contextLabel: string;
  curatedNoteVisible: boolean;
  taxon: string;
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
  measurement,
  measurementError,
  depmapRelease,
  contextLabel,
  curatedNoteVisible,
  taxon
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
      label: 'Unknown',
      desc: ''
    }
  };

  const currentRoleConfig = roleColors[role as keyof typeof roleColors] || roleColors.unknown;
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
            <span className="text-xs text-slate-400 font-mono">taxon {taxon}</span>
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
          {currentRoleConfig.desc}
        </p>
      </div>

          {details?.mygeneError && (
            <p className="text-[11px] text-rose-300 mb-3">MyGene request failed</p>
          )}
      {loading && !details ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-biocyan-400" />
          <span className="text-xs font-mono">Querying MyGene...</span>
        </div>
      ) : (
        <div className="space-y-5 flex-1 text-slate-300 font-sans text-xs">
          
          <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2.5 shadow-inner">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-biocyan-400" />
              DepMap measurements
            </h3>
            <p className="text-[10px] font-mono text-slate-500">
              {contextLabel} · {depmapRelease == null ? "cache not built" : depmapRelease.length === 0 ? "release unavailable" : depmapRelease}
            </p>
            {measurementError ? (
              <p className="text-amber-300 text-xs">{measurementError}</p>
            ) : measurement === undefined ? (
              <p className="text-slate-400 text-xs">Loading measurements...</p>
            ) : measurement === null ? (
              <p className="text-slate-400 text-xs">This gene is absent from the DepMap release.</p>
            ) : (
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mean Chronos</span>
                  <span className="font-mono text-white">
                    {measurement.chronosMean == null ? "missing" : measurement.chronosMean.toFixed(3)}
                    <span className="text-slate-500"> · n={measurement.chronosN}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mean log2(TPM+1)</span>
                  <span className="font-mono text-white">
                    {measurement.exprMean == null ? "missing" : measurement.exprMean.toFixed(3)}
                    <span className="text-slate-500"> · n={measurement.exprN}</span>
                  </span>
                </div>
              </div>
            )}
          </section>

          {curatedNoteVisible && (details?.roleDescription || druggability || bindingSites.length > 0) && (
            <section className="bg-obsidian-900/80 rounded-xl p-3.5 border border-white/10 space-y-2.5 shadow-inner">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-emerald-400" />
                Curated note
              </h3>
              {details?.roleDescription && (
                <p className="text-[11px] text-slate-300 leading-snug">{details.roleDescription}</p>
              )}
              {druggability && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">{druggability.status}</span>
                    <span className="font-mono text-white text-right">{druggability.targetClass}</span>
                  </div>
                  {druggability.approvedInhibitors && druggability.approvedInhibitors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {druggability.approvedInhibitors.map((drug, i) => (
                        <span key={i} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-mono">
                          {drug}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {bindingSites.length > 0 && (
                <div className="space-y-2">
                  {bindingSites.map((site, index) => (
                    <div key={index} className="p-2.5 rounded-lg bg-obsidian-800/90 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-[11px]">{site.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-biocyan-500/10 text-biocyan-300 border border-biocyan-500/20">
                          {site.type}
                        </span>
                      </div>
                      {site.residues && <div className="text-[10px] font-mono text-amber-300/90">{site.residues}</div>}
                      <p className="text-[10px] text-slate-300 leading-snug">{site.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

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
