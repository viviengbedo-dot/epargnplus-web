/**
 * POST /api/admin/update-kyc — Epargn+
 * Met à jour le statut KYC d'un utilisateur.
 * Supporte une raison de rejet (rejectionReason) pour informer le client.
 *
 * Headers : Authorization: Bearer <ADMIN_SECRET>
 * Corps   : { userId, status: 'verified'|'rejected'|'pending'|'none', rejectionReason? }
 */

const { supabaseRequest } = require('../_lib/supabase');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const body = await parseBody(req);
  const { userId, status, rejectionReason } = body;

  if (!userId || !status) {
    return res.status(400).json({ error: 'userId et status requis' });
  }
  const allowed = ['verified', 'rejected', 'pending', 'none'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'status invalide' });
  }

  const now   = new Date().toISOString();
  const patch = { kyc_status: status, updated_at: now };

  if (status === 'verified') {
    /* Effacer la raison de rejet précédente si elle existait */
    patch.kyc_rejection_reason = null;
    patch.kyc_verified_at = now;
  }
  if (status === 'rejected' && rejectionReason) {
    patch.kyc_rejection_reason = String(rejectionReason).trim().slice(0, 500);
  }
  if (status === 'none' || status === 'pending') {
    patch.kyc_rejection_reason = null;
  }

  try {
    /* Tentative avec colonnes étendues (migration SQL v2) */
    try {
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId), patch);
    } catch (extErr) {
      /* Fallback sans les colonnes optionnelles */
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { kyc_status: status, updated_at: now });
    }
    console.log('[update-kyc] userId=' + userId + ' → ' + status + (rejectionReason ? ' raison: ' + rejectionReason : ''));
    return res.status(200).json({ ok: true, kyc_status: status });
  } catch (err) {
    console.error('[admin/update-kyc] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
