const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function money(n: number | null | undefined): string {
  return `${nf.format(Number(n) || 0)} DH`;
}
export function num(n: number | null | undefined): string {
  return nf.format(Number(n) || 0);
}
export function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${Math.round((part / total) * 1000) / 10}%`;
}
export function dmy(iso: string | undefined): string {
  if (!iso) return '—';
  const m = String(iso).slice(0, 10);
  const [y, mo, d] = m.split('-');
  return d && mo && y ? `${d}/${mo}/${y}` : m;
}
export function dmyhm(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return dmy(iso);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function todayISO(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function shortDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d.getDay()];
}
export function inRange(date: string, from: string | null, to: string | null): boolean {
  const d = (date || '').slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
export function downloadFile(name: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
export function toCSV(rows: Record<string, unknown>[], headers?: [string, string][]): string {
  if (!rows.length) return '';
  const cols = headers ?? Object.keys(rows[0]).map((k) => [k, k] as [string, string]);
  const esc = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [cols.map(([, h]) => esc(h)).join(',')];
  for (const r of rows) lines.push(cols.map(([k]) => esc((r as any)[k])).join(','));
  return '\uFEFF' + lines.join('\r\n');
}
