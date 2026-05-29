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

/* ── Préfixes pays reconnus ── */
const VALID_PREFIXES = ['+224', '+229', '+225'];

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

  const { phone, pin } = await parseBody(req);
  if (!phone || !pin) return res.status(400).json({ error: 'Numéro et PIN requis' });

  /* ── Normaliser le numéro ── */
  const normalized = phone.trim();
  const hasPrefix = VALID_PREFIXES.some(p => normalized.startsWith(p));
  if (!hasPrefix) {
    return res.status(400).json({ error: 'Format de numéro invalide. Incluez l\'indicatif pays (+224, +229, +225).' });
  }

  try {
    const rows = await supabaseRequest(
      'GET',
      '/users?phone=eq.' + encodeURIComponent(normalized) + '&select=*'
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(401).json({ error: 'Numéro ou PIN incorrect' });
    }

    const user = rows[0];

    if (!verifyPin(pin, user.pin_hash)) {
      return res.status(401).json({ error: 'Numéro ou PIN incorrect' });
    }

    const token = createJWT({ userId: user.id, phone: user.phone, role: user.role });
    const { pin_hash, ...safeUser } = user;

    return res.status(200).json({ token, user: safeUser });

  } catch (err) {
    console.error('[login] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez dans quelques instants.' });
  }
};
