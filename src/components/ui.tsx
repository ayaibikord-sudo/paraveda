import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Icon } from './icons';

/* ============ عناصر واجهة أساسية ============ */

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
  danger: 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50',
  icon: 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
};

export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-400';

export function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function SectionCard({ title, subtitle, actions, children, className = '' }: {
  title?: React.ReactNode; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            {title && <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </Card>
  );
}

/* ============ الشارات ============ */

const badgeTones: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200'
};

export function Badge({ tone = 'slate', children, className = '' }: { tone?: keyof typeof badgeTones; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${badgeTones[tone] || badgeTones.slate} ${className}`}>
      {children}
    </span>
  );
}

export const statusTone: Record<string, keyof typeof badgeTones> = {
  'Nouvelle': 'sky', 'Confirmée': 'emerald', 'Rappel': 'amber', 'Appel-1': 'violet', 'Annulée': 'rose'
};
export const deliveryTone: Record<string, keyof typeof badgeTones> = {
  '': 'slate', 'Expédier vers': 'indigo', 'Livrée': 'emerald', 'Retour': 'rose', 'Out Of Stock': 'orange'
};
export const deliveryLabel: Record<string, string> = {
  '': 'لم تُشحن', 'Expédier vers': 'في الطريق', 'Livrée': 'مسلّمة', 'Retour': 'مرتجعة', 'Out Of Stock': 'نفاد المخزون'
};
export const actionLabel: Record<string, string> = {
  create: 'إضافة', update: 'تعديل', delete: 'حذف', import: 'استيراد', restore: 'استعادة'
};

/* ============ نافذة منبثقة ============ */

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`pv-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-extrabold text-slate-800">{title}</h2>
          <button className={btn.icon} onClick={onClose} aria-label="إغلاق"><Icon name="x" className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأكيد', danger, onConfirm, onCancel, busy }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
          <Icon name="alert" className="h-5 w-5" />
        </div>
        <p className="pt-2 text-sm leading-6 text-slate-600">{message}</p>
      </div>
      <div className="mt-5 flex justify-start gap-2">
        <button className={danger ? btn.danger : btn.primary} onClick={onConfirm} disabled={busy}>
          {busy ? 'جارٍ التنفيذ…' : confirmLabel}
        </button>
        <button className={btn.secondary} onClick={onCancel}>إلغاء</button>
      </div>
    </Modal>
  );
}

/* ============ التنبيهات (Toast) ============ */

type Toast = { id: number; kind: 'ok' | 'err' | 'info'; text: string };
const ToastCtx = createContext<{ toast: (text: string, kind?: Toast['kind']) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-5 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id}
            className={`pv-in pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg ${
              t.kind === 'ok' ? 'bg-emerald-600' : t.kind === 'err' ? 'bg-rose-600' : 'bg-slate-800'}`}>
            <Icon name={t.kind === 'ok' ? 'check' : t.kind === 'err' ? 'alert' : 'alert'} className="h-5 w-5" />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() { return useContext(ToastCtx).toast; }

/* ============ حالات فارغة وتحميل ============ */

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function EmptyState({ icon = 'box', title, sub, action }: { icon?: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <p className="text-sm font-extrabold text-slate-700">{title}</p>
      {sub && <p className="max-w-sm text-xs leading-5 text-slate-400">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ============ بطاقة KPI ============ */

const kpiTones: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-500'
};

export function Kpi({ label, value, sub, icon, tone = 'brand', delta }: {
  label: string; value: string; sub?: string; icon: string; tone?: keyof typeof kpiTones; delta?: number | null;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-xl font-extrabold tracking-tight text-slate-800" dir="ltr">{value}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
            {delta != null && isFinite(delta) && (
              <span className={`text-[11px] font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`} dir="ltr">
                {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}%
              </span>
            )}
          </div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpiTones[tone]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

/* ============ جدول ============ */

export function Th({ children, className = '', ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...rest} className={`whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-extrabold text-slate-500 ${className}`}>{children}</th>;
}
export function Td({ children, className = '', ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest} className={`whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 ${className}`}>{children}</td>;
}

export function Avatar({ name, className = 'h-9 w-9 text-sm' }: { name: string; className?: string }) {
  const colors = ['bg-brand-100 text-brand-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700'];
  const idx = (name || '?').charCodeAt(0) % colors.length;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-extrabold ${colors[idx]} ${className}`}>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}
