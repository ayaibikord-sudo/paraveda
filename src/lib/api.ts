/* عميل API — يكتشف تلقائياً خادم Node (/api) أو استضافة PHP (api.php) */

let BASE: string | null = null;
let MODE: 'node' | 'php' = 'node';
let token: string | null = localStorage.getItem('pv_token');

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('pv_token', t);
  else localStorage.removeItem('pv_token');
}
export function getToken() { return token; }

function url(path: string): string {
  if (!BASE) throw new Error('api-not-ready');
  return MODE === 'php' ? `${BASE}?api=${path}` : `${BASE}/${path}`;
}

async function discover(): Promise<void> {
  const env = (import.meta as any).env?.VITE_API_BASE;
  const candidates: Array<[string, 'node' | 'php']> = [];
  if (env) candidates.push([String(env), env.endsWith('api.php') ? 'php' : 'node']);
  candidates.push([`${location.origin}/api`, 'node']);
  candidates.push([`${location.origin}/api.php`, 'php']);
  for (const [base, mode] of candidates) {
    try {
      const u = mode === 'php' ? `${base}?api=ping` : `${base}/ping`;
      const r = await fetch(u, { headers: { 'Cache-Control': 'no-store' } });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok) { BASE = base; MODE = mode; return; }
      }
    } catch { /* التالي */ }
  }
  BASE = candidates[0][0];
  MODE = candidates[0][1];
}

async function ready(): Promise<string> {
  if (!BASE) await discover();
  return MODE;
}

async function request<T = any>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  await ready();
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (token) headers['X-Session-Token'] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(url(path), { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (retry) { BASE = null; return request(method, path, body, false); }
    throw e;
  }
  if (res.status === 401 && retry) {
    BASE = null; // ربما تغيّر الخادم — أعد المحاولة مرة
    return request(method, path, body, false);
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) {
    const err: any = new Error(j.err || `http-${res.status}`);
    err.status = res.status;
    err.code = j.err;
    throw err;
  }
  return j as T;
}

export const api = {
  ping: () => request('GET', 'ping'),
  login: (username: string, password: string) => request<{ token: string; user: any }>('POST', 'login', { username, password }),
  bootstrap: () => request<any>('GET', 'bootstrap'),
  createOrder: (o: any) => request('POST', 'orders', o),
  updateOrder: (id: number, o: any) => request('PUT', `orders/${id}`, o),
  deleteOrder: (id: number) => request('DELETE', `orders/${id}`),
  createProduct: (p: any) => request('POST', 'products', p),
  updateProduct: (id: number, p: any) => request('PUT', `products/${id}`, p),
  deleteProduct: (id: number) => request('DELETE', `products/${id}`),
  updateCities: (updates: Array<{ id: number; price: number }>) => request('PUT', 'cities', { updates }),
  createAd: (a: any) => request('POST', 'adspend', a),
  updateAd: (id: number, a: any) => request('PUT', `adspend/${id}`, a),
  deleteAd: (id: number) => request('DELETE', `adspend/${id}`),
  createUser: (u: any) => request('POST', 'users', u),
  updateUser: (id: number, u: any) => request('PUT', `users/${id}`, u),
  deleteUser: (id: number) => request('DELETE', `users/${id}`),
  updateSettings: (s: any) => request('PUT', 'settings', s),
  importLegacy: (data: any) => request<{ report: any }>('POST', 'import', data),
  restore: (data: any) => request('POST', 'restore', data),
  exportUrl: () => (MODE === 'php' ? `${BASE}?api=export&token=${token}` : `${BASE}/export?token=${token}`)
};
