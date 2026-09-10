import React, { useEffect, useMemo, useState } from 'react';
import { useApp, useData } from '../state/store';
import { api } from '../lib/api';
import { Card, EmptyState, Kpi, Td, Th, btn, inputCls, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { computeCityStats } from '../lib/calc';
import { money, num, pct } from '../lib/format';

const PAGE_SIZE = 30;

export default function Cities() {
  const { refresh } = useApp();
  const data = useData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'orders' | 'revenue'>('name');

  const stats = useMemo(
    () => new Map(computeCityStats(data.orders, data.cities, null, null).map((s) => [s.name.trim().toLowerCase(), s])),
    [data]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.cities.filter((c) => !needle || c.name.toLowerCase().includes(needle));
    if (sortBy === 'orders') list.sort((a, b) => (stats.get(b.name.toLowerCase())?.orders || 0) - (stats.get(a.name.toLowerCase())?.orders || 0));
    else if (sortBy === 'revenue') list.sort((a, b) => (stats.get(b.name.toLowerCase())?.revenue || 0) - (stats.get(a.name.toLowerCase())?.revenue || 0));
    else list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return list;
  }, [data.cities, q, sortBy, stats]);

  useEffect(() => { setPage(1); }, [q, sortBy]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totals = useMemo(() => {
    let orders = 0, delivered = 0;
    for (const s of stats.values()) { orders += s.orders; delivered += s.delivered; }
    return { cities: data.cities.length, orders, delivered };
  }, [stats, data.cities]);

  const saveEdits = async () => {
    const updates = Object.entries(edits).map(([id, price]) => ({ id: Number(id), price }));
    if (!updates.length) return;
    setBusy(true);
    try {
      await api.updateCities(updates);
      toast(`تم تحديث ${updates.length} مدينة`);
      setEdits({});
      await refresh();
    } catch {
      toast('تعذّر الحفظ', 'err');
    } finally {
      setBusy(false);
    }
  };

  const dirty = Object.keys(edits).length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="عدد المدن" value={num(totals.cities)} icon="building" tone="brand" />
        <Kpi label="طلبيات المدن" value={num(totals.orders)} icon="cart" tone="sky" />
        <Kpi label="مسلّمة" value={num(totals.delivered)} sub={`نسبة ${pct(totals.delivered, totals.orders)}`} icon="check" tone="emerald" />
        <Kpi label="متوسط التوصيل" value={money(
          data.cities.length ? data.cities.reduce((a, c) => a + c.price, 0) / data.cities.length : 0
        )} icon="money" tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
          <input className={`${inputCls} pl-9`} placeholder="بحث عن مدينة…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 shadow-sm focus:outline-none"
          value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="name">ترتيب: أبجدي</option>
          <option value="orders">ترتيب: أكثر طلبيات</option>
          <option value="revenue">ترتيب: أكبر مبيعات</option>
        </select>
        {dirty && (
          <button className={btn.primary} onClick={saveEdits} disabled={busy}>
            <Icon name="check" className="h-4 w-4" />{busy ? 'جارٍ الحفظ…' : `حفظ التعديلات (${Object.keys(edits).length})`}
          </button>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <Th>المدينة</Th><Th>ثمن التوصيل</Th><Th>طلبيات</Th><Th>مسلّمة</Th><Th>نسبة التوصيل</Th><Th>المبيعات المسلّمة</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((c) => {
                const s = stats.get(c.name.trim().toLowerCase());
                const editing = edits[c.id] !== undefined;
                return (
                  <tr key={c.id} className={`transition hover:bg-brand-50/40 ${editing ? 'bg-amber-50/40' : ''}`}>
                    <Td className="font-bold">{c.name}</Td>
                    <Td>
                      <input type="number" min={0}
                        className="num w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        value={editing ? edits[c.id] : c.price}
                        onChange={(e) => setEdits((m) => ({ ...m, [c.id]: Number(e.target.value) || 0 }))} />
                    </Td>
                    <Td className="text-center font-bold">{s ? num(s.orders) : '—'}</Td>
                    <Td className="text-center font-bold text-emerald-700">{s ? num(s.delivered) : '—'}</Td>
                    <Td>{s && s.orders ? pct(s.delivered, s.orders) : '—'}</Td>
                    <Td className="font-bold" dir="ltr">{s ? money(s.revenue) : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <EmptyState icon="building" title="لا توجد مدن مطابقة" />}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
            <p className="text-xs font-bold text-slate-400" dir="ltr">صفحة {safePage} / {pages} — {num(filtered.length)} مدينة</p>
            <div className="flex gap-1.5">
              <button className={btn.secondary} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>السابق</button>
              <button className={btn.secondary} disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>التالي</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
