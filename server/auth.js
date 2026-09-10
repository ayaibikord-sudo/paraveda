// Paraveda CRM — المصادقة (رموز موقّعة HMAC + كلمات سر PBKDF2 متوافقة مع PHP)
import crypto from 'node:crypto';

const DAY = 24 * 60 * 60 * 1000;
const TOKEN_TTL = 30 * DAY;
const PBKDF2_ITER = 100000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITER, 32, 'sha256').toString('hex');
  return `pbkdf2:${PBKDF2_ITER}:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const s = String(stored || '');
  if (s.startsWith('pbkdf2:')) {
    const [, iter, salt, hash] = s.split(':');
    if (!salt || !hash) return false;
    const test = crypto.pbkdf2Sync(String(password), salt, Number(iter) || PBKDF2_ITER, 32, 'sha256').toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
    } catch {
      return false;
    }
  }
  return false; // الصيغ القديمة غير مدعومة — أعد تعيين كلمة السر من صفحة الفريق
}

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

export function signToken(secret, payload) {
  const body = { ...payload, exp: Date.now() + TOKEN_TTL };
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(secret, token) {
  if (!token || typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
