/**
 * POST /api/auth/reset-pin — Epargn+
 * Réinitialise le PIN d'un utilisateur après vérification OTP.
 *
 * Corps JSON attendu :
 *   { phone, otp_token, otp_code, new_pin }
 *   → phone : numéro international complet (+22962000000)
 *
 * Retourne :
 *   200 { token, user }  — succès, nouvelle session ouverte
 *   400                  — validation / OTP invalide
 *   404                  — numéro non enregistré
 *   500                  — erreur serveur
 */

const crypto = require('crypto');
const { supabaseRequest } = require('../_lib/supabase');
const { hashPin, createJWT } = require('../_lib/auth');

const OTP_SECRET = process.env.OTP_SECRET || 'epargn-otp-dev-secret-change-me';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes — aligné avec otp/index.js

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

function verifyOTPToken(otp_code, phone, token) {
  if (!token || !otp_code || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const ts  = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (Date.now() - parseInt(ts, 10) > OTP_TTL_MS) return false;
  const expected = crypto
    .createHmac('sha256', OTP_SECRET)
    .update(otp_code + ':' + phone + ':' + ts)
    .digest('hex');
  return sig === expected;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  const { phone, otp_token, otp_code, new_pin } = await parseBody(req);

  /* ── Validation des champs ── */
  if (!phone || !otp_token || !otp_code || !new_pin) {
    return res.status(400).json({ error: 'Champs requis manquants (phone, otp_token, otp_code, new_pin)' });
  }

  const normalized = phone.trim();
  const hasPrefix = VALID_PREFIXES.some(p => normalized.startsWith(p));
  if (!hasPrefix) {
    return res.status(400).json({ error: 'Format de numéro invalide (+224, +229 ou +225 requis)' });
  }

  if (!/^\d{4}$/.test(new_pin)) {
    return res.status(400).json({ error: 'Le nouveau PIN doit contenir exactement 4 chiffres' });
  }

  /* ── Vérification OTP ── */
  if (!verifyOTPToken(otp_code, normalized, otp_token)) {
    return res.status(400).json({ error: 'Code OTP invalide ou expiré. Demandez un nouveau code.' });
  }

  try {
    /* ── Vérifier que le numéro est bien enregistré ── */
    const rows = await supabaseRequest(
      'GET',
      '/users?phone=eq.' + encodeURIComponent(normalized) + '&select=id,phone,prenom,nom,role,country'
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Aucun compte trouvé pour ce numéro.' });
    }

    const user = rows[0];

    /* ── Mettre à jour le PIN ── */
    const pin_hash = hashPin(new_pin);
    await supabaseRequest(
      'PATCH',
      '/users?id=eq.' + user.id,
      { pin_hash, updated_at: new Date().toISOString() }
    );

    /* ── Ouvrir une nouvelle session ── */
    const token = createJWT({ userId: user.id, phone: user.phone, role: user.role });

    console.log('[reset-pin] PIN réinitialisé pour :', normalized);

    const { pin_hash: _ph, ...safeUser } = user;
    return res.status(200).json({ token, user: safeUser });

  } catch (err) {
    console.error('[reset-pin] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez dans quelques instants.' });
  }
};
