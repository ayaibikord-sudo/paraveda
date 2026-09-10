import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../state/store';
import { Badge, Card, EmptyState, Td, Th, actionLabel, btn, inputCls } from '../components/ui';
import { Icon } from '../components/icons';
import { dmyhm, num } from '../lib/format';

const PAGE_SIZE = 50;
const actionTone: Record<string, any> = { create: 'emerald', update: 'sky', delete: 'rose', import: 'violet', restore: 'amber' };

export default function History() {
  const data = useData();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.history.filter((h) => {
      if (action && h.action !== action) return false;
      if (needle && ![h.user, h.summary, String(h.entityId), h.entity].join(' ').toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data.history, q, action]);

  useEffect(() => { setPage(1); }, [q, action]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const entityLabel: Record<string, string> = { order: 'طلبية', product: 'منتوج', user: 'حساب', cities: 'المدن', settings: 'الإعدادات', db: 'قاعدة البيانات', adspend: 'إعلان' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
          <input className={`${inputCls} pl-9`} placeholder="بحث في السجل…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {['create', 'update', 'delete', 'import'].map((a) => (
          <button key={a} onClick={() => setAction(action === a ? '' : a)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${action === a ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {actionLabel[a]}
          </button>
        ))}
        <span className="ms-auto text-xs font-bold text-slate-400">{num(filtered.length)} عملية</span>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr><Th>التاريخ والوقت</Th><Th>المستخدم</Th><Th>العملية</Th><Th>الكيان</Th><Th>التفاصيل</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((h) => (
                <tr key={h.id} className="transition hover:bg-brand-50/40">
                  <Td className="text-slate-400 text-xs">{dmyhm(h.at)}</Td>
                  <Td className="font-bold">{h.user}</Td>
                  <Td><Badge tone={actionTone[h.action] || 'slate'}>{actionLabel[h.action] || h.action}</Badge></Td>
                  <Td className="text-slate-500">
                    {entityLabel[h.entity] || h.entity}
                    {h.entityId !== '' && <span className="ms-1 text-[11px]" dir="ltr">#{h.entityId}</span>}
                  </Td>
                  <Td className="max-w-[360px] truncate text-slate-600" title={h.summary}>{h.summary || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <EmptyState icon="clock" title="السجل فارغ" sub="كل العمليات (إضافة، تعديل، حذف، استيراد) تُسجل هنا تلقائياً" />}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
            <p className="text-xs font-bold text-slate-400" dir="ltr">صفحة {safePage} / {pages}</p>
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
