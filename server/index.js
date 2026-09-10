// Paraveda CRM — خادم API (Node/Express)
// نفس الواجهة مطبّقة في api.php — يمكن النشر على أي استضافة
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyDb, readDb, writeDb, nextId, DATA_DIR } from './db.js';
import { signToken, verifyToken, verifyPassword, hashPassword } from './auth.js';
import { importLegacy } from './import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_html');
const LEGACY_SEED = path.join(DATA_DIR, 'legacy-crm_data.json');
const PORT = Number(process.env.PORT) || 8787;

/* ---------- تهيئة قاعدة البيانات ---------- */
let db = readDb();
if (!db) {
  db = emptyDb();
  if (fs.existsSync(LEGACY_SEED)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_SEED, 'utf8'));
      const report = importLegacy(legacy, db);
      console.log('[seed] تم استيراد بيانات النسخة القديمة:', JSON.stringify(report));
    } catch (e) {
      console.error('[seed] فشل الاستيراد:', e.message);
    }
  } else {
    db.users.push({
      id: 1, username: 'admin@paraveda.ma', password: hashPassword('paraveda2026'),
      name: 'Admin', role: 'admin', active: true, createdAt: new Date().toISOString()
    });
    console.log('[seed] قاعدة بيانات جديدة — admin@paraveda.ma / paraveda2026');
  }
  // رمز التوفيق بين النسختين (php/node)
  if (fs.existsSync(path.join(DATA_DIR, 'db.json'))) {
    try { const old = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8')); if (old?.meta?.secret) db.meta.secret = old.meta.secret; } catch {}
  }
  writeDb(db);
}
const save = () => writeDb(db);
const secret = () => db.meta.secret;

function logHistory(user, action, entity, entityId, summary) {
  db.history.unshift({
    id: nextId(db, 'history'), at: new Date().toISOString(),
    user: user ? user.username : 'system', action, entity,
    entityId: entityId ?? '', summary: summary || ''
  });
  if (db.history.length > 5000) db.history.length = 5000;
}

/* ---------- التطبيق ---------- */
const app = express();
app.use(express.json({ limit: '30mb' }));
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

function currentUser(req) {
  const token = req.headers['x-session-token'] || req.query.token || '';
  const payload = verifyToken(secret(), String(token));
  if (!payload) return null;
  return db.users.find((u) => u.id === payload.uid && u.active !== false) || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, err: 'unauthorized' });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, err: 'forbidden' });
  next();
}

const publicUser = (u) => u && ({ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active !== false });

/* ---------- عام ---------- */
app.get('/api/ping', (_req, res) => res.json({ ok: true, name: 'paraveda-api', version: 2 }));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find((u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user || user.active === false || !verifyPassword(password, user.password)) {
    return res.status(401).json({ ok: false, err: 'bad-credentials' });
  }
  const token = signToken(secret(), { uid: user.id, role: user.role });
  res.json({ ok: true, token, user: publicUser(user) });
});

app.get('/api/bootstrap', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  res.json({
    ok: true,
    user: publicUser(req.user),
    settings: db.settings,
    orders: isAdmin ? db.orders : db.orders.filter((o) => (o.agent || '').toLowerCase() === req.user.name.toLowerCase()),
    products: db.products,
    cities: db.cities,
    users: isAdmin ? db.users.map(publicUser) : db.users.filter((u) => u.active !== false).map(publicUser),
    adspend: isAdmin ? db.adspend : [],
    history: isAdmin ? db.history.slice(0, 2000) : []
  });
});

/* ---------- الطلبيات ---------- */
function cleanOrder(body) {
  const o = {};
  const strs = ['date', 'confirmedAt', 'customerName', 'phone', 'city', 'address', 'productName', 'agent', 'source', 'status', 'delivery', 'note'];
  for (const k of strs) if (k in body) o[k] = String(body[k] ?? '').trim();
  const nums = ['qty', 'price', 'commission', 'deliveryFee', 'upsell'];
  for (const k of nums) if (k in body) o[k] = Number(body[k]) || 0;
  if ('productId' in body) o.productId = body.productId ? Number(body.productId) : null;
  return o;
}

app.post('/api/orders', requireAuth, (req, res) => {
  const order = cleanOrder(req.body || {});
  if (req.user.role !== 'admin') order.agent = req.user.name; // غير المدير: الطلبية تُنسب له
  order.id = nextId(db, 'orders');
  order.createdAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  db.orders.unshift(order);
  logHistory(req.user, 'create', 'order', order.id, `${order.customerName} — ${order.productName}`);
  save();
  res.json({ ok: true, order });
});

app.put('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ ok: false, err: 'not-found' });
  if (req.user.role !== 'admin' && order.agent.toLowerCase() !== req.user.name.toLowerCase()) {
    return res.status(403).json({ ok: false, err: 'forbidden' });
  }
  Object.assign(order, cleanOrder(req.body || {}), { id: order.id, updatedAt: new Date().toISOString() });
  if (req.user.role !== 'admin') order.agent = req.user.name;
  logHistory(req.user, 'update', 'order', order.id, `${order.customerName} — ${order.status}${order.delivery ? ' / ' + order.delivery : ''}`);
  save();
  res.json({ ok: true, order });
});

app.delete('/api/orders/:id', requireAuth, requireAdmin, (req, res) => {
  const i = db.orders.findIndex((o) => o.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ ok: false, err: 'not-found' });
  const [removed] = db.orders.splice(i, 1);
  logHistory(req.user, 'delete', 'order', removed.id, `${removed.customerName} — ${removed.productName}`);
  save();
  res.json({ ok: true });
});

/* ---------- المنتوجات ---------- */
function cleanProduct(b) {
  const p = {};
  for (const k of ['name', 'link']) if (k in b) p[k] = String(b[k] ?? '').trim();
  for (const k of ['price', 'commission', 'cost', 'stock']) if (k in b) p[k] = b[k] === '' || b[k] == null ? (k === 'stock' ? null : 0) : Number(b[k]) || 0;
  if ('active' in b) p.active = !!b.active;
  return p;
}
app.post('/api/products', requireAuth, requireAdmin, (req, res) => {
  const p = cleanProduct(req.body || {});
  p.id = nextId(db, 'products');
  if (!p.name) return res.status(400).json({ ok: false, err: 'bad-body' });
  db.products.push(p); logHistory(req.user, 'create', 'product', p.id, p.name); save();
  res.json({ ok: true, product: p });
});
app.put('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ ok: false, err: 'not-found' });
  Object.assign(p, cleanProduct(req.body || {}), { id: p.id });
  logHistory(req.user, 'update', 'product', p.id, p.name); save();
  res.json({ ok: true, product: p });
});
app.delete('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
  const i = db.products.findIndex((x) => x.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ ok: false, err: 'not-found' });
  const [p] = db.products.splice(i, 1);
  logHistory(req.user, 'delete', 'product', p.id, p.name); save();
  res.json({ ok: true });
});

/* ---------- المدن ---------- */
app.put('/api/cities', requireAuth, requireAdmin, (req, res) => {
  const { updates } = req.body || {};
  if (!Array.isArray(updates)) return res.status(400).json({ ok: false, err: 'bad-body' });
  let n = 0;
  for (const u of updates) {
    const c = db.cities.find((x) => x.id === Number(u.id));
    if (c && u.price != null) { c.price = Number(u.price) || 0; n++; }
  }
  logHistory(req.user, 'update', 'cities', '', `${n} مدينة`);
  save();
  res.json({ ok: true, updated: n });
});

/* ---------- الإعلانات ---------- */
function cleanAd(b) {
  const a = {};
  for (const k of ['date', 'productName', 'source', 'agent', 'note']) if (k in b) a[k] = String(b[k] ?? '').trim();
  if ('amount' in b) a.amount = Number(b.amount) || 0;
  return a;
}
app.post('/api/adspend', requireAuth, requireAdmin, (req, res) => {
  const a = cleanAd(req.body || {});
  a.id = nextId(db, 'adspend');
  db.adspend.push(a); logHistory(req.user, 'create', 'adspend', a.id, `${a.productName} — ${a.amount} DH`); save();
  res.json({ ok: true, entry: a });
});
app.put('/api/adspend/:id', requireAuth, requireAdmin, (req, res) => {
  const a = db.adspend.find((x) => x.id === Number(req.params.id));
  if (!a) return res.status(404).json({ ok: false, err: 'not-found' });
  Object.assign(a, cleanAd(req.body || {}), { id: a.id }); save();
  res.json({ ok: true, entry: a });
});
app.delete('/api/adspend/:id', requireAuth, requireAdmin, (req, res) => {
  const i = db.adspend.findIndex((x) => x.id === Number(req.params.id));
  if (i >= 0) { db.adspend.splice(i, 1); save(); }
  res.json({ ok: true });
});

/* ---------- المستخدمون ---------- */
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, err: 'bad-body' });
  if (db.users.some((u) => u.username.toLowerCase() === String(username).trim().toLowerCase())) {
    return res.status(409).json({ ok: false, err: 'duplicate' });
  }
  const u = {
    id: nextId(db, 'users'),
    username: String(username).trim(),
    password: hashPassword(password),
    name: String(name || '').trim() || String(username).split('@')[0],
    role: role === 'admin' ? 'admin' : 'agent',
    active: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(u); logHistory(req.user, 'create', 'user', u.id, u.username); save();
  res.json({ ok: true, user: publicUser(u) });
});
app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const u = db.users.find((x) => x.id === Number(req.params.id));
  if (!u) return res.status(404).json({ ok: false, err: 'not-found' });
  const b = req.body || {};
  if ('name' in b) u.name = String(b.name).trim() || u.name;
  if ('role' in b && u.id !== req.user.id) u.role = b.role === 'admin' ? 'admin' : 'agent';
  if ('active' in b && u.id !== req.user.id) u.active = !!b.active;
  if (b.password) u.password = hashPassword(b.password);
  logHistory(req.user, 'update', 'user', u.id, u.username); save();
  res.json({ ok: true, user: publicUser(u) });
});
app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ ok: false, err: 'self' });
  const i = db.users.findIndex((x) => x.id === Number(req.params.id));
  if (i >= 0) { const [u] = db.users.splice(i, 1); logHistory(req.user, 'delete', 'user', u.id, u.username); save(); }
  res.json({ ok: true });
});

/* ---------- الإعدادات ---------- */
app.put('/api/settings', requireAuth, requireAdmin, (req, res) => {
  const b = req.body || {};
  for (const k of ['storeName', 'currency']) if (k in b) db.settings[k] = String(b[k]).slice(0, 40);
  for (const k of ['perDelivered', 'perUpsell', 'bonusThreshold', 'bonusAmount']) if (k in b) db.settings[k] = Number(b[k]) || 0;
  if (Array.isArray(b.sources)) db.settings.sources = b.sources.map((s) => String(s).trim()).filter(Boolean);
  logHistory(req.user, 'update', 'settings', '', ''); save();
  res.json({ ok: true, settings: db.settings });
});

/* ---------- السجل / النسخ / الاستيراد ---------- */
app.get('/api/history', requireAuth, requireAdmin, (_req, res) => res.json({ ok: true, history: db.history.slice(0, 2000) }));

app.get('/api/export', requireAuth, requireAdmin, (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="paraveda-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(db);
});

app.post('/api/restore', requireAuth, requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.orders) || !Array.isArray(b.users)) return res.status(400).json({ ok: false, err: 'bad-body' });
  b.meta = db.meta; // نحتفظ بالسر والعدّادات
  db = b; save();
  logHistory(req.user, 'restore', 'db', '', ''); save();
  res.json({ ok: true });
});

app.post('/api/import', requireAuth, requireAdmin, (req, res) => {
  const legacy = req.body;
  if (!legacy || typeof legacy !== 'object') return res.status(400).json({ ok: false, err: 'bad-body' });
  const fresh = emptyDb();
  fresh.meta.secret = db.meta.secret;
  fresh.settings = db.settings;
  const report = importLegacy(legacy, fresh);
  if (!report.orders && !report.products && !report.cities && !report.users) {
    return res.status(400).json({ ok: false, err: 'no-legacy-data' });
  }
  db = fresh;
  logHistory(req.user, 'import', 'db', '', JSON.stringify(report)); save();
  res.json({ ok: true, report });
});

/* ---------- الملفات الثابتة ---------- */
app.use(express.static(PUBLIC_DIR));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Paraveda CRM يعمل على المنفذ ${PORT} — الطلبيات: ${db.orders.length}`);
});
