import React from 'react';
import { addDays, todayISO } from '../lib/format';

export interface Period { from: string | null; to: string | null }

export type Preset = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom';

export function periodFromPreset(p: Preset): Period {
  const today = todayISO();
  switch (p) {
    case 'today': return { from: today, to: today };
    case '7d': return { from: addDays(today, -6), to: today };
    case '30d': return { from: addDays(today, -29), to: today };
    case 'month': return { from: today.slice(0, 8) + '01', to: today };
    default: return { from: null, to: null };
  }
}

const CHIPS: Array<{ id: Preset; label: string }> = [
  { id: 'today', label: 'اليوم' },
  { id: '7d', label: '7 أيام' },
  { id: '30d', label: '30 يوم' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'الكل' },
  { id: 'custom', label: 'فترة مخصصة' }
];

export default function PeriodFilter({ preset, onPreset, period, onPeriod }: {
  preset: Preset;
  onPreset: (p: Preset) => void;
  period: Period;
  onPeriod: (p: Period) => void;
}) {
  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-bold transition ${
      active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((c) => (
          <button key={c.id} className={chip(preset === c.id)}
            onClick={() => { onPreset(c.id); if (c.id !== 'custom') onPeriod(periodFromPreset(c.id)); }}>
            {c.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input type="date" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-600"
            value={period.from || ''} onChange={(e) => onPeriod({ ...period, from: e.target.value || null })} />
          <span className="text-xs text-slate-400">→</span>
          <input type="date" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-600"
            value={period.to || ''} onChange={(e) => onPeriod({ ...period, to: e.target.value || null })} />
        </div>
      )}
    </div>
  );
}
