/**
 * POST /api/auth/login — Epargn+
 * Authentifie un utilisateur avec son numéro international + PIN.
 * Supporte : Guinée (+224), Bénin (+229), Côte d'Ivoire (+225)
 *
 * Corps JSON attendu :
 *   { phone, pin }
 *   → phone doit être au format international : +22962000000
 *     (le client web calcule fullPhone = prefix + localNumber)
 *
 * Retourne :
 *   200 { token, user }   — succès
 *   400                   — champs manquants
 *   401                   — numéro ou PIN incorrect
 *   500                   — erreur serveur
 */

const { supabaseRequest } = require('../_lib/supabase');
const { verifyPin, createJWT } = require('../_lib/auth');
const { checkThrottle, recordFail, resetThrottle, logAudit } = require('../_lib/security');

/* ── Préfixes pays reconnus ── */
const VALID_PREFIXES = ['+224', '+229', '+225', '+86'];

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  const body = await parseBody(req);
  const { phone, pin } = body;
  const deviceId    = (body.device_id || '').toString().slice(0, 128);
  const deviceLabel = (body.device_label || '').toString().slice(0, 120);
  if (!phone || !pin) return res.status(400).json({ error: 'Numéro et PIN requis' });

  /* ── Normaliser le numéro ── */
  const normalized = phone.trim();
  const hasPrefix = VALID_PREFIXES.some(p => normalized.startsWith(p));
  if (!hasPrefix) {
    return res.status(400).json({ error: 'Format de numéro invalide. Incluez l\'indicatif pays (+224, +229, +225).' });
  }

  /* ── Anti brute-force : blocage après 5 échecs / 15 min ── */
  const throttleKey = 'login:' + normalized;
  const gate = await checkThrottle(throttleKey);
  if (gate.blocked) {
    await logAudit(null, 'login_blocked', { phone: normalized }, req);
    res.setHeader('Retry-After', String(gate.retryAfter || 900));
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans ' + Math.ceil((gate.retryAfter || 900) / 60) + ' minutes.' });
  }

  try {
    const rows = await supabaseRequest(
      'GET',
      '/users?phone=eq.' + encodeURIComponent(normalized) + '&select=*'
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      await recordFail(throttleKey);
      await logAudit(null, 'login_fail', { phone: normalized, reason: 'unknown_user' }, req);
      return res.status(401).json({ error: 'Numéro ou PIN incorrect' });
    }

    const user = rows[0];

    if (!verifyPin(pin, user.pin_hash)) {
      await recordFail(throttleKey);
      await logAudit(user.id, 'login_fail', { phone: normalized, reason: 'bad_pin' }, req);
      return res.status(401).json({ error: 'Numéro ou PIN incorrect' });
    }

    await resetThrottle(throttleKey);
    await logAudit(user.id, 'login_success', { phone: normalized }, req);

    /* ── Validation appareil : alerte si appareil inconnu ── */
    if (deviceId) {
      try {
        const existing = await supabaseRequest('GET',
          '/user_devices?user_id=eq.' + encodeURIComponent(user.id) +
          '&device_id=eq.' + encodeURIComponent(deviceId) + '&select=id&limit=1');
        if (Array.isArray(existing) && existing[0]) {
          await supabaseRequest('PATCH',
            '/user_devices?id=eq.' + encodeURIComponent(existing[0].id),
            { last_seen: new Date().toISOString() });
        } else {
          await supabaseRequest('POST', '/user_devices',
            { user_id: user.id, device_id: deviceId, label: deviceLabel || 'Appareil inconnu' });
          await logAudit(user.id, 'new_device', { label: deviceLabel || 'Appareil inconnu' }, req);
          /* Alerte e-mail (best-effort, ne bloque pas le login) */
          if (user.email) {
            require('../_lib/email').trigger('new_device', user.id, {
              prenom: user.prenom || '', appareil: deviceLabel || 'un nouvel appareil',
            }, user.email).catch(() => {});
          }
        }
      } catch (e) { /* table absente / incident → non bloquant */ }
    }

    const token = createJWT({ userId: user.id, phone: user.phone, role: user.role });
    const { pin_hash, ...safeUser } = user;

    return res.status(200).json({ token, user: safeUser });

  } catch (err) {
    console.error('[login] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez dans quelques instants.' });
  }
};
