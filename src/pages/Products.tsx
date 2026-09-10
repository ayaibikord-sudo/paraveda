import React, { useMemo, useState } from 'react';
import { useApp, useData } from '../state/store';
import { api } from '../lib/api';
import { Badge, Card, ConfirmDialog, EmptyState, Kpi, Modal, Td, Th, btn, inputCls, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import PeriodFilter, { periodFromPreset, Preset, Period } from '../components/PeriodFilter';
import type { Product } from '../lib/types';
import { computeProductPerf } from '../lib/calc';
import { money, num, pct } from '../lib/format';

function ProductModal({ initial, onClose }: { initial: Partial<Product>; onClose: () => void }) {
  const { refresh } = useApp();
  const toast = useToast();
  const [f, setF] = useState({
    name: initial.name || '',
    price: initial.price || 0,
    commission: initial.commission || 0,
    cost: initial.cost || 0,
    stock: initial.stock ?? ('' as string | number),
    link: initial.link || ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return toast('اسم المنتوج مطلوب', 'err');
    setBusy(true);
    try {
      const body = { ...f, stock: f.stock === '' ? null : Number(f.stock) };
      if (initial.id) await api.updateProduct(initial.id, body);
      else await api.createProduct(body);
      toast(initial.id ? 'تم تحديث المنتوج' : 'تمت إضافة المنتوج');
      await refresh();
      onClose();
    } catch {
      toast('تعذّر الحفظ', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial.id ? 'تعديل منتوج' : 'منتوج جديد'}>
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">اسم المنتوج *</span>
          <input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">ثمن البيع (DH)</span>
            <input type="number" min={0} className={inputCls} value={f.price} onChange={(e) => set('price', Number(e.target.value) || 0)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">العمولة (DH)</span>
            <input type="number" min={0} className={inputCls} value={f.commission} onChange={(e) => set('commission', Number(e.target.value) || 0)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">ثمن الشراء (DH)</span>
            <input type="number" min={0} className={inputCls} value={f.cost} onChange={(e) => set('cost', Number(e.target.value) || 0)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">المخزون</span>
            <input type="number" min={0} className={inputCls} value={f.stock} onChange={(e) => set('stock', e.target.value)} placeholder="غير محدود" /></label>
        </div>
        <div className="flex gap-2 pt-2">
          <button className={btn.primary} onClick={save} disabled={busy}><Icon name="check" className="h-4 w-4" />{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          <button className={btn.secondary} onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Products() {
  const { isAdmin, refresh } = useApp();
  const data = useData();
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('all');
  const [period, setPeriod] = useState<Period>(periodFromPreset('all'));
  const [modal, setModal] = useState<Partial<Product> | null>(null);
  const [delTarget, setDelTarget] = useState<Product | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const perf = useMemo(
    () => computeProductPerf(data.orders, data.products, data.adspend, period.from, period.to),
    [data, period]
  );
  const perfByName = useMemo(() => new Map(perf.map((p) => [p.name.trim().toLowerCase(), p])), [perf]);
  const totals = useMemo(() => perf.reduce(
    (a, p) => ({ orders: a.orders + p.orders, delivered: a.delivered + p.delivered, revenue: a.revenue + p.revenue, profit: a.profit + p.profit, spend: a.spend + p.spend }),
    { orders: 0, delivered: 0, revenue: 0, profit: 0, spend: 0 }
  ), [perf]);

  const del = async () => {
    if (!delTarget) return;
    setBusyDel(true);
    try {
      await api.deleteProduct(delTarget.id);
      toast('تم حذف المنتوج');
      setDelTarget(null);
      await refresh();
    } catch {
      toast('تعذّر الحذف', 'err');
    } finally {
      setBusyDel(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter preset={preset} onPreset={setPreset} period={period} onPeriod={setPeriod} />
        {isAdmin && <button className={btn.primary} onClick={() => setModal({})}><Icon name="plus" className="h-4 w-4" />منتوج جديد</button>}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="المنتوجات" value={num(data.products.length)} icon="box" tone="brand" />
          <Kpi label="طلبيات الفترة" value={num(totals.orders)} sub={`مسلّمة: ${num(totals.delivered)}`} icon="cart" tone="sky" />
          <Kpi label="مبيعات الفترة" value={money(totals.revenue)} icon="chart" tone="emerald" />
          <Kpi label="صافي الفترة" value={money(totals.profit)} sub={totals.spend ? `إعلانات: ${money(totals.spend)}` : undefined} icon="money" tone={totals.profit >= 0 ? 'emerald' : 'rose'} />
        </div>
      )}

      {/* الجدول */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <Th>المنتوج</Th><Th>ثمن البيع</Th>
                {isAdmin && <Th>ثمن الشراء</Th>}
                <Th>العمولة</Th><Th>المخزون</Th>
                {isAdmin && <Th>طلبيات</Th>}
                <Th>مسلّمة</Th><Th>نسبة التوصيل</Th>
                {isAdmin && <Th>المبيعات</Th>}
                {isAdmin && <Th>الصافي</Th>}
                {isAdmin && <Th></Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.products.map((p) => {
                const s = perfByName.get(p.name.trim().toLowerCase());
                return (
                  <tr key={p.id} className="transition hover:bg-brand-50/40">
                    <Td className="max-w-[260px]">
                      <span className="block truncate font-bold" title={p.name}>{p.name}</span>
                    </Td>
                    <Td className="font-extrabold" dir="ltr">{money(p.price)}</Td>
                    {isAdmin && <Td dir="ltr">{money(p.cost)}</Td>}
                    <Td dir="ltr">{p.commission} DH</Td>
                    <Td>{p.stock == null ? <Badge tone="slate">غير محدود</Badge> : (p.stock > 0 ? <Badge tone="emerald">{p.stock}</Badge> : <Badge tone="rose">نفد</Badge>)}</Td>
                    {isAdmin && <Td className="text-center font-bold">{s ? num(s.orders) : '—'}</Td>}
                    <Td className="text-center font-bold text-emerald-700">{s ? num(s.delivered) : '—'}</Td>
                    <Td>{s && s.orders ? pct(s.delivered, s.orders) : '—'}</Td>
                    {isAdmin && <Td className="font-bold" dir="ltr">{s ? money(s.revenue) : '—'}</Td>}
                    {isAdmin && (
                      <Td className={`font-extrabold ${!s ? '' : s.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`} dir="ltr">
                        {s ? money(s.profit) : '—'}
                      </Td>
                    )}
                    {isAdmin && (
                      <Td>
                        <div className="flex items-center gap-0.5">
                          <button className={btn.icon} title="تعديل" onClick={() => setModal(p)}><Icon name="edit" className="h-4 w-4" /></button>
                          <button className={`${btn.icon} hover:bg-rose-50 hover:text-rose-600`} title="حذف" onClick={() => setDelTarget(p)}><Icon name="trash" className="h-4 w-4" /></button>
                        </div>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!data.products.length && (
          <EmptyState icon="box" title="لا توجد منتوجات بعد"
            action={isAdmin && <button className={btn.primary} onClick={() => setModal({})}>إضافة أول منتوج</button>} />
        )}
      </Card>

      {isAdmin && perf.length > 0 && (
        <Card className="p-4">
          <p className="text-[11px] font-bold leading-5 text-slate-400">
            💡 الصافي = مبيعات المسلّم − ثمن الشراء − العمولات − رسوم التوصيل − مصاريف الإعلان.
            رسوم التوصيل تُحسب تلقائياً حسب مدينة كل زبون، والمرتجعات = 0.
          </p>
        </Card>
      )}

      {modal && <ProductModal initial={modal} onClose={() => setModal(null)} />}
      <ConfirmDialog
        open={!!delTarget} title="حذف المنتوج" danger busy={busyDel}
        message={`حذف "${delTarget?.name}" من الكتالوج؟ الطلبيات المرتبطة به لن تُمس.`}
        confirmLabel="حذف" onConfirm={del} onCancel={() => setDelTarget(null)} />
    </div>
  );
}
