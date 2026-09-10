import type { AdSpend, Order, Settings } from './types';

export const isDelivered = (o: Order) => o.delivery === 'Livrée';
export const isCancelled = (o: Order) => o.status === 'Annulée';

export function inRange(date: string, from: string | null, to: string | null): boolean {
  const d = (date || '').slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export interface Kpis {
  total: number;
  confirmed: number;
  cancelled: number;
  delivered: number;
  deliveredRate: number;
  confirmRate: number;
  revenue: number;      // CA: مجموع (الثمن × الكمية) للطلبيات المسلّمة
  commissions: number;  // عمولات الطلبيات المسلّمة
  fees: number;         // رسوم التوصيل (حسب المدينة) للمسلّمة — المرتجعة = 0
  cogs: number;         // ثمن شراء المنتوجات المسلّمة
  upsells: number;      // مجموع UPSEL في الطلبيات المسلّمة فقط
  returned: number;
  shipping: number;     // في الطريق (Expédier vers)
  outOfStock: number;
  adspend: number;      // مصاريف الإعلان في الفترة
  profit: number;       // صافي الربح
  roas: number;
}

export function computeKpis(orders: Order[], adspend: AdSpend[], from: string | null, to: string | null): Kpis {
  let total = 0, confirmed = 0, cancelled = 0, delivered = 0, returned = 0, shipping = 0, outOfStock = 0;
  let revenue = 0, commissions = 0, fees = 0, upsells = 0, adspendTotal = 0;
  for (const o of orders) {
    total++;
    if (o.status === 'Confirmée' || o.confirmedAt) confirmed++;
    if (o.status === 'Annulée') cancelled++;
    if (o.delivery === 'Livrée') delivered++;
    else if (o.delivery === 'Retour') returned++;
    else if (o.delivery === 'Expédier vers') shipping++;
    else if (o.delivery === 'Out Of Stock') outOfStock++;
    if (isDelivered(o)) {
      revenue += o.price * o.qty;
      commissions += o.commission || 0;
      fees += o.deliveryFee || 0;
      upsells += Number(o.upsell) || 0;
    }
  }
  for (const a of adspend) if (inRange(a.date, from, to)) adspendTotal += a.amount || 0;
  return {
    total, confirmed, cancelled, delivered, returned, shipping, outOfStock,
    deliveredRate: total ? delivered / total : 0,
    confirmRate: total ? confirmed / total : 0,
    revenue, commissions, fees, cogs: 0, upsells,
    adspend: adspendTotal, profit: 0, roas: adspendTotal ? revenue / adspendTotal : 0
  };
}

/** صافي ربح الفترة: CA المسلّم − ثمن الشراء − العمولات − رسوم التوصيل − الإعلانات */
export function computeProfit(orders: Order[], products: { id: number; name: string; cost: number }[], adspend: AdSpend[], from: string | null, to: string | null): Kpis {
  const k = computeKpis(orders, adspend, from, to);
  const costById = new Map(products.map((p) => [p.id, p.cost || 0]));
  const costByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p.cost || 0]));
  let cogs = 0;
  for (const o of orders) {
    if (!isDelivered(o)) continue;
    const cost = (o.productId != null ? costById.get(o.productId) : undefined) ?? costByName.get((o.productName || '').trim().toLowerCase()) ?? 0;
    cogs += cost * o.qty;
  }
  k.cogs = cogs;
  k.profit = k.revenue - cogs - k.commissions - k.fees - k.adspend;
  k.roas = k.adspend ? k.revenue / k.adspend : 0;
  return k;
}

export interface AgentSalary {
  agent: string;
  delivered: number;
  upsells: number;
  base: number;
  upsellPay: number;
  bonus: number;
  total: number;
}

/** أجور الفريق: Livrée × rate + UPSEL(المسلّمة فقط) × rate + بونص عند بلوغ العتبة */
export function computeSalaries(orders: Order[], from: string | null, to: string | null, s: Settings): AgentSalary[] {
  const byAgent = new Map<string, AgentSalary>();
  for (const o of orders) {
    if (!isDelivered(o) || !inRange(o.date, from, to)) continue;
    const name = o.agent || '—';
    let rec = byAgent.get(name);
    if (!rec) { rec = { agent: name, delivered: 0, upsells: 0, base: 0, upsellPay: 0, bonus: 0, total: 0 }; byAgent.set(name, rec); }
    rec.delivered++;
    rec.upsells += Number(o.upsell) || 0;
  }
  const list = [...byAgent.values()].map((r) => {
    r.base = r.delivered * s.perDelivered;
    r.upsellPay = r.upsells * s.perUpsell;
    r.bonus = s.bonusThreshold > 0 && r.delivered >= s.bonusThreshold ? s.bonusAmount : 0;
    r.total = r.base + r.upsellPay + r.bonus;
    return r;
  });
  return list.sort((a, b) => b.total - a.total);
}

export interface ProductPerf {
  name: string;
  orders: number;
  delivered: number;
  returned: number;
  revenue: number;
  cost: number;
  commissions: number;
  fees: number;
  spend: number;
  profit: number;
}

export function computeProductPerf(orders: Order[], products: { id: number; name: string; cost: number }[], adspend: AdSpend[], from: string | null, to: string | null): ProductPerf[] {
  const map = new Map<string, ProductPerf>();
  const costById = new Map(products.map((p) => [p.id, p.cost || 0]));
  const costByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p.cost || 0]));
  const get = (name: string): ProductPerf => {
    let r = map.get(name);
    if (!r) { r = { name, orders: 0, delivered: 0, returned: 0, revenue: 0, cost: 0, commissions: 0, fees: 0, spend: 0, profit: 0 }; map.set(name, r); }
    return r;
  };
  for (const o of orders) {
    if (!inRange(o.date, from, to)) continue;
    const name = o.productName || '—';
    const r = get(name);
    r.orders++;
    if (o.delivery === 'Retour') r.returned++;
    if (isDelivered(o)) {
      r.delivered++;
      r.revenue += o.price * o.qty;
      r.commissions += o.commission || 0;
      r.fees += o.deliveryFee || 0;
      const cost = (o.productId != null ? costById.get(o.productId) : undefined) ?? costByName.get(name.trim().toLowerCase()) ?? 0;
      r.cost += cost * o.qty;
    }
  }
  for (const a of adspend) {
    if (!inRange(a.date, from, to)) continue;
    get(a.productName || '—').spend += a.amount || 0;
  }
  const list = [...map.values()];
  for (const r of list) r.profit = r.revenue - r.cost - r.commissions - r.fees - r.spend;
  return list.sort((a, b) => b.profit - a.profit || b.revenue - a.revenue);
}

export interface CityStat {
  name: string;
  price: number;
  orders: number;
  delivered: number;
  revenue: number;
}

export function computeCityStats(orders: Order[], cities: { name: string; price: number }[], from: string | null, to: string | null): CityStat[] {
  const priceOf = new Map(cities.map((c) => [c.name.trim().toLowerCase(), c.price || 0]));
  const map = new Map<string, CityStat>();
  for (const o of orders) {
    if (!inRange(o.date, from, to)) continue;
    const name = o.city || '—';
    let r = map.get(name);
    if (!r) { r = { name, price: priceOf.get(name.trim().toLowerCase()) ?? 0, orders: 0, delivered: 0, revenue: 0 }; map.set(name, r); }
    r.orders++;
    if (isDelivered(o)) { r.delivered++; r.revenue += o.price * o.qty; }
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders);
}

export interface DayPoint { day: string; orders: number; delivered: number; revenue: number }

export function computeDaily(orders: Order[], from: string | null, to: string | null): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const o of orders) {
    if (!inRange(o.date, from, to)) continue;
    const day = (o.date || '').slice(0, 10);
    if (!day) continue;
    let r = map.get(day);
    if (!r) { r = { day, orders: 0, delivered: 0, revenue: 0 }; map.set(day, r); }
    r.orders++;
    if (isDelivered(o)) { r.delivered++; r.revenue += o.price * o.qty; }
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}
