import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { Icon, Logo } from './icons';
import { inputCls } from './ui';

export default function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      nav('/', { replace: true });
    } catch {
      setErr('اسم المستخدم أو كلمة السر غير صحيحة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* لوحة الهوية */}
      <div className="relative hidden flex-1 overflow-hidden bg-slate-900 lg:block">
        <div className="absolute inset-0 bg-gradient-to-bl from-brand-600/90 via-brand-800/60 to-slate-900" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '26px 26px' }} />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <div>
              <p className="text-xl font-extrabold tracking-tight">Paraveda</p>
              <p className="text-xs font-bold text-white/60">نظام إدارة الطلبيات — COD CRM</p>
            </div>
          </div>
          <div className="max-w-lg">
            <h2 className="text-3xl font-extrabold leading-snug">منصّة احترافية لإدارة طلبات الدفع عند الاستلام، من التأكيد حتى التوصيل.</h2>
            <ul className="mt-8 space-y-3.5 text-sm font-semibold text-white/85">
              {[
                'تتبّع كامل للطلبيات: تأكيد، شحن، تسليم، مرتجعات',
                'حساب أوتوماتيكي لأجور الفريق وأرباح المنتوجات',
                'تحليل المدن ومصاريف التوصيل ومصاريف الإعلانات',
                'سجل كامل لكل العمليات + نسخ احتياطية'
              ].map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs font-semibold text-white/50">© {new Date().getFullYear()} Paraveda — جميع الحقوق محفوظة</p>
        </div>
      </div>

      {/* الفورم */}
      <div className="flex flex-1 items-center justify-center bg-slate-100 p-6">
        <div className={`w-full max-w-sm ${err ? 'pv-shake' : ''}`}>
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <Logo className="h-14 w-14" />
            <h1 className="text-xl font-extrabold text-slate-800">Paraveda CRM</h1>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-800">تسجيل الدخول</h2>
            <p className="mt-1 text-xs text-slate-400">أدخل بيانات حسابك للمتابعة</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">اسم المستخدم</span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="user" className="h-5 w-5" /></span>
                  <input dir="ltr" className={`${inputCls} pl-10 text-left`} value={username}
                    onChange={(e) => setUsername(e.target.value)} placeholder="admin@paraveda.ma" autoFocus autoComplete="username" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">كلمة السر</span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="lock" className="h-5 w-5" /></span>
                  <input dir="ltr" type={show ? 'text' : 'password'} className={`${inputCls} pl-10 text-left`} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" onClick={() => setShow((s) => !s)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600">
                    <Icon name="eye" className="h-5 w-5" />
                  </button>
                </div>
              </label>
              {err && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                  <Icon name="alert" className="h-4 w-4 shrink-0" />{err}
                </div>
              )}
              <button type="submit" disabled={busy || !username || !password}
                className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50">
                {busy ? 'جارٍ الدخول…' : 'دخول'}
              </button>
            </form>
          </div>
          <p className="mt-6 text-center text-[11px] text-slate-400">Paraveda CRM v2.0 — نسخة احترافية</p>
        </div>
      </div>
    </div>
  );
}
