import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, getToken } from '../lib/api';
import type { BootstrapData, User } from '../lib/types';

interface AppState {
  user: User | null;
  data: BootstrapData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const Ctx = createContext<AppState>(null as any);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await api.bootstrap();
      setUser(d.user);
      setData(d);
      setError(null);
    } catch (e: any) {
      if (e.code === 'unauthorized' || e.status === 401) {
        setToken(null);
        setUser(null);
        setData(null);
      } else {
        setError('تعذّر الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.login(username, password);
    setToken(r.token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setData(null);
    setLoading(false);
  }, []);

  const value = useMemo<AppState>(() => ({
    user, data, loading, error, refresh, login, logout,
    isAdmin: user?.role === 'admin'
  }), [user, data, loading, error, refresh, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  return useContext(Ctx);
}

/** helper: الوصول للبيانات مع حماية من null */
export function useData(): BootstrapData {
  const { data } = useApp();
  return data as BootstrapData;
}
