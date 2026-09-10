import React, { useMemo, useState } from 'react';
import { useApp, useData } from '../state/store';
import { Avatar, Badge, Card, EmptyState, Kpi, SectionCard, Td, Th, btn } from '../components/ui';
import PeriodFilter, { periodFromPreset, Preset, Period } from '../components/PeriodFilter';
import { computeSalaries } from '../lib/calc';
import { money, num, todayISO } from '../lib/format';

export default function Salaries() {
  const { user, isAdmin } = useApp();
  const data = useData();
  const [preset, setPreset] = useState<Preset>('month');
  const [period, setPeriod] = useState<Period>(periodFromPreset('month'));

  const scoped = useMemo(
    () => (isAdmin ? data.orders : data.orders.filter((o) => o.agent.toLowerCase() === user!.name.toLowerCase())),
    [data.orders, isAdmin, user]
  );
  const salaries = useMemo(
    () => computeSalaries(scoped, period.from, period.to, data.settings),
    [scoped, period, data.settings]
  );
  const s = data.settings;
  const grand = salaries.reduce((a, x) => a + x.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter preset={preset} onPreset={setPreset} period={period} onPeriod={setPeriod} />
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
          <Badge tone="emerald">تسليم × {s.perDelivered} DH</Badge>
          <Badge tone="violet">UPSEL × {s.perUpsell} DH</Badge>
          <Badge tone="amber">بونص {num(s.bonusAmount)} DH عند {num(s.bonusThreshold)} تسليم</Badge>
        </div>
      </div>

      {isAdmin && salaries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="إجمالي الأجور" value={money(grand)} icon="money" tone="brand" />
          <Kpi label="عدد المتسلمات" value={num(salaries.reduce((a, x) => a + x.delivered, 0))} icon="check" tone="emerald" />
          <Kpi label="عدد UPSEL" value={num(salaries.reduce((a, x) => a + x.upsells, 0))} icon="chart" tone="violet" />
          <Kpi label="البونصات" value={money(salaries.reduce((a, x) => a + x.bonus, 0))} icon="megaphone" tone="amber" />
        </div>
      )}

      <SectionCard title={isAdmin ? 'أجور الفريق' : `أجري — ${user?.name}`} subtitle="تُحسب أوتوماتيكياً من الطلبيات المسلّمة في الفترة المختارة">
        {salaries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <Th>المسؤولة</Th><Th>المسلّمة</Th><Th>UPSEL</Th><Th>أساسي ({s.perDelivered}×)</Th><Th>UPSEL ({s.perUpsell}×)</Th><Th>البونص</Th><Th>الإجمالي</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {salaries.map((r) => (
                  <tr key={r.agent} className="transition hover:bg-brand-50/40">
                    <Td>
                      <span className="flex items-center gap-2.5 font-bold">
                        <Avatar name={r.agent} className="h-8 w-8 text-xs" />
                        {r.agent}
                      </span>
                    </Td>
                    <Td className="text-center font-extrabold">{num(r.delivered)}</Td>
                    <Td className="text-center">{num(r.upsells)}</Td>
                    <Td dir="ltr">{money(r.base)}</Td>
                    <Td dir="ltr">{money(r.upsellPay)}</Td>
                    <Td>{r.bonus ? <Badge tone="amber">+ {num(r.bonus)} DH 🎉</Badge> : <span className="text-xs text-slate-300">—</span>}</Td>
                    <Td className="text-base font-extrabold text-brand-700" dir="ltr">{money(r.total)}</Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-extrabold">
                  <Td className="font-extrabold">المجموع</Td>
                  <Td className="text-center">{num(salaries.reduce((a, x) => a + x.delivered, 0))}</Td>
                  <Td className="text-center">{num(salaries.reduce((a, x) => a + x.upsells, 0))}</Td>
                  <Td dir="ltr">{money(salaries.reduce((a, x) => a + x.base, 0))}</Td>
                  <Td dir="ltr">{money(salaries.reduce((a, x) => a + x.upsellPay, 0))}</Td>
                  <Td dir="ltr">{money(salaries.reduce((a, x) => a + x.bonus, 0))}</Td>
                  <Td className="text-brand-700" dir="ltr">{money(grand)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="money" title="لا توجد تسليمات في هذه الفترة" sub="الأجور تُحسب من الطلبيات التي وصلتها حالة «Livrée»" />
        )}
      </SectionCard>

      {isAdmin && (
        <Card className="p-4">
          <p className="text-[11px] font-bold leading-5 text-slate-400">
            💡 تُحتسب الأجور من الطلبيات المسلّمة فقط (Livrée) — المرتجعات والملغاة لا تدخل في الحساب،
            وUPSEL يُحتسب فقط في الطلبيات المسلّمة. لتغيير المعدلات أو شروط البونص: الإعدادات ← أجور الفريق.
          </p>
        </Card>
      )}
    </div>
  );
}
