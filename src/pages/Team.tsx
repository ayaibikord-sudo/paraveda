import React, { useMemo, useState } from 'react';
import { useApp, useData } from '../state/store';
import { api } from '../lib/api';
import { Avatar, Badge, Card, ConfirmDialog, Kpi, Modal, Td, Th, btn, inputCls, statusTone, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { DELIVERED, ORDER_STATUSES } from '../lib/types';
import type { User } from '../lib/types';
import { dmyhm, money, num, pct } from '../lib/format';

function UserModal({ initial, onClose }: { initial: Partial<User> & { password?: string }; onClose: () => void }) {
  const { refresh } = useApp();
  const toast = useToast();
  const [f, setF] = useState({
    name: initial.name || '',
    username: initial.username || '',
    password: '',
    role: initial.role || 'agent'
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.username.trim() || (!initial.id && !f.password)) {
      return toast('اسم المستخدم وكلمة السر مطلوبان', 'err');
    }
    setBusy(true);
    try {
      if (initial.id) {
        const body: any = { name: f.name, role: f.role };
        if (f.password) body.password = f.password;
        await api.updateUser(initial.id, body);
        toast('تم تحديث الحساب');
      } else {
        await api.createUser({ ...f, name: f.name || f.username.split('@')[0] });
        toast('تم إنشاء الحساب');
      }
      await refresh();
      onClose();
    } catch (e: any) {
      toast(e.code === 'duplicate' ? 'اسم المستخدم موجود من قبل' : 'تعذّر الحفظ', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial.id ? `تعديل حساب: ${initial.name}` : 'حساب جديد'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">الاسم الظاهر</span>
            <input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">اسم المستخدم (للدخول) *</span>
            <input dir="ltr" className={`${inputCls} text-left`} value={f.username} onChange={(e) => set('username', e.target.value)} disabled={!!initial.id} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">{initial.id ? 'كلمة سر جديدة (اختياري)' : 'كلمة السر *'}</span>
            <input dir="ltr" type="password" className={`${inputCls} text-left`} value={f.password} onChange={(e) => set('password', e.target.value)} placeholder={initial.id ? 'اتركها فارغة للإبقاء' : ''} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">الصلاحية</span>
            <select className={inputCls} value={f.role} onChange={(e) => set('role', e.target.value)} disabled={initial.id === undefined && false}>
              <option value="agent">مسؤولة تأكيد</option>
              <option value="admin">مدير(ة)</option>
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

export default function Team() {
  const { user: me, refresh } = useApp();
  const data = useData();
  const toast = useToast();
  const [modal, setModal] = useState<(Partial<User> & { password?: string }) | null>(null);
  const [delTarget, setDelTarget] = useState<User | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { orders: number; delivered: number; confirmed: number; revenue: number }>();
    for (const o of data.orders) {
      const a = o.agent || '—';
      let r = m.get(a);
      if (!r) { r = { orders: 0, delivered: 0, confirmed: 0, revenue: 0 }; m.set(a, r); }
      r.orders++;
      if (o.delivery === DELIVERED) { r.delivered++; r.revenue += o.price * o.qty; }
      if (o.status === 'Confirmée' || o.confirmedAt) r.confirmed++;
    }
    return m;
  }, [data.orders]);

  const lastSeen = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of data.history) {
      if (!m.has(h.user)) m.set(h.user, h.at);
    }
    return m;
  }, [data.history]);

  const del = async () => {
    if (!delTarget) return;
    setBusyDel(true);
    try {
      await api.deleteUser(delTarget.id);
      toast('تم حذف الحساب');
      setDelTarget(null);
      await refresh();
    } catch (e: any) {
      toast(e.code === 'self' ? 'لا يمكنك حذف حسابك الحالي' : 'تعذّر الحذف', 'err');
    } finally {
      setBusyDel(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="الحسابات" value={num(data.users.length)} icon="users" tone="brand" />
        <Kpi label="المسؤولات النشيطة" value={num(data.users.filter((u) => u.active && u.role === 'agent').length)} icon="user" tone="emerald" />
        <Kpi label="المديرون" value={num(data.users.filter((u) => u.role === 'admin').length)} icon="lock" tone="violet" />
        <Kpi label="مجموع الطلبيات" value={num(data.orders.length)} icon="cart" tone="sky" />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-extrabold text-slate-800">حسابات الفريق</h3>
          <button className={btn.primary} onClick={() => setModal({})}><Icon name="plus" className="h-4 w-4" />حساب جديد</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr><Th>الحساب</Th><Th>اسم المستخدم</Th><Th>الصلاحية</Th><Th>الحالة</Th><Th>طلبيات</Th><Th>مؤكدة</Th><Th>مسلّمة</Th><Th>نسبة التوصيل</Th><Th>مبيعات المسلّم</Th><Th>آخر نشاط</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.users.map((u) => {
                const s = stats.get(u.name);
                return (
                  <tr key={u.id} className="transition hover:bg-brand-50/40">
                    <Td>
                      <span className="flex items-center gap-2.5 font-bold">
                        <Avatar name={u.name} className="h-8 w-8 text-xs" />
                        {u.name}
                        {u.id === me?.id && <Badge tone="brand">أنت</Badge>}
                      </span>
                    </Td>
                    <Td dir="ltr" className="text-left text-slate-500">{u.username}</Td>
                    <Td><Badge tone={u.role === 'admin' ? 'violet' : 'sky'}>{u.role === 'admin' ? 'مدير(ة)' : 'مسؤولة تأكيد'}</Badge></Td>
                    <Td><Badge tone={u.active ? 'emerald' : 'rose'}>{u.active ? 'نشط' : 'موقوف'}</Badge></Td>
                    <Td className="text-center font-bold">{s ? num(s.orders) : '—'}</Td>
                    <Td className="text-center">{s ? num(s.confirmed) : '—'}</Td>
                    <Td className="text-center font-bold text-emerald-700">{s ? num(s.delivered) : '—'}</Td>
                    <Td>{s && s.orders ? pct(s.delivered, s.orders) : '—'}</Td>
                    <Td className="font-bold" dir="ltr">{s ? money(s.revenue) : '—'}</Td>
                    <Td className="text-slate-400 text-xs">{lastSeen.get(u.username) ? dmyhm(lastSeen.get(u.username)) : '—'}</Td>
                    <Td>
                      <div className="flex gap-0.5">
                        <button className={btn.icon} title="تعديل" onClick={() => setModal(u)}><Icon name="edit" className="h-4 w-4" /></button>
                        {u.id !== me?.id && (
                          <button className={`${btn.icon} hover:bg-rose-50 hover:text-rose-600`} title="حذف" onClick={() => setDelTarget(u)}><Icon name="trash" className="h-4 w-4" /></button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-[11px] font-bold leading-5 text-slate-400">
          💡 كل مسؤولة تشوف غير الطلبيات ديالها فصفحة الطلبيات، وكشف الأجور ديالها. المديرون يشوفو كلشي.
        </p>
      </Card>

      {modal && <UserModal initial={modal} onClose={() => setModal(null)} />}
      <ConfirmDialog open={!!delTarget} title="حذف الحساب" danger busy={busyDel}
        message={`حذف حساب "${delTarget?.name}"؟ طلبياته ستبقى محفوظة باسمه.`}
        confirmLabel="حذف" onConfirm={del} onCancel={() => setDelTarget(null)} />
    </div>
  );
}
