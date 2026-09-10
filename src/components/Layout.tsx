import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { Avatar, Badge, Spinner, btn } from './ui';
import { Icon, Logo } from './icons';
import { dmy, todayISO } from '../lib/format';

interface NavItem { to: string; label: string; icon: string; adminOnly?: boolean }
const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'نظرة عامة',
    items: [
      { to: '/', label: 'لوحة القيادة', icon: 'dashboard' },
      { to: '/orders', label: 'الطلبيات', icon: 'cart' },
      { to: '/delivery', label: 'التوصيل', icon: 'truck', adminOnly: true }
    ]
  },
  {
    group: 'الكتالوج',
    items: [
      { to: '/products', label: 'المنتوجات', icon: 'box' },
      { to: '/cities', label: 'المدن', icon: 'building', adminOnly: true }
    ]
  },
  {
    group: 'التسويق والأداء',
    items: [
      { to: '/ads', label: 'الإعلانات', icon: 'megaphone', adminOnly: true },
      { to: '/salaries', label: 'الأجور', icon: 'money' }
    ]
  },
  {
    group: 'النظام',
    items: [
      { to: '/team', label: 'الفريق', icon: 'users', adminOnly: true },
      { to: '/history', label: 'السجل', icon: 'clock', adminOnly: true },
      { to: '/settings', label: 'الإعدادات', icon: 'gear', adminOnly: true }
    ]
  }
];

const TITLES: Record<string, { t: string; s: string }> = {
  '/': { t: 'لوحة القيادة', s: 'نظرة شاملة على أداء المتجر' },
  '/orders': { t: 'الطلبيات', s: 'إدارة و متابعة كل الطلبيات' },
  '/delivery': { t: 'التوصيل', s: 'متابعة الشحن والمرتجعات حسب المدينة' },
  '/products': { t: 'المنتوجات', s: 'الكتالوج والأداء لكل منتوج' },
  '/cities': { t: 'المدن', s: 'المدن وأثمنة التوصيل' },
  '/ads': { t: 'الإعلانات', s: 'مصاريف الإعلان والعائد' },
  '/salaries': { t: 'الأجور', s: 'حساب أجور الفريق أوتوماتيكياً' },
  '/team': { t: 'الفريق', s: 'إدارة الحسابات والصلاحيات' },
  '/history': { t: 'السجل', s: 'كل العمليات في الملف' },
  '/settings': { t: 'الإعدادات', s: 'الضبط، النسخ الاحتياطية والاستيراد' }
};

export default function Layout() {
  const { user, isAdmin, logout } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const meta = useMemo(() => {
    for (const k of Object.keys(TITLES)) if (loc.pathname === k) return TITLES[k];
    return { t: '', s: '' };
  }, [loc.pathname]);

  const groups = NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) }))
    .filter((g) => g.items.length > 0);

  const sidebar = (
    <div className="flex h-full w-64 flex-col bg-slate-900">
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo className="h-9 w-9" />
        <div>
          <p className="text-base font-extrabold tracking-tight text-white">Paraveda</p>
          <p className="text-[10px] font-bold text-slate-400">نظام إدارة الطلبيات</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{g.group}</p>
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}>
                  <Icon name={i.icon} className="h-5 w-5 opacity-90" />
                  {i.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name || '?'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{user?.name}</p>
            <p className="truncate text-[11px] text-slate-400">{user?.role === 'admin' ? 'مدير النظام' : 'مسؤولة تأكيد'}</p>
          </div>
          <button
            onClick={() => { logout(); nav('/login'); }}
            title="تسجيل الخروج"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400">
            <Icon name="logout" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* الشريط الجانبي — على اليمين (RTL) */}
      <aside className="hidden md:block shrink-0">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <button className={`${btn.icon} md:hidden`} onClick={() => setOpen(true)} aria-label="القائمة">
            <Icon name="menu" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold text-slate-800 md:text-lg">{meta.t}</h1>
            <p className="hidden truncate text-xs text-slate-400 sm:block">{meta.s}</p>
          </div>
          <Badge tone="slate" className="hidden sm:inline-flex"><Icon name="calendar" className="h-3.5 w-3.5" />{dmy(todayISO())}</Badge>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 md:p-6">
            <React.Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
              <Outlet />
            </React.Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
