import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart
} from 'recharts';
import { useApp, useData } from '../state/store';
import PeriodFilter, { periodFromPreset, Preset, Period } from '../components/PeriodFilter';
import { Badge, Card, EmptyState, Kpi, SectionCard, Td, Th, statusTone, deliveryTone, deliveryLabel } from '../components/ui';
import { computeCityStats, computeDaily, computeKpis, computeProductPerf, computeProfit, inRange } from '../lib/calc';
import { dmy, money, num, pct } from '../lib/format';

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#64748b', '#f97316', '#6366f1'];

export default function Dashboard() {
  const { user, isAdmin } = useApp();
  const data = useData();
  const [preset, setPreset] = useState<Preset>('30d');
  const [period, setPeriod] = useState<Period>(periodFromPreset('30d'));

  const orders = data.orders;
  const scoped = useMemo(
    () => (isAdmin ? orders : orders.filter((o) => o.agent.toLowerCase() === user!.name.toLowerCase())),
    [orders, isAdmin, user]
  );

  const k = useMemo(() => computeProfit(scoped, data.products, data.adspend, period.from, period.to), [scoped, data, period]);

  const prev = useMemo(() => {
    if (!period.from || !period.to) return null;
    const days = Math.max(1, Math.round((+new Date(period.to) - +new Date(period.from)) / 86400000) + 1);
    const pFrom = new Date(period.from);
    pFrom.setDate(pFrom.getDate() - days);
    const to = new Date(period.from);
    to.setDate(to.getDate() - 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return computeProfit(scoped, data.products, data.adspend, fmt(pFrom), fmt(to));
  }, [scoped, data, period]);

  const delta = (cur: number, old: number | undefined): number | null => {
    if (old === undefined || prev === null) return null;
    if (!old) return cur > 0 ? 100 : null;
    return ((cur - old) / old) * 100;
  };

  const daily = useMemo(() => computeDaily(scoped, period.from, period.to), [scoped, period]);
  const perf = useMemo(() => computeProductPerf(scoped, data.products, data.adspend, period.from, period.to), [scoped, data, period]);
  const cityStats = useMemo(() => computeCityStats(scoped, data.cities, period.from, period.to), [scoped, data, period]);

  const statusPie = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of scoped) {
      if (!inRange(o.date, period.from, period.to)) continue;
      const key = o.status || 'Nouvelle';
      m.set(key, (m.get(key) || 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [scoped, period]);

  const recent = useMemo(
    () => [...scoped].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id).slice(0, 8),
    [scoped]
  );

  const showMoney = true;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter preset={preset} onPreset={setPreset} period={period} onPeriod={setPeriod} />
        <p className="text-xs font-bold text-slate-400">
          {num(k.total)} طلبية في الفترة
        </p>
      </div>

      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        <Kpi label="الطلبيات" value={num(k.total)} icon="cart" tone="brand" delta={delta(k.total, prev?.total)} />
        <Kpi label="المسلّمة" value={num(k.delivered)} sub={`نسبة التوصيل ${pct(k.delivered, k.total)}`} icon="truck" tone="emerald" delta={delta(k.delivered, prev?.delivered)} />
        <Kpi label="رقم المعاملات" value={showMoney ? money(k.revenue) : '—'} sub="الطلبيات المسلّمة فقط" icon="chart" tone="sky" delta={delta(k.revenue, prev?.revenue)} />
        {isAdmin ? (
          <Kpi label="صافي الربح" value={money(k.profit)} sub={`بعد التكاليف والعمولات والشحن${k.adspend ? ' والإعلانات' : ''}`} icon="money" tone={k.profit >= 0 ? 'emerald' : 'rose'} delta={delta(k.profit, prev?.profit)} />
        ) : (
          <Kpi label="المؤكدة" value={num(k.confirmed)} sub={`نسبة التأكيد ${pct(k.confirmed, k.total)}`} icon="check" tone="violet" delta={delta(k.confirmed, prev?.confirmed)} />
        )}
        {isAdmin && <Kpi label="مصاريف الإعلانات" value={money(k.adspend)} sub={k.roas ? `ROAS ${k.roas.toFixed(1)}×` : '—'} icon="megaphone" tone="amber" delta={delta(k.adspend, prev?.adspend)} />}
      </div>

      {/* الرسوم البيانية */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-800">تطور الطلبيات والمبيعات</h3>
          <div className="mt-4 h-72" dir="ltr">
            {daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis yAxisId="count" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis yAxisId="money" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit' }}
                    formatter={(value: any, name: any) => [name === 'revenue' ? money(Number(value)) : value, name === 'orders' ? 'طلبيات' : name === 'delivered' ? 'مسلّمة' : 'المبيعات']}
                    labelFormatter={(l: any) => `يوم ${l}`} />
                  <Legend formatter={(v: any) => (v === 'orders' ? 'طلبيات' : v === 'delivered' ? 'مسلّمة' : 'المبيعات')} wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="count" dataKey="orders" fill="#c7d2fe" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar yAxisId="count" dataKey="delivered" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Line yAxisId="money" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="chart" title="لا توجد بيانات في هذه الفترة" sub="جرّب توسيع الفترة الزمنية من الفلاتر أعلاه" />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-extrabold text-slate-800">توزيع حالات الطلبيات</h3>
          <div className="mt-4 h-72" dir="ltr">
            {statusPie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} strokeWidth={0}>
                    {statusPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend formatter={(v: any) => String(v)} wrapperStyle={{ fontSize: 11, fontFamily: 'inherit' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="chart" title="لا توجد بيانات" />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="أفضل المنتوجات" subtitle="حسب رقم المعاملات للمسلّم">
          {perf.length ? (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...perf].sort((a, b) => b.revenue - a.revenue).slice(0, 6)} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: '#475569' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(v: any) => [money(Number(v)), 'المبيعات']} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon="box" title="لا توجد بيانات" />}
        </SectionCard>

        <SectionCard title="أعلى المدن" subtitle="عدد الطلبيات في الفترة">
          {cityStats.length ? (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityStats.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: '#475569' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(v: any) => [v, 'طلبيات']} />
                  <Bar dataKey="orders" fill="#0ea5e9" radius={[0, 6, 6, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon="building" title="لا توجد بيانات" />}
        </SectionCard>
      </div>

      <SectionCard title="أحدث الطلبيات"
        actions={<Badge tone="slate">آخر {recent.length} طلبية</Badge>}>
        {recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <Th>الزبون</Th><Th>الهاتف</Th><Th>المدينة</Th><Th>المنتوج</Th><Th>الثمن</Th><Th>المسؤولة</Th><Th>الحالة</Th><Th>التوصيل</Th><Th>التاريخ</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recent.map((o) => (
                  <tr key={o.id} className="transition hover:bg-slate-50/60">
                    <Td className="font-bold">{o.customerName}</Td>
                    <Td dir="ltr" className="text-left text-slate-500">{o.phone}</Td>
                    <Td>{o.city}</Td>
                    <Td className="max-w-[220px] truncate" title={o.productName}>{o.productName}</Td>
                    <Td className="font-bold">{money(o.price * o.qty)}</Td>
                    <Td>{o.agent || '—'}</Td>
                    <Td><Badge tone={statusTone[o.status] || 'slate'}>{o.status}</Badge></Td>
                    <Td><Badge tone={deliveryTone[o.delivery] || 'slate'}>{deliveryLabel[o.delivery] || '—'}</Badge></Td>
                    <Td className="text-slate-400">{dmy(o.date)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="cart" title="لا توجد طلبات بعد" sub="أضف أول طلبية من صفحة الطلبيات" />}
      </SectionCard>
    </div>
  );
}
