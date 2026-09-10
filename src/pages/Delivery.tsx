import React, { useMemo, useState } from 'react';
import { useApp, useData } from '../state/store';
import { api } from '../lib/api';
import { Badge, Card, EmptyState, Kpi, Td, Th, btn, deliveryLabel, deliveryTone, inputCls, statusTone, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import PeriodFilter, { periodFromPreset, Preset, Period } from '../components/PeriodFilter';
import { DELIVERED } from '../lib/types';
import type { Order } from '../lib/types';
import { computeKpis, inRange } from '../lib/calc';
import { dmy, money, num, pct } from '../lib/format';

const DELIVERY_FLOW = ['', 'Expédier vers', 'Livrée', 'Retour', 'Out Of Stock'];

export default function Delivery() {
  const { refresh } = useApp();
  const data = useData();
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('30d');
  const [period, setPeriod] = useState<Period>(periodFromPreset('30d'));
  const [tab, setTab] = useState<string>('all');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const scoped = useMemo(
    () => data.orders.filter((o) => inRange(o.date, period.from, period.to) && o.delivery),
    [data.orders, period]
  );
  const k = useMemo(() => computeKpis(scoped, [], period.from, period.to), [scoped, period]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped
      .filter((o) => (tab === 'all' ? true : o.delivery === tab))
      .filter((o) => !needle || [o.customerName, o.phone, o.city, o.productName].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
  }, [scoped, tab, q]);

  const setDeliveryStatus = async (o: Order, delivery: string) => {
    setBusyId(o.id);
    try {
      await api.updateOrder(o.id, { ...o, delivery });
      await refresh();
    } catch {
      toast('تعذّر تحديث الحالة', 'err');
    } finally {
      setBusyId(null);
    }
  };

  const chips = [
    { id: 'all', label: 'الكل', count: scoped.length },
    ...DELIVERY_FLOW.filter((d) => d).map((d) => ({ id: d, label: deliveryLabel[d], count: scoped.filter((o) => o.delivery === d).length }))
  ];

  return (
    <div className="space-y-4">
      <PeriodFilter preset={preset} onPreset={setPreset} period={period} onPeriod={setPeriod} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="مسلّمة" value={num(k.delivered)} sub={`نسبة النجاح ${pct(k.delivered, k.delivered + k.returned)}`} icon="check" tone="emerald" />
        <Kpi label="في الطريق" value={num(k.shipping)} icon="truck" tone="indigo" />
        <Kpi label="مرتجعة" value={num(k.returned)} sub={`نسبة الإرجاع ${pct(k.returned, k.delivered + k.returned)}`} icon="refresh" tone="rose" />
        <Kpi label="نفاد المخزون" value={num(k.outOfStock)} icon="alert" tone="amber" />
        <Kpi label="رسوم التوصيل" value={money(k.fees)} sub="تُحسب حسب مدينة الزبون — المرتجع = 0" icon="money" tone="brand" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <button key={c.id} onClick={() => setTab(c.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === c.id ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {c.label}
            <span className={`rounded-full px-1.5 text-[10px] ${tab === c.id ? 'bg-white/20' : 'bg-slate-100'}`} dir="ltr">{c.count}</span>
          </button>
        ))}
        <div className="relative ms-auto min-w-[200px]">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
          <input className={`${inputCls} pl-9 py-1.5 text-xs`} placeholder="بحث في الشحنات…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <Th>#</Th><Th>التاريخ</Th><Th>الزبون</Th><Th>الهاتف</Th><Th>المدينة</Th><Th>المنتوج</Th>
                <Th>المسؤولة</Th><Th>حالة التأكيد</Th><Th>حالة التوصيل</Th><Th>رسوم التوصيل</Th><Th>تغيير الحالة</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.slice(0, 200).map((o) => (
                <tr key={o.id} className="transition hover:bg-brand-50/40">
                  <Td className="text-[11px] text-slate-400">{o.id}</Td>
                  <Td className="text-slate-400">{dmy(o.date)}</Td>
                  <Td className={`font-bold ${o.delivery === 'Retour' ? 'text-rose-600 line-through decoration-rose-400' : ''}`}>{o.customerName}</Td>
                  <Td dir="ltr" className="text-left text-slate-500">{o.phone}</Td>
                  <Td>{o.city}</Td>
                  <Td className="max-w-[200px] truncate" title={o.productName}>{o.productName}</Td>
                  <Td>{o.agent || '—'}</Td>
                  <Td><Badge tone={statusTone[o.status] || 'slate'}>{o.status}</Badge></Td>
                  <Td><Badge tone={deliveryTone[o.delivery] || 'slate'}>{deliveryLabel[o.delivery]}</Badge></Td>
                  <Td className="font-bold" dir="ltr">{o.delivery === DELIVERED ? money(o.deliveryFee) : '0 DH'}</Td>
                  <Td>
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600 focus:border-brand-500 focus:outline-none disabled:opacity-50"
                      value={o.delivery} disabled={busyId === o.id}
                      onChange={(e) => setDeliveryStatus(o, e.target.value)}>
                      <option value="">— لم تُشحن —</option>
                      {DELIVERY_FLOW.filter((d) => d).map((d) => <option key={d} value={d}>{deliveryLabel[d]}</option>)}
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <EmptyState icon="truck" title="لا توجد شحنات في هذه الفترة" sub="غيّر الفترة أو الفلاتر أعلاه" />}
        {filtered.length > 200 && (
          <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] font-bold text-slate-400">
            تُعرض أول 200 شحنة — استخدم البحث لتصفية النتائج
          </p>
        )}
      </Card>
    </div>
  );
}
