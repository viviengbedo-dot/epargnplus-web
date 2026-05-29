/**
 * Epargn+ — Utilitaires d'authentification
 * - Hachage PIN : PBKDF2-SHA256 (100 000 itérations)
 * - JWT         : HS256 maison (sans librairie externe)
 *
 * Variables d'environnement requises :
 *   JWT_SECRET → secret aléatoire ≥ 32 caractères
 */

const crypto = require('crypto');

const JWT_SECRET   = process.env.JWT_SECRET || 'epargn-jwt-dev-secret-CHANGE-IN-PRODUCTION';
const JWT_EXPIRY_S = 7 * 24 * 3600; // 7 jours
const PBKDF2_ITERS = 100_000;

/* ── Helpers Base64url ── */
function toB64url(buf) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function fromB64url(str) {
  const pad = (4 - (str.length % 4)) % 4;
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

/* ════════════════════════════════════════
   PIN — PBKDF2-SHA256
════════════════════════════════════════ */

/**
 * Retourne "salt_hex:hash_hex" pour un PIN en clair.
 */
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, PBKDF2_ITERS, 64, 'sha256').toString('hex');
  return salt + ':' + hash;
}

/**
 * Vérifie un PIN en clair contre un hash stocké.
 * Utilise crypto.timingSafeEqual pour éviter les timing attacks.
 */
function verifyPin(pin, stored) {
  try {
    const sep  = stored.indexOf(':');
    const salt = stored.slice(0, sep);
    const hash = stored.slice(sep + 1);
    const check = crypto.pbkdf2Sync(pin, salt, PBKDF2_ITERS, 64, 'sha256').toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(check, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch {
    return false;
  }
}

/* ════════════════════════════════════════
   JWT — HS256
════════════════════════════════════════ */

/**
 * Crée un JWT signé HS256.
 * @param {object} payload - données à inclure (ex. { userId, phone, role })
 * @returns {string} token JWT
 */
function createJWT(payload) {
  const header = toB64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now    = Math.floor(Date.now() / 1000);
  const claims = toB64url(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY_S,
  }));
  const sig = toB64url(
    crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + claims).digest()
  );
  return header + '.' + claims + '.' + sig;
}

/**
 * Vérifie et décode un JWT.
 * @param {string} token
 * @returns {object|null} payload si valide, null sinon
 */
function verifyJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const [header, claims, sig] = parts;
    const expected = toB64url(
      crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + claims).digest()
    );
    if (sig !== expected) return null;

    const payload = JSON.parse(fromB64url(claims).toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { hashPin, verifyPin, createJWT, verifyJWT };
