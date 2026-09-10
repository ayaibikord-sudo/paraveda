// Paraveda CRM — طبقة التخزين (JSON + كتابة ذرّية + نسخ احتياطية دوّارة)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 60;

export function emptyDb() {
  return {
    meta: { version: 2, secret: crypto.randomBytes(32).toString('hex'), nextIds: {} },
    settings: {
      storeName: 'Paraveda',
      currency: 'DH',
      perDelivered: 8,
      perUpsell: 8,
      bonusThreshold: 151,
      bonusAmount: 1000,
      sources: ['Leader', 'Facebook', 'Instagram', 'TikTok', 'Appel', 'WhatsApp']
    },
    users: [],
    products: [],
    cities: [],
    orders: [],
    adspend: [],
    history: []
  };
}

export function readDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    if (!db || typeof db !== 'object' || !Array.isArray(db.orders)) return null;
    return db;
  } catch {
    return null;
  }
}

export function nextId(db, coll) {
  const m = db.meta.nextIds || (db.meta.nextIds = {});
  while (!m[coll] || db[coll].some((x) => x.id === m[coll])) m[coll] = maxId(db[coll]) + 1;
  m[coll] += 1;
  return m[coll] - 1;
}

function maxId(list) {
  return list.reduce((a, x) => Math.max(a, Number(x.id) || 0), 0);
}

let lastBackupAt = 0;
export function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // نسخة احتياطية قبل الكتابة (مرة كل 10 دقائق على الأكثر)
  const now = Date.now();
  if (fs.existsSync(DB_FILE) && now - lastBackupAt > 10 * 60 * 1000) {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, `db-${stamp}.json`));
      lastBackupAt = now;
      const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort();
      while (files.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    } catch { /* النسخ الاحتياطي لا يوقف العملية */ }
  }
  const tmp = `${DB_FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}
