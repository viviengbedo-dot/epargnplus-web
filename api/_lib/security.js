/**
 * Epargn+ — Helpers sécurité : anti brute-force (throttle) + audit log.
 * S'appuie sur les tables public.auth_throttle et public.audit_log
 * (cf. db/security.sql). Tolérant aux pannes : ne bloque jamais le flux
 * applicatif si la table n'existe pas encore (fail-open côté throttle
 * uniquement pour ne pas verrouiller les vrais users en cas d'incident DB).
 */

const { supabaseRequest } = require('./supabase');

const MAX_ATTEMPTS = 5;          // tentatives avant blocage
const WINDOW_MS    = 15 * 60e3;  // fenêtre glissante : 15 min
const LOCK_MS      = 15 * 60e3;  // durée du blocage : 15 min

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || null;
}

/**
 * Vérifie l'état du verrou pour `key`. Retourne { blocked, retryAfter }.
 * Ne consomme pas de tentative.
 */
async function checkThrottle(key) {
  try {
    const rows = await supabaseRequest('GET',
      '/auth_throttle?key=eq.' + encodeURIComponent(key) + '&select=attempts,window_start,locked_until&limit=1');
    const r = Array.isArray(rows) && rows[0];
    if (!r) return { blocked: false };
    if (r.locked_until && new Date(r.locked_until).getTime() > Date.now()) {
      return { blocked: true, retryAfter: Math.ceil((new Date(r.locked_until).getTime() - Date.now()) / 1000) };
    }
    return { blocked: false };
  } catch (e) {
    return { blocked: false }; // fail-open : ne pas bloquer un user légitime sur incident DB
  }
}

/** Incrémente le compteur d'échecs ; verrouille au-delà de MAX_ATTEMPTS. */
async function recordFail(key) {
  try {
    const rows = await supabaseRequest('GET',
      '/auth_throttle?key=eq.' + encodeURIComponent(key) + '&select=*&limit=1');
    const now = Date.now();
    const r = Array.isArray(rows) && rows[0];

    if (!r) {
      await supabaseRequest('POST', '/auth_throttle',
        { key, attempts: 1, window_start: new Date(now).toISOString(), updated_at: new Date(now).toISOString() });
      return;
    }
    // Fenêtre expirée → repart à 1
    const winStart = new Date(r.window_start).getTime();
    let attempts = (now - winStart > WINDOW_MS) ? 1 : (Number(r.attempts) || 0) + 1;
    const patch = { attempts, updated_at: new Date(now).toISOString() };
    if (attempts === 1) patch.window_start = new Date(now).toISOString();
    if (attempts >= MAX_ATTEMPTS) patch.locked_until = new Date(now + LOCK_MS).toISOString();
    await supabaseRequest('PATCH', '/auth_throttle?key=eq.' + encodeURIComponent(key), patch);
  } catch (e) { /* silencieux */ }
}

/** Réinitialise le compteur après un succès. */
async function resetThrottle(key) {
  try {
    await supabaseRequest('PATCH', '/auth_throttle?key=eq.' + encodeURIComponent(key),
      { attempts: 0, locked_until: null, window_start: new Date().toISOString(), updated_at: new Date().toISOString() });
  } catch (e) { /* silencieux */ }
}

/** Écrit une ligne d'audit. Jamais bloquant. */
async function logAudit(userId, action, meta, req) {
  try {
    await supabaseRequest('POST', '/audit_log', {
      user_id: userId || null,
      action,
      meta: meta || {},
      ip: req ? clientIp(req) : null,
      user_agent: req ? (req.headers['user-agent'] || null) : null,
    });
  } catch (e) { /* silencieux */ }
}

module.exports = { checkThrottle, recordFail, resetThrottle, logAudit, clientIp, MAX_ATTEMPTS };
