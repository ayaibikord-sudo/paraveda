import React, { useEffect, useMemo, useState } from 'react';
import { useApp, useData } from '../state/store';
import { api } from '../lib/api';
import { Badge, Card, ConfirmDialog, EmptyState, Kpi, Modal, Td, Th, btn, inputCls, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import PeriodFilter, { periodFromPreset, Preset, Period } from '../components/PeriodFilter';
import { computeProductPerf, inRange } from '../lib/calc';
import { dmy, downloadFile, money, num, todayISO } from '../lib/format';
import type { AdSpend } from '../lib/types';

function AdModal({ initial, onClose }: { initial: Partial<AdSpend>; onClose: () => void }) {
  const data = useData();
  const { refresh } = useApp();
  const toast = useToast();
  const [f, setF] = useState({
    date: initial.date || todayISO(),
    productName: initial.productName || '',
    source: initial.source || data.settings.sources[0] || '',
    agent: initial.agent || '',
    amount: initial.amount || 0,
    note: initial.note || ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.productName || !f.amount) return toast('اختر المنتوج وأدخل المبلغ', 'err');
    setBusy(true);
    try {
      if (initial.id) await api.updateAd(initial.id, f);
      else await api.createAd(f);
      toast('تم حفظ مصروف الإعلان');
      await refresh();
      onClose();
    } catch {
      toast('تعذّر الحفظ', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial.id ? 'تعديل مصروف إعلاني' : 'مصروف إعلاني جديد'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">التاريخ *</span>
            <input type="date" className={inputCls} value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">المبلغ (DH) *</span>
            <input type="number" min={0} step="0.01" className={inputCls} value={f.amount} onChange={(e) => set('amount', Number(e.target.value) || 0)} /></label>
          <label className="block col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">المنتوج *</span>
            <select className={inputCls} value={f.productName} onChange={(e) => set('productName', e.target.value)}>
              <option value="">— اختر —</option>
              {data.products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">المصدر</span>
            <select className={inputCls} value={f.source} onChange={(e) => set('source', e.target.value)}>
              <option value="">—</option>
              {data.settings.sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">المسؤولة</span>
            <select className={inputCls} value={f.agent} onChange={(e) => set('agent', e.target.value)}>
              <option value="">—</option>
              {data.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select></label>
        </div>
        <div className="flex gap-2 pt-2">
          <button className={btn.primary} onClick={save} disabled={busy}><Icon name="check" className="h-4 w-4" />{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          <button className={btn.secondary} onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Ads() {
  const { refresh } = useApp();
  const data = useData();
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('30d');
  const [period, setPeriod] = useState<Period>(periodFromPreset('30d'));
  const [product, setProduct] = useState('');
  const [source, setSource] = useState('');
  const [modal, setModal] = useState<Partial<AdSpend> | null>(null);
  const [delTarget, setDelTarget] = useState<AdSpend | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const rows = useMemo(() => data.adspend
    .filter((a) => inRange(a.date, period.from, period.to))
    .filter((a) => (!product || a.productName === product) && (!source || a.source === source))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  [data.adspend, period, product, source]);

  const totalSpend = rows.reduce((a, x) => a + x.amount, 0);
  const perf = useMemo(
    () => computeProductPerf(data.orders, data.products, data.adspend, period.from, period.to).filter((p) => p.spend > 0 || p.orders > 0),
    [data, period]
  );
  const revenue = perf.reduce((a, p) => a + p.revenue, 0);
  const profit = perf.reduce((a, p) => a + p.profit, 0);
  const roas = totalSpend ? revenue / totalSpend : 0;

  const del = async () => {
    if (!delTarget) return;
    setBusyDel(true);
    try {
      await api.deleteAd(delTarget.id);
      toast('تم الحذف');
      setDelTarget(null);
      await refresh();
    } catch { toast('تعذّر الحذف', 'err'); } finally { setBusyDel(false); }
  };

  const exportCsv = () => {
    downloadFile(`paraveda-ads-${todayISO()}.csv`, '\uFEFF' + [
      ['date', 'product', 'source', 'agent', 'amount', 'note'].join(','),
      ...rows.map((a) => [a.date, `"${a.productName}"`, a.source, a.agent, a.amount, `"${a.note}"`].join(','))
    ].join('\r\n'), 'text/csv');
    toast('تم التصدير');
  };

  const sel = 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 shadow-sm focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter preset={preset} onPreset={setPreset} period={period} onPeriod={setPeriod} />
        <div className="flex gap-2">
          <button className={btn.secondary} onClick={exportCsv}><Icon name="download" className="h-4 w-4" />CSV</button>
          <button className={btn.primary} onClick={() => setModal({})}><Icon name="plus" className="h-4 w-4" />مصروف جديد</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="إجمالي الإنفاق" value={money(totalSpend)} icon="megaphone" tone="rose" />
        <Kpi label="مبيعات الفترة" value={money(revenue)} sub="المسلّمة فقط" icon="chart" tone="sky" />
        <Kpi label="ROAS" value={roas ? `${roas.toFixed(2)}×` : '—'} sub="العائد على الإنفاق الإعلاني" icon="refresh" tone="violet" />
        <Kpi label="صافي الربح" value={money(profit)} sub="بعد كل التكاليف" icon="money" tone={profit >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <select className={sel} value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">كل المنتوجات</option>
          {[...new Set(data.adspend.map((a) => a.productName).filter(Boolean))].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">كل المصادر</option>
          {data.settings.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr><Th>التاريخ</Th><Th>المنتوج</Th><Th>المصدر</Th><Th>المسؤولة</Th><Th>المبلغ</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((a) => (
                <tr key={a.id} className="transition hover:bg-brand-50/40">
                  <Td className="text-slate-400">{dmy(a.date)}</Td>
                  <Td className="font-bold">{a.productName}</Td>
                  <Td>{a.source ? <Badge tone="indigo">{a.source}</Badge> : '—'}</Td>
                  <Td>{a.agent || '—'}</Td>
                  <Td className="font-extrabold text-rose-600" dir="ltr">-{money(a.amount).replace(' DH', '')} DH</Td>
                  <Td>
                    <div className="flex gap-0.5">
                      <button className={btn.icon} onClick={() => setModal(a)}><Icon name="edit" className="h-4 w-4" /></button>
                      <button className={`${btn.icon} hover:bg-rose-50 hover:text-rose-600`} onClick={() => setDelTarget(a)}><Icon name="trash" className="h-4 w-4" /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <EmptyState icon="megaphone" title="لا توجد مصاريف إعلانية في هذه الفترة" sub="سجّل مصاريف الإعلان لمتابعة العائد الحقيقي لكل منتوج" />}
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-extrabold text-slate-800">أداء المنتوجات مع الإعلانات</h3>
          <p className="mt-0.5 text-xs text-slate-400">الصافي = المبيعات − الشراء − العمولات − التوصيل − الإعلانات</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr><Th>المنتوج</Th><Th>طلبيات</Th><Th>مسلّمة</Th><Th>المبيعات</Th><Th>الإنفاق</Th><Th>ROAS</Th><Th>الصافي</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {perf.map((p) => (
                <tr key={p.name} className="transition hover:bg-brand-50/40">
                  <Td className="max-w-[240px] truncate font-bold" title={p.name}>{p.name}</Td>
                  <Td className="text-center">{num(p.orders)}</Td>
                  <Td className="text-center font-bold text-emerald-700">{num(p.delivered)}</Td>
                  <Td className="font-bold" dir="ltr">{money(p.revenue)}</Td>
                  <Td className="text-rose-600" dir="ltr">{p.spend ? `-${money(p.spend).replace(' DH', '')} DH` : '—'}</Td>
                  <Td dir="ltr">{p.spend ? `${(p.revenue / p.spend).toFixed(1)}×` : '—'}</Td>
                  <Td className={`font-extrabold ${p.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`} dir="ltr">{money(p.profit)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!perf.length && <EmptyState icon="chart" title="لا توجد بيانات في هذه الفترة" />}
      </Card>

      {modal && <AdModal initial={modal} onClose={() => setModal(null)} />}
      <ConfirmDialog open={!!delTarget} title="حذف المصروف" danger busy={busyDel}
        message={`حذف مصروف "${delTarget?.productName}" بمبلغ ${delTarget?.amount} DH؟`}
        confirmLabel="حذف" onConfirm={del} onCancel={() => setDelTarget(null)} />
    </div>
  );
}
