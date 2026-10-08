import React, { useState, useRef, useEffect } from 'react';
import { Search, X, AlertCircle, Sparkles, CornerDownLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface GeneSearchProps {
  onSearch: (query: string) => void;
  availableGenes: string[];
  searchedGene: string | null;
  searchError: string | null;
  onClear: () => void;
}

export const GeneSearch: React.FC<GeneSearchProps> = ({
  onSearch,
  availableGenes,
  searchedGene,
  searchError,
  onClear
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync input with searched gene if external change
  useEffect(() => {
    if (searchedGene) {
      setInputVal(searchedGene);
    }
  }, [searchedGene]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmed = inputVal.trim();
  const suggestions = trimmed.length > 0 
    ? availableGenes.filter(g => g.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 8)
    : [];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trimmed) return;
    setIsOpen(false);
    onSearch(trimmed);
  };

  const handleSelect = (gene: string) => {
    setInputVal(gene);
    setIsOpen(false);
    onSearch(gene);
  };

  const handleReset = () => {
    setInputVal('');
    setIsOpen(false);
    onClear();
  };

  // Popular cancer genes in network for quick testing
  const QUICK_GENES = ['KRAS', 'TP53', 'PIK3CA', 'CDK4', 'VEGFA', 'BAX'];

  return (
    <div ref={containerRef} className="relative flex items-center">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="relative flex items-center">
          <div className="absolute left-3 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4 text-biocyan-400" />
          </div>

          <input
            type="text"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (trimmed.length > 0) setIsOpen(true);
            }}
            placeholder="Search gene (e.g. KRAS, TP53)..."
            className={cn(
              "w-56 md:w-72 pl-9 pr-16 py-1.5 bg-obsidian-900/90 text-white placeholder-slate-500 rounded-lg border text-xs font-mono transition-all duration-200 outline-none focus:ring-2",
              searchError 
                ? "border-rose-500/80 focus:ring-rose-500/30" 
                : searchedGene 
                  ? "border-biocyan-500/80 focus:ring-biocyan-500/30" 
                  : "border-white/10 hover:border-white/20 focus:border-biocyan-500/50 focus:ring-biocyan-500/20"
            )}
          />

          {/* Right actions: Clear button and Return/Search button */}
          <div className="absolute right-2 flex items-center gap-1">
            {inputVal && (
              <button
                type="button"
                onClick={handleReset}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="p-1 px-1.5 bg-biocyan-500/20 hover:bg-biocyan-500/30 text-biocyan-300 rounded text-[10px] font-mono border border-biocyan-500/30 transition-colors flex items-center gap-0.5"
              title="Search Gene"
            >
              <CornerDownLeft className="w-3 h-3" />
            </button>
          </div>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1.5 w-72 bg-obsidian-800/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.8)] z-50 overflow-hidden py-1.5 font-mono text-xs">
          <div className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-white/5 flex items-center justify-between">
            <span>Matching Genes in Network</span>
            <span className="text-biocyan-400">{suggestions.length} found</span>
          </div>
          {suggestions.map((gene) => (
            <button
              key={gene}
              type="button"
              onClick={() => handleSelect(gene)}
              className="w-full text-left px-3 py-1.5 hover:bg-biocyan-500/20 text-slate-200 hover:text-white flex items-center justify-between transition-colors group"
            >
              <span className="font-bold group-hover:text-biocyan-300">{gene}</span>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-300">Highlight in Disc ▸</span>
            </button>
          ))}
        </div>
      )}

      {/* Prominent 'Gene not found' Message Tooltip / Banner */}
      {searchError && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-rose-950/95 border border-rose-500/60 rounded-xl p-3 shadow-[0_12px_32px_rgba(244,63,94,0.3)] z-50 text-xs font-sans animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-300 font-mono tracking-wide flex items-center justify-between">
                <span>Gene not found</span>
                <button 
                  onClick={handleReset} 
                  className="text-rose-400 hover:text-rose-200 font-sans text-[10px]"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-snug">
                "{trimmed}" is not currently in the Poincaré disc network.
              </p>
              <div className="pt-1.5 text-[10px] text-slate-300 border-t border-rose-500/20">
                <span className="text-slate-400 block mb-1">Try one of these active genes:</span>
                <div className="flex flex-wrap gap-1">
                  {QUICK_GENES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleSelect(g)}
                      className="px-1.5 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-mono text-[10px] border border-rose-500/30 transition-colors"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Searched Gene Active Chip */}
      {searchedGene && !searchError && (
        <div className="hidden lg:flex items-center gap-1.5 ml-2.5 px-2.5 py-1 bg-biocyan-500/15 border border-biocyan-500/40 rounded-lg text-xs font-mono text-biocyan-300">
          <Sparkles className="w-3 h-3 text-biocyan-400 animate-pulse" />
          <span>Active:</span>
          <span className="font-bold text-white">{searchedGene}</span>
          <button 
            onClick={handleReset} 
            className="ml-1 text-slate-400 hover:text-white"
            title="Clear highlight"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
