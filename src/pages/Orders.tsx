import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useData } from '../state/store';
import { api } from '../lib/api';
import {
  Badge, ConfirmDialog, EmptyState, Modal, Td, Th, btn, deliveryLabel, deliveryTone, inputCls, statusTone, useToast
} from '../components/ui';
import { Icon } from '../components/icons';
import { ORDER_STATUSES, DELIVERED } from '../lib/types';
import type { City, Order } from '../lib/types';
import { dmy, downloadFile, money, num, toCSV, todayISO } from '../lib/format';

/* ---------- حقل اختيار مدينة مع بحث ---------- */
function CityCombo({ cities, value, onChange, placeholder = 'اكتب أو اختر المدينة…' }: {
  cities: City[]; value: string; onChange: (name: string, price: number) => void; placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const list = useMemo(() => {
    const needle = (q || value || '').trim().toLowerCase();
    const src = needle ? cities.filter((c) => c.name.toLowerCase().includes(needle)) : cities;
    return src.slice(0, 60);
  }, [cities, q, value]);
  return (
    <div className="relative" ref={boxRef}>
      <input className={inputCls} value={open ? q : value} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setQ(''); setOpen(true); }} />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {list.length ? list.map((c) => (
            <button type="button" key={c.id}
              className="flex w-full items-center justify-between px-3 py-1.5 text-right text-sm transition hover:bg-brand-50"
              onClick={() => { onChange(c.name, c.price); setOpen(false); setQ(''); }}>
              <span className="font-semibold text-slate-700">{c.name}</span>
              <span className="text-[11px] font-bold text-slate-400" dir="ltr">{c.price} DH</span>
            </button>
          )) : <p className="px-3 py-2 text-xs text-slate-400">لا توجد مدينة بهذا الاسم</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- فورم الطلبية ---------- */
function OrderModal({ initial, onClose }: { initial: Partial<Order> & { id?: number }; onClose: () => void }) {
  const data = useData();
  const { user, isAdmin, refresh } = useApp();
  const toast = useToast();
  const [f, setF] = useState({
    date: initial.date || todayISO(),
    customerName: initial.customerName || '',
    phone: initial.phone || '',
    city: initial.city || '',
    address: initial.address || '',
    productId: initial.productId ?? null as number | null,
    productName: initial.productName || '',
    qty: initial.qty || 1,
    price: initial.price || 0,
    commission: initial.commission || 0,
    deliveryFee: initial.deliveryFee || 0,
    agent: initial.agent || user?.name || '',
    source: initial.source || data.settings.sources[0] || '',
    status: initial.status || 'Nouvelle',
    delivery: initial.delivery ?? '',
    upsell: initial.upsell || 0,
    note: initial.note || ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  const onProduct = (id: string) => {
    const p = data.products.find((x) => x.id === Number(id));
    if (p) setF((s) => ({ ...s, productId: p.id, productName: p.name, price: p.price, commission: p.commission }));
    else set('productId', null);
  };
  const onCity = (name: string, price: number) => {
    setF((s) => ({ ...s, city: name, deliveryFee: s.delivery === DELIVERED ? price : 0 }));
  };
  const setDelivery = (d: string) => {
    const city = data.cities.find((c) => c.name.toLowerCase() === f.city.trim().toLowerCase());
    setF((s) => ({ ...s, delivery: d, deliveryFee: d === DELIVERED ? (city?.price || 0) : 0 }));
  };

  const save = async () => {
    if (!f.customerName.trim() || !f.productName.trim()) {
      toast('الزبون والمنتوج مطلوبان', 'err');
      return;
    }
    setBusy(true);
    try {
      if (initial.id) {
        await api.updateOrder(initial.id, f);
        toast('تم تحديث الطلبية');
      } else {
        await api.createOrder(f);
        toast('تمت إضافة الطلبية');
      }
      await refresh();
      onClose();
    } catch (e: any) {
      toast(e.code === 'forbidden' ? 'غير مسموح لك بتعديل هذه الطلبية' : 'حدث خطأ أثناء الحفظ', 'err');
    } finally {
      setBusy(false);
    }
  };

  const agents = data.users.filter((u) => u.active && u.role === 'agent');
  const canPickAgent = isAdmin;

  return (
    <Modal open onClose={onClose} wide title={initial.id ? `تعديل الطلبية #${initial.id}` : 'طلبية جديدة'}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-extrabold text-brand-600">👤 معلومات الزبون</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">الاسم الكامل *</span>
              <input className={inputCls} value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">الهاتف</span>
              <input className={inputCls} dir="ltr" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06XXXXXXXX" /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">المدينة <span className="font-normal text-slate-400">(ثمن التوصيل أوتوماتيكي)</span></span>
              <CityCombo cities={data.cities} value={f.city} onChange={onCity} /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">العنوان</span>
              <input className={inputCls} value={f.address} onChange={(e) => set('address', e.target.value)} /></label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-extrabold text-brand-600">📦 المنتوج والثمن</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 block"><span className="mb-1 block text-xs font-bold text-slate-600">المنتوج *</span>
              <select className={inputCls} value={f.productId ?? ''} onChange={(e) => onProduct(e.target.value)}>
                <option value="">— اختر المنتوج —</option>
                {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">الكمية</span>
              <input type="number" min={1} className={inputCls} value={f.qty} onChange={(e) => set('qty', Number(e.target.value) || 1)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">الثمن (وحدة)</span>
              <input type="number" min={0} className={inputCls} value={f.price} onChange={(e) => set('price', Number(e.target.value) || 0)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">UPSEL</span>
              <input type="number" min={0} className={inputCls} value={f.upsell} onChange={(e) => set('upsell', Number(e.target.value) || 0)} /></label>
            <div className="col-span-2 flex items-end gap-3 sm:col-span-3">
              <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-200">
                <span className="font-bold text-slate-500">المجموع: </span>
                <span className="font-extrabold text-slate-800" dir="ltr">{money(f.price * f.qty)}</span>
                <span className="ms-3 font-bold text-slate-500">عمولة: </span>
                <span className="font-extrabold text-slate-800" dir="ltr">{f.commission} DH</span>
                <span className="ms-3 font-bold text-slate-500">توصيل: </span>
                <span className="font-extrabold text-slate-800" dir="ltr">{f.deliveryFee} DH</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-extrabold text-brand-600">🚚 الحالة والمتابعة</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">حالة التأكيد</span>
              <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">التوصيل</span>
              <select className={inputCls} value={f.delivery} onChange={(e) => setDelivery(e.target.value)}>
                <option value="">— لم تُشحن —</option>
                <option value="Expédier vers">Expédier vers</option>
                <option value="Livrée">Livrée</option>
                <option value="Retour">Retour</option>
                <option value="Out Of Stock">Out Of Stock</option>
              </select></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">التاريخ</span>
              <input type="date" className={inputCls} value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">المصدر</span>
              <select className={inputCls} value={f.source} onChange={(e) => set('source', e.target.value)}>
                <option value="">—</option>
                {data.settings.sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className="block col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">المسؤولة</span>
              {canPickAgent ? (
                <select className={inputCls} value={f.agent} onChange={(e) => set('agent', e.target.value)}>
                  <option value="">—</option>
                  {agents.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              ) : (
                <input className={inputCls} value={f.agent} disabled title="الطلبيات تُنسب لحسابك" />
              )}</label>
            <label className="block col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">ملاحظات</span>
              <input className={inputCls} value={f.note} onChange={(e) => set('note', e.target.value)} /></label>
          </div>
        </div>

        <div className="flex items-center justify-start gap-2 border-t border-slate-100 pt-4">
          <button className={btn.primary} onClick={save} disabled={busy}>
            <Icon name="check" className="h-4 w-4" />{busy ? 'جارٍ الحفظ…' : initial.id ? 'حفظ التعديلات' : 'إضافة الطلبية'}
          </button>
          <button className={btn.secondary} onClick={onClose} disabled={busy}>إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- الصفحة ---------- */
const PAGE_SIZE = 25;

export default function Orders() {
  const { user, isAdmin, refresh } = useApp();
  const data = useData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [delivery, setDelivery] = useState('');
  const [agent, setAgent] = useState('');
  const [product, setProduct] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Partial<Order> | null>(null);
  const [delTarget, setDelTarget] = useState<Order | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.orders.filter((o) => {
      if (needle && ![o.customerName, o.phone, o.city, o.productName, o.note].join(' ').toLowerCase().includes(needle)) return false;
      if (status && o.status !== status) return false;
      if (delivery && o.delivery !== delivery) return false;
      if (agent && o.agent !== agent) return false;
      if (product && o.productName !== product) return false;
      if (source && o.source !== source) return false;
      if (from && (o.date || '') < from) return false;
      if (to && (o.date || '') > to) return false;
      return true;
    });
  }, [data.orders, q, status, delivery, agent, product, source, from, to]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const visibleTotal = filtered.reduce((a, o) => a + (o.delivery === DELIVERED ? o.price * o.qty : 0), 0);

  useEffect(() => { setPage(1); }, [q, status, delivery, agent, product, source, from, to]);

  const exportCsv = () => {
    const rows = filtered.map((o) => ({
      id: o.id, date: o.date, name: o.customerName, phone: o.phone, city: o.city, address: o.address,
      product: o.productName, qty: o.qty, price: o.price, total: o.price * o.qty,
      commission: o.commission, deliveryFee: o.deliveryFee, upsell: o.upsell,
      agent: o.agent, source: o.source, status: o.status, delivery: o.delivery, note: o.note
    }));
    downloadFile(`paraveda-orders-${todayISO()}.csv`, toCSV(rows, [
      ['id', 'رقم'], ['date', 'التاريخ'], ['name', 'الزبون'], ['phone', 'الهاتف'], ['city', 'المدينة'],
      ['address', 'العنوان'], ['product', 'المنتوج'], ['qty', 'الكمية'], ['price', 'الثمن'], ['total', 'المجموع'],
      ['commission', 'العمولة'], ['deliveryFee', 'رسوم التوصيل'], ['upsell', 'UPSEL'],
      ['agent', 'المسؤولة'], ['source', 'المصدر'], ['status', 'الحالة'], ['delivery', 'التوصيل'], ['note', 'ملاحظات']
    ]), 'text/csv');
    toast(`تم تصدير ${rows.length} طلبية CSV`);
  };

  const del = async () => {
    if (!delTarget) return;
    setBusyDel(true);
    try {
      await api.deleteOrder(delTarget.id);
      toast('تم حذف الطلبية');
      setDelTarget(null);
      await refresh();
    } catch {
      toast('تعذّر الحذف', 'err');
    } finally {
      setBusyDel(false);
    }
  };

  const sel = 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 shadow-sm focus:border-brand-500 focus:outline-none';

  return (
    <div className="space-y-4">
      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
          <input className={`${inputCls} pl-9`} placeholder="بحث بالاسم، الهاتف، المدينة، المنتوج…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className={btn.primary} onClick={() => setModal({})}><Icon name="plus" className="h-4 w-4" />طلبية جديدة</button>
        <button className={btn.secondary} onClick={exportCsv}><Icon name="download" className="h-4 w-4" />تصدير CSV</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={sel} value={delivery} onChange={(e) => setDelivery(e.target.value)}>
          <option value="">كل حالات التوصيل</option>
          {['Expédier vers', 'Livrée', 'Retour', 'Out Of Stock'].map((s) => <option key={s} value={s}>{deliveryLabel[s]}</option>)}
        </select>
        {isAdmin && (
          <select className={sel} value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">كل المسؤولات</option>
            {data.users.filter((u) => u.role === 'agent').map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        )}
        <select className={sel} value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">كل المنتوجات</option>
          {[...new Set(data.orders.map((o) => o.productName).filter(Boolean))].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">كل المصادر</option>
          {data.settings.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className={sel} value={from} onChange={(e) => setFrom(e.target.value)} title="من تاريخ" />
        <input type="date" className={sel} value={to} onChange={(e) => setTo(e.target.value)} title="إلى تاريخ" />
        {(q || status || delivery || agent || product || source || from || to) && (
          <button className={btn.ghost} onClick={() => { setQ(''); setStatus(''); setDelivery(''); setAgent(''); setProduct(''); setSource(''); setFrom(''); setTo(''); }}>
            <Icon name="x" className="h-4 w-4" />مسح الفلاتر
          </button>
        )}
        <span className="ms-auto text-xs font-bold text-slate-400">
          {num(filtered.length)} طلبية — مسلّم: <span dir="ltr" className="text-emerald-600">{money(visibleTotal)}</span>
        </span>
      </div>

      {/* الجدول */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <Th>#</Th><Th>التاريخ</Th><Th>الزبون</Th><Th>الهاتف</Th><Th>المدينة</Th><Th>المنتوج</Th>
                <Th>الكمية</Th><Th>المجموع</Th><Th>المسؤولة</Th><Th>المصدر</Th><Th>الحالة</Th><Th>التوصيل</Th><Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((o) => {
                const cancelled = o.status === 'Annulée';
                return (
                  <tr key={o.id} className={`transition hover:bg-brand-50/40 ${cancelled ? 'bg-rose-50/30' : ''}`}>
                    <Td className="text-[11px] text-slate-400">{o.id}</Td>
                    <Td className="text-slate-400">{dmy(o.date)}</Td>
                    <Td className={`font-bold ${cancelled ? 'text-rose-500 line-through decoration-rose-400' : ''}`}>
                      {o.customerName}
                      {o.note && <Icon name="alert" className="ms-1 inline h-3.5 w-3.5 text-amber-500" />}
                    </Td>
                    <Td dir="ltr" className="text-left text-slate-500">{o.phone}</Td>
                    <Td>{o.city}</Td>
                    <Td className={`max-w-[200px] truncate ${cancelled ? 'text-rose-500 line-through decoration-rose-400' : ''}`} title={o.productName}>{o.productName}</Td>
                    <Td className="text-center">{o.qty}</Td>
                    <Td className="font-extrabold" dir="ltr">{money(o.price * o.qty)}</Td>
                    <Td>{o.agent || '—'}</Td>
                    <Td className="text-slate-400">{o.source || '—'}</Td>
                    <Td><Badge tone={statusTone[o.status] || 'slate'}>{o.status}</Badge></Td>
                    <Td><Badge tone={deliveryTone[o.delivery] || 'slate'}>{deliveryLabel[o.delivery] || '—'}</Badge></Td>
                    <Td>
                      <div className="flex items-center gap-0.5">
                        <button className={btn.icon} title="تعديل" onClick={() => setModal(o)}><Icon name="edit" className="h-4 w-4" /></button>
                        {isAdmin && (
                          <button className={`${btn.icon} hover:bg-rose-50 hover:text-rose-600`} title="حذف" onClick={() => setDelTarget(o)}>
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <EmptyState icon="cart" title="لا توجد طلبيات مطابقة" sub="جرّب تغيير الفلاتر أو أضف طلبية جديدة" />}
        {/* ترقيم الصفحات */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
            <p className="text-xs font-bold text-slate-400" dir="ltr">صفحة {safePage} / {pages}</p>
            <div className="flex items-center gap-1.5">
              <button className={btn.secondary} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>السابق</button>
              <button className={btn.secondary} disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>التالي</button>
            </div>
          </div>
        )}
      </div>

      {modal && <OrderModal initial={modal} onClose={() => setModal(null)} />}
      <ConfirmDialog
        open={!!delTarget}
        title="حذف الطلبية"
        message={`هل أنت متأكد من حذف طلبية "${delTarget?.customerName} — ${delTarget?.productName}"؟ لا يمكن الرجوع بعد الحذف (توجد نسخة احتياطية في السجل).`}
        confirmLabel="حذف نهائي"
        danger busy={busyDel}
        onConfirm={del}
        onCancel={() => setDelTarget(null)} />
    </div>
  );
}
