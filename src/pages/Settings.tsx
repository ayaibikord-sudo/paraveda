import React, { useRef, useState } from 'react';
import { useApp, useData } from '../state/store';
import { api } from '../lib/api';
import { Card, ConfirmDialog, SectionCard, btn, inputCls, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { downloadFile } from '../lib/format';

export default function Settings() {
  const { refresh } = useApp();
  const data = useData();
  const toast = useToast();
  const [storeName, setStoreName] = useState(data.settings.storeName);
  const [rates, setRates] = useState({
    perDelivered: data.settings.perDelivered,
    perUpsell: data.settings.perUpsell,
    bonusThreshold: data.settings.bonusThreshold,
    bonusAmount: data.settings.bonusAmount
  });
  const [sourcesText, setSourcesText] = useState(data.settings.sources.join(', '));
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const saveGeneral = async () => {
    setBusy(true);
    try {
      await api.updateSettings({ storeName, sources: sourcesText.split(',').map((s) => s.trim()).filter(Boolean) });
      toast('تم حفظ الإعدادات');
      await refresh();
    } catch { toast('تعذّر الحفظ', 'err'); } finally { setBusy(false); }
  };

  const saveRates = async () => {
    setBusy(true);
    try {
      await api.updateSettings(rates);
      toast('تم تحديث معدلات الأجور');
      await refresh();
    } catch { toast('تعذّر الحفظ', 'err'); } finally { setBusy(false); }
  };

  const onImportFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setConfirmImport(String(reader.result || ''));
    reader.readAsText(file);
  };

  const doImport = async () => {
    if (!confirmImport) return;
    setBusy(true);
    try {
      const legacy = JSON.parse(confirmImport);
      const r = await api.importLegacy(legacy);
      toast(`تم الاستيراد: ${r.report.orders} طلبية، ${r.report.products} منتوج، ${r.report.cities} مدينة`);
      setConfirmImport(null);
      await refresh();
    } catch (e: any) {
      toast(e.code === 'no-legacy-data' ? 'الملف لا يحتوي بيانات النسخة القديمة' : 'تعذّر الاستيراد — تحقق من الملف', 'err');
    } finally {
      setBusy(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const onRestoreFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setConfirmRestore(String(reader.result || ''));
    reader.readAsText(file);
  };

  const doRestore = async () => {
    if (!confirmRestore) return;
    setBusy(true);
    try {
      await api.restore(JSON.parse(confirmRestore));
      toast('تمت استعادة النسخة الاحتياطية');
      setConfirmRestore(null);
      await refresh();
    } catch { toast('تعذّرت الاستعادة — الملف غير صالح', 'err'); } finally {
      setBusy(false);
      if (restoreRef.current) restoreRef.current.value = '';
    }
  };

  const exportBackup = async () => {
    try {
      const res = await fetch(api.exportUrl());
      const text = await res.text();
      downloadFile(`paraveda-backup-${new Date().toISOString().slice(0, 10)}.json`, text);
      toast('تم تنزيل النسخة الاحتياطية');
    } catch { toast('تعذّر التنزيل', 'err'); }
  };

  const numInput = (label: string, k: keyof typeof rates, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <input type="number" min={0} className={inputCls} value={(rates as any)[k]}
        onChange={(e) => setRates((s) => ({ ...s, [k]: Number(e.target.value) || 0 }))} />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* عام */}
      <SectionCard title="معلومات المتجر" subtitle="تظهر في النظام والتقارير">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">اسم المتجر</span>
            <input className={inputCls} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">مصادر الطلبيات <span className="font-normal text-slate-400">(مفصولة بفاصلة)</span></span>
            <input className={inputCls} value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} />
          </label>
          <div className="pt-1"><button className={btn.primary} onClick={saveGeneral} disabled={busy}><Icon name="check" className="h-4 w-4" />حفظ</button></div>
        </div>
      </SectionCard>

      {/* الأجور */}
      <SectionCard title="أجور الفريق" subtitle="تُطبق أوتوماتيكياً في صفحة الأجور">
        <div className="grid grid-cols-2 gap-3">
          {numInput('مقابل كل تسليم (DH)', 'perDelivered')}
          {numInput('مقابل كل UPSEL (DH)', 'perUpsell')}
          {numInput('عتبة البونص (عدد التسليمات)', 'bonusThreshold', 'اتركها 0 لتعطيل البونص')}
          {numInput('مبلغ البونص (DH)', 'bonusAmount')}
        </div>
        <div className="mt-3"><button className={btn.primary} onClick={saveRates} disabled={busy}><Icon name="check" className="h-4 w-4" />حفظ المعدلات</button></div>
      </SectionCard>

      {/* النسخ والاستيراد */}
      <SectionCard title="النسخ الاحتياطية" subtitle="حماية بياناتك — صدّر نسخة كاملة أو استعد نسخة سابقة" className="xl:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <button className={btn.secondary} onClick={exportBackup}><Icon name="download" className="h-4 w-4" />تصدير نسخة احتياطية (JSON)</button>
          <button className={btn.secondary} onClick={() => restoreRef.current?.click()}>
            <Icon name="upload" className="h-4 w-4" />استعادة نسخة احتياطية
          </button>
          <input ref={restoreRef} type="file" accept=".json" className="hidden" onChange={(e) => onRestoreFile(e.target.files?.[0])} />
          <span className="h-6 w-px bg-slate-200" />
          <button className={btn.primary} onClick={() => importRef.current?.click()}>
            <Icon name="upload" className="h-4 w-4" />استيراد بيانات النسخة القديمة (crm_data.json)
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0])} />
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="text-[11px] font-bold leading-5 text-slate-500">
            📥 استيراد النسخة القديمة: يقبل ملف <code dir="ltr">crm_data.json</code> من النسخة السابقة ويحوّل تلقائياً:
            الطلبيات (afrizon_orders_v5)، الكتالوج (afrizon_catalog_v1)، المدن وأثمنة التوصيل (afrizon_villes_v2)،
            الحسابات (afrizon_users_v1 — كلمات السر تبقى كما هي)، مصاريف الإعلان (afrizon_adspend_v1) والسجل.
            <br />⚠️ الاستيراد يستبدل البيانات الحالية بالكاملة — صدّر نسخة احتياطية أولاً.
          </p>
        </div>
      </SectionCard>

      <ConfirmDialog open={!!confirmImport} title="تأكيد الاستيراد" busy={busy} danger confirmLabel="استيراد واستبدال"
        message="سيتم استبدال كل البيانات الحالية ببيانات الملف المستورد. هل أنت متأكد؟"
        onConfirm={doImport} onCancel={() => setConfirmImport(null)} />
      <ConfirmDialog open={!!confirmRestore} title="تأكيد الاستعادة" busy={busy} danger confirmLabel="استعادة"
        message="سيتم استبدال البيانات الحالية بالنسخة الاحتياطية. هل أنت متأكد؟"
        onConfirm={doRestore} onCancel={() => setConfirmRestore(null)} />
    </div>
  );
}
