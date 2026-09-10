import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './state/store';
import { ToastProvider, Spinner } from './components/ui';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Delivery from './pages/Delivery';
import Products from './pages/Products';
import Cities from './pages/Cities';
import Ads from './pages/Ads';
import Salaries from './pages/Salaries';
import Team from './pages/Team';
import History from './pages/History';
import Settings from './pages/Settings';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading, error, refresh } = useApp();
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Spinner className="h-9 w-9" />
        <p className="text-sm font-bold text-slate-400">جارٍ تحميل البيانات…</p>
      </div>
    );
  }
  if (!user) return <Login />;
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-bold text-slate-600">{error}</p>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white" onClick={() => refresh()}>
          إعادة المحاولة
        </button>
      </div>
    );
  }
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { isAdmin } = useApp();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/products" element={<Products />} />
              <Route path="/salaries" element={<Salaries />} />
              <Route path="/delivery" element={<RequireAdmin><Delivery /></RequireAdmin>} />
              <Route path="/cities" element={<RequireAdmin><Cities /></RequireAdmin>} />
              <Route path="/ads" element={<RequireAdmin><Ads /></RequireAdmin>} />
              <Route path="/team" element={<RequireAdmin><Team /></RequireAdmin>} />
              <Route path="/history" element={<RequireAdmin><History /></RequireAdmin>} />
              <Route path="/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AppProvider>
  );
}
