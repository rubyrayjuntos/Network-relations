import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  SETTINGS,
  formatSettingValue,
  settingsByGroup,
  type Preferences,
  type Setting,
} from "../lib/settingsRegistry";

type Props = {
  open: boolean;
  applied: Preferences;
  disc: Pick<Preferences, "zeta" | "bloomScale" | "selectedPathways" | "context" | "visualMode">;
  operator: Record<string, unknown> | null;
  operatorError: string | null;
  onClose: () => void;
  onApply: (next: Preferences) => void;
  onImmediate: (next: Preferences) => void;
  onResetAll: () => void;
  onResetGroup: (settings: Setting[]) => void;
  formError?: string | null;
  onPendingChange?: (pending: boolean) => void;
};

function draftValue(setting: Setting, draft: Preferences, disc: Props["disc"], operator: Record<string, unknown> | null): unknown {
  if (setting.id.startsWith("operator.")) {
    const key = setting.id.slice("operator.".length);
    return operator?.[key] ?? setting.default;
  }
  if (setting.discControl && setting.preferenceKey) return disc[setting.preferenceKey as keyof typeof disc];
  if (setting.preferenceKey) return draft[setting.preferenceKey];
  return setting.default;
}

export function SettingsPanel({ open, applied, disc, operator, operatorError, onClose, onApply, onImmediate, onResetAll, onResetGroup, formError, onPendingChange }: Props) {
  const [draft, setDraft] = useState<Preferences>(applied);
  const appliedRef = useRef(applied);
  useEffect(() => {
    const previous = appliedRef.current;
    setDraft(current => {
      const next = { ...applied };
      for (const item of SETTINGS) {
        if (item.commit !== "apply" || !item.preferenceKey) continue;
        const key = item.preferenceKey;
        if (JSON.stringify(applied[key]) === JSON.stringify(previous[key])) {
          (next as Record<string, unknown>)[key] = current[key];
        }
      }
      return next;
    });
    appliedRef.current = applied;
  }, [applied]);
  const sections = useMemo(() => settingsByGroup(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const pending = sections.some(section => section.settings.some(setting => {
    if (setting.commit !== "apply" || !setting.preferenceKey) return false;
    return JSON.stringify(draft[setting.preferenceKey]) !== JSON.stringify(applied[setting.preferenceKey]);
  }));
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  if (!open) return null;

  const resetGroup = (settings: Setting[]) => {
    onResetGroup(settings);
  };

  const write = (setting: Setting, value: unknown) => {
    if (!setting.preferenceKey) return;
    const next = { ...draft, [setting.preferenceKey]: value };
    setDraft(next);
    if (setting.commit === "immediate") onImmediate(next);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" role="dialog" aria-label="Data sources and settings">
      <div className="h-full w-[420px] max-w-full overflow-y-auto bg-obsidian-900 border-l border-white/10 p-4 text-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold tracking-wide">Data sources and settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="p-1 rounded border border-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        {pending && <p className="text-[11px] text-amber-300 mb-3">Source changes are pending until Apply.</p>}
        {operatorError && <p className="text-[11px] text-rose-300 mb-3">{operatorError}</p>}
        {formError && <p className="text-[11px] text-rose-300 mb-3">{formError}</p>}
        {sections.map(section => (
          <section key={section.group} className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] uppercase tracking-wider text-slate-400">{section.group}</h3>
              <button type="button" onClick={() => resetGroup(section.settings)} className="text-[10px] text-slate-400 underline">Reset group</button>
            </div>
            <div className="space-y-2">
              {section.settings.map(setting => {
                const value = draftValue(setting, draft, disc, operator);
                return (
                  <div key={setting.id} className="rounded-lg border border-white/10 p-2">
                    <div className="text-[11px] font-medium">{setting.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono break-all">default {formatSettingValue(setting.default)}</div>
                    {setting.discControl && <p className="text-[10px] text-slate-400">Edited on the disc. Effective: {formatSettingValue(value)}</p>}
                    {!setting.discControl && setting.control === "none" && (
                      <p className="text-[11px] font-mono break-all">Effective: {formatSettingValue(value)}</p>
                    )}
                    {setting.editable && !setting.discControl && setting.control === "number" && (
                      <input type="number" min={setting.min} max={setting.max} value={Number(value)} onChange={event => write(setting, Number(event.target.value))} className="mt-1 w-full bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-xs" />
                    )}
                    {setting.editable && !setting.discControl && setting.control === "text" && value != null && typeof value === "object" && !Array.isArray(value) && (
                      <div className="mt-1 space-y-1">
                        {Object.entries(value as Record<string, string>).map(([name, color]) => (
                          <label key={name} className="flex items-center gap-2 text-[10px]">
                            <span className="w-16 text-slate-400">{name}</span>
                            <input type="text" value={color} onChange={event => write(setting, { ...(value as object), [name]: event.target.value })} className="flex-1 bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-xs" />
                          </label>
                        ))}
                      </div>
                    )}
                    {setting.editable && !setting.discControl && setting.control === "text" && (value == null || typeof value !== "object" || Array.isArray(value)) && (
                      <input type="text" value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={event => write(setting, setting.preferenceKey === "chronosDomain" || setting.preferenceKey === "expressionDomain" ? event.target.value : event.target.value)} className="mt-1 w-full bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-xs" />
                    )}
                    {setting.editable && !setting.discControl && setting.control === "color" && (
                      <div className="mt-1 space-y-1">
                        <input type="text" value={typeof value === "object" && value && "color" in value ? String((value as { color: string }).color) : String(value ?? "")} onChange={event => {
                          if (typeof value === "object" && value && "color" in value) {
                            write(setting, { ...(value as object), color: event.target.value });
                          } else {
                            write(setting, event.target.value);
                          }
                        }} className="w-full bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-xs" />
                        {typeof value === "object" && value && "dash" in value && (
                          <label className="flex items-center gap-2 text-[10px] text-slate-400">
                            dash
                            <input type="text" value={(value as { dash: string | null }).dash ?? ""} placeholder="solid" onChange={event => write(setting, { ...(value as object), dash: event.target.value.trim() === "" ? null : event.target.value.trim() })} className="flex-1 bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-xs" />
                          </label>
                        )}
                      </div>
                    )}
                    {setting.editable && !setting.discControl && setting.control === "boolean" && (
                      <label className="mt-1 flex items-center gap-2 text-[11px]">
                        <input type="checkbox" checked={Boolean(value)} onChange={event => write(setting, event.target.checked)} />
                        {Boolean(value) ? "on" : "off"}
                      </label>
                    )}
                    {setting.editable && !setting.discControl && setting.control === "enum" && (
                      <select value={String(value)} onChange={event => write(setting, event.target.value)} className="mt-1 w-full bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-xs">
                        {setting.options?.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    )}
                    {setting.editable && !setting.discControl && setting.control === "dataset-set" && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {setting.options?.map(option => {
                          const selected = Array.isArray(value) && value.includes(option);
                          return (
                            <button key={option} type="button" onClick={() => {
                              const current = Array.isArray(value) ? [...value] : [];
                              const next = selected ? current.filter(item => item !== option) : [...current, option];
                              write(setting, next);
                            }} className={`px-1.5 py-0.5 rounded text-[10px] border ${selected ? "border-biocyan-400 text-biocyan-200" : "border-white/10 text-slate-400"}`}>
                              {option}
                            </button>
                          );
                        })}
                        {setting.id === "source.omnipath.datasets" && Array.isArray(value) && value.length === 0 && <span className="text-[10px] text-amber-300">signs off</span>}
                      </div>
                    )}
                    {setting.editable && !setting.discControl && setting.control === "gene-map" && (
                      <textarea value={Object.entries((value && typeof value === "object" ? value : {}) as Record<string, string[]>).map(([name, genes]) => `${name}: ${genes.join(", ")}`).join("\n")} onChange={event => {
                        const map: Record<string, string[]> = {};
                        for (const line of event.target.value.split("\n")) {
                          const [name, rest] = line.split(":");
                          if (!name?.trim() || rest == null) continue;
                          map[name.trim()] = rest.split(",").map(gene => gene.trim()).filter(Boolean);
                        }
                        write(setting, map);
                      }} className="mt-1 w-full h-28 bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-[10px] font-mono" />
                    )}
                    {setting.editable && !setting.discControl && setting.control === "color-list" && (
                      <input type="text" value={Array.isArray(value) ? value.join(", ") : ""} onChange={event => write(setting, event.target.value.split(",").map(item => item.trim()).filter(Boolean))} className="mt-1 w-full bg-obsidian-800 border border-white/10 rounded px-2 py-1 text-xs" />
                    )}
                    {setting.help && <p className="text-[10px] text-slate-500 mt-1">{setting.help}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <div className="flex gap-2 sticky bottom-0 bg-obsidian-900 py-3">
          <button type="button" disabled={!pending} onClick={() => onApply(draft)} className="flex-1 py-2 text-xs font-bold rounded border border-biocyan-500/40 disabled:opacity-40">Apply</button>
          <button type="button" onClick={onResetAll} className="px-3 py-2 text-xs rounded border border-white/10">Reset all</button>
        </div>
      </div>
    </div>
  );
}
