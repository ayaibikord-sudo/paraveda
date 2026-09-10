// Paraveda CRM — استيراد بيانات النسخة القديمة (crm_data.json) وتحويلها للصيغة الجديدة
import { hashPassword } from './auth.js';

const norm = (s) => String(s || '').trim().toLowerCase();

export function importLegacy(legacy, db) {
  const report = { orders: 0, products: 0, cities: 0, users: 0, adspend: 0, history: 0, skipped: 0 };
  const g = (key) => (legacy && legacy[key] && Array.isArray(legacy[key].d) ? legacy[key].d : null);

  /* ---- المدن ---- */
  const cityMap = new Map(db.cities.map((c) => [norm(c.name), c]));
  for (const v of g('afrizon_villes_v2') || []) {
    const name = String(v.nom || '').trim();
    if (!name) continue;
    const price = Number(v.prix) || 0;
    const found = cityMap.get(norm(name));
    if (found) { found.price = price; continue; }
    const c = { id: db.cities.length ? Math.max(...db.cities.map((x) => x.id)) + 1 : 1, name, price };
    db.cities.push(c); cityMap.set(norm(name), c); report.cities++;
  }

  /* ---- المنتوجات (+ ثمن الشراء من sheet "pièce") ---- */
  const costMap = new Map();
  for (const row of (legacy && legacy['sheet_pièce'] && legacy['sheet_pièce'].d) || []) {
    if (Array.isArray(row) && row[0]) costMap.set(norm(row[0]), Number(row[2]) || 0);
  }
  const prodMap = new Map(db.products.map((p) => [norm(p.name), p]));
  for (const p of g('afrizon_catalog_v1') || []) {
    const name = String(p.nom || '').trim();
    if (!name) continue;
    const found = prodMap.get(norm(name));
    if (found) {
      found.price = Number(p.prix) || found.price;
      found.commission = Number(p.commission) || found.commission;
      continue;
    }
    const prod = {
      id: db.products.length ? Math.max(...db.products.map((x) => x.id)) + 1 : 1,
      name,
      price: Number(p.prix) || 0,
      commission: Number(p.commission) || 0,
      cost: costMap.get(norm(name)) || 0,
      stock: p.stock === '' ? null : Number(p.stock) || 0,
      link: p.link || '',
      active: true
    };
    db.products.push(prod); prodMap.set(norm(name), prod); report.products++;
  }

  /* ---- المستخدمون ---- */
  for (const u of g('afrizon_users_v1') || []) {
    const username = String(u.username || '').trim();
    if (!username || db.users.some((x) => norm(x.username) === norm(username))) continue;
    db.users.push({
      id: db.users.length ? Math.max(...db.users.map((x) => x.id)) + 1 : 1,
      username,
      password: u.password && !String(u.password).includes(':') ? hashPassword(u.password) : (u.password || ''),
      name: (u.agent || '').trim() || username.split('@')[0],
      role: u.role === 'admin' ? 'admin' : 'agent',
      active: true,
      createdAt: new Date().toISOString()
    });
    report.users++;
  }
  if (!db.users.some((u) => u.role === 'admin')) {
    db.users.push({
      id: db.users.length ? Math.max(...db.users.map((x) => x.id)) + 1 : 1,
      username: 'admin@paraveda.ma',
      password: hashPassword('paraveda2026'),
      name: 'Admin',
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString()
    });
  }

  /* ---- الطلبيات ---- */
  const statusMap = { 'confirmé': 'Confirmée', 'confirme': 'Confirmée', 'annulé': 'Annulée', 'annule': 'Annulée', 'rappel': 'Rappel', 'appel-1': 'Appel-1', 'nouvelle': 'Nouvelle' };
  for (const o of g('afrizon_orders_v5') || []) {
    if (db.orders.some((x) => x.id === o.id)) { report.skipped++; continue; }
    const product = prodMap.get(norm(o.produit));
    const city = cityMap.get(norm(o.ville));
    const delivered = o.livraison === 'Livrée';
    db.orders.push({
      id: Number(o.id) || (db.orders.length ? Math.max(...db.orders.map((x) => x.id)) + 1 : 1),
      date: o.dateCreation || '',
      confirmedAt: o.dateConfirmation || '',
      customerName: o.nom || '',
      phone: o.telephone || '',
      city: o.ville || '',
      address: o.adresse || '',
      productId: product ? product.id : null,
      productName: o.produit || (product ? product.name : ''),
      qty: Number(o.qte) || 1,
      price: Number(o.prix) || (product ? product.price : 0),
      commission: Number(o.commission) || (product ? product.commission : 0),
      deliveryFee: delivered && city ? city.price : 0,
      agent: o.agent || '',
      source: o.originLead || '',
      status: statusMap[norm(o.statut)] || o.statut || 'Nouvelle',
      delivery: o.livraison || '',
      upsell: Number(o.upsell) || 0,
      note: o.remarques || '',
      createdAt: o.dateCreation ? `${o.dateCreation}T00:00:00.000Z` : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    report.orders++;
  }
  db.orders.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);

  /* ---- مصاريف الإعلانات ---- */
  for (const a of g('afrizon_adspend_v1') || []) {
    db.adspend.push({
      id: db.adspend.length ? Math.max(...db.adspend.map((x) => x.id)) + 1 : 1,
      date: a.date || '',
      productName: a.produit || '',
      source: a.source || '',
      agent: a.agent || '',
      amount: Number(a.amount) || 0,
      note: ''
    });
    report.adspend++;
  }

  /* ---- السجل ---- */
  for (const h of (g('afrizon_history_v1') || []).slice(-1500)) {
    db.history.push({
      id: db.history.length ? Math.max(...db.history.map((x) => x.id)) + 1 : 1,
      at: h.at || '',
      user: h.user || h.agent || '',
      action: h.action || '',
      entity: 'order',
      entityId: h.orderId || '',
      summary: h.client ? `${h.client}` : ''
    });
    report.history++;
  }
  db.history.sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  return report;
}
