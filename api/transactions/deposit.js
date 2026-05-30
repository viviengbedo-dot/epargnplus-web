/**
 * POST /api/transactions/deposit — Epargn+
 * Enregistre une DEMANDE de dépôt en attente de validation admin.
 *
 * Corps JSON : { amount, operator, projectId?, note?, senderPhone? }
 */

const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT }       = require('../_lib/auth');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function extractToken(req) {
  const auth = (req.headers['authorization'] || '').trim();
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST uniquement' });

  const rawToken = extractToken(req);
  if (!rawToken) return res.status(401).json({ error: 'Non authentifié' });

  const jwtPayload = verifyJWT(rawToken);
  if (!jwtPayload) return res.status(401).json({ error: 'Session expirée' });

  const body      = await parseBody(req);
  const amount      = parseInt(body.amount, 10);
  const operator    = (body.operator    || 'Mobile Money').trim();
  const projectId   = body.projectId   || null;
  const note        = body.note        || null;
  const senderPhone = (body.senderPhone || '').trim() || null;

  if (!amount || amount < 1000) {
    return res.status(400).json({ error: 'Montant minimum : 1 000 GNF' });
  }

  /* Vérifier que le compte existe */
  let user;
  try {
    const rows = await supabaseRequest('GET',
      '/users?id=eq.' + encodeURIComponent(jwtPayload.userId) + '&select=id,phone,prenom,country');
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    user = rows[0];
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }

  const now = new Date().toISOString();
  let txnId = null;
  let usedFallback = false;

  /* ── Référence unique internationale : DEP-YYYYMMDD-XXXXXX ── */
  const ref = 'DEP-' + now.slice(0,10).replace(/-/g,'') + '-' +
    Math.random().toString(36).substr(2,6).toUpperCase();

  if (!senderPhone) {
    console.warn('[deposit] senderPhone absent — dépôt accepté sans N° expéditeur (compatibilité)');
  }

  /* ── 1. Écriture dans la table transactions ── */
  try {
    const txnRows = await supabaseRequest('POST', '/transactions', {
      user_id:    jwtPayload.userId,
      type:       'deposit',
      amount:     amount,
      operator:   operator,
      is_credit:  true,
      label:        ref + ' · Dépôt ' + operator,
      note:         note || (senderPhone ? 'Expéditeur : ' + senderPhone : null),
      sender_phone: senderPhone,
      project_id:   projectId,
      statut:       'pending',
      status:       'pending',
    });
    const created = Array.isArray(txnRows) ? txnRows[0] : txnRows;
    if (created) txnId = created.id;
    console.log('[deposit] txn id=' + txnId + ' user=' + jwtPayload.userId + ' amount=' + amount);
  } catch (txnErr) {
    console.warn('[deposit] transactions table:', txnErr.message);
    usedFallback = true;
  }

  /* ── 2. Mise à jour pending_deposit (rétrocompat) ── */
  const pendingData = JSON.stringify({ amount, operator, requestedAt: now, txnId, projectId, senderPhone });
  try {
    await supabaseRequest('PATCH',
      '/users?id=eq.' + encodeURIComponent(jwtPayload.userId),
      { pending_deposit: pendingData, updated_at: now }
    );
  } catch (pdErr) {
    if (usedFallback) {
      console.error('[deposit] Échec total:', pdErr.message);
      return res.status(500).json({ error: 'Erreur enregistrement. Réessayez.' });
    }
    console.warn('[deposit] pending_deposit non mis à jour:', pdErr.message);
  }

  return res.status(200).json({
    ok: true, status: 'pending', amount, operator, txnId,
    message: 'Demande enregistrée. Un administrateur validera votre dépôt sous 24h.',
  });
};
