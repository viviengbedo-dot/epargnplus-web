/**
 * POST /api/transactions/deposit — Epargn+ v3
 * Enregistre une DEMANDE de dépôt (Mobile Money ou Alipay) en attente de validation admin.
 *
 * Corps JSON : { amount, operator, projectId?, note?, senderPhone?, type?, alipay_reference?, proof_url?, currency? }
 *
 * type = 'alipay'   → dépôt Alipay (Chine)
 * type = 'deposit'  → dépôt Mobile Money (défaut)
 */

const { supabaseRequest }   = require('../_lib/supabase');
const { verifyJWT }         = require('../_lib/auth');
const { trigger: emailTrig } = require('../_lib/email');

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

  const body            = await parseBody(req);
  const amount          = parseInt(body.amount, 10);
  const depositType     = (body.type || 'deposit').trim();
  const isAlipay        = depositType === 'alipay';
  const operator        = (body.operator    || (isAlipay ? 'alipay' : 'Mobile Money')).trim();
  const projectId       = body.projectId   || null;
  const note            = body.note        || null;
  const senderPhone     = (body.senderPhone || '').trim() || null;
  const alipayReference = (body.alipay_reference || '').trim() || null;
  const proofUrl        = (body.proof_url  || '').trim() || null;
  const currency        = (body.currency   || 'GNF').trim();

  const minAmount = isAlipay ? 1 : 1000;
  if (!amount || amount < minAmount) {
    return res.status(400).json({ error: 'Montant minimum : ' + minAmount + (isAlipay ? ' CNY' : ' GNF') });
  }

  /* ── Vérification plafond projet + validation contribution type ── */
  if (projectId && !isAlipay) {
    try {
      const projRows = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(projectId) +
        '&select=id,name,goal,actuel,status,contribution_type,min_contribution_amount,nb_membres_cible&limit=1');
      if (Array.isArray(projRows) && projRows[0]) {
        const proj = projRows[0];
        if (proj.status !== 'active') {
          return res.status(400).json({ error: 'Ce projet n\'est plus actif.' });
        }
        /* Marge Epargn+ : 1% intégrés. Le plafond réel = objectif × 1,01
           (le client doit cumuler capital + 1% pour atteindre 100%). */
        const effectiveTarget = Math.round((proj.goal || 0) * 1.01);

        /* Somme des dépôts DÉJÀ en attente de validation sur ce projet.
           On la soustrait du restant : plusieurs demandes peuvent coexister,
           mais leur cumul ne doit pas dépasser l'objectif. */
        let pendingSum = 0;
        try {
          const pendRows = await supabaseRequest('GET',
            '/transactions?project_id=eq.' + encodeURIComponent(projectId) +
            '&type=eq.deposit&statut=eq.pending&select=amount');
          if (Array.isArray(pendRows)) {
            pendingSum = pendRows.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
          }
        } catch (e) {
          console.warn('[deposit] pending sum:', e.message); /* non bloquant */
        }

        const remaining = Math.max(0, effectiveTarget - (proj.actuel || 0) - pendingSum);
        if (remaining === 0) {
          return res.status(400).json({
            error: pendingSum > 0
              ? 'Cet objectif est déjà entièrement couvert par vos dépôts en attente de validation.'
              : 'Cet objectif est déjà atteint.',
            code: 'PROJECT_COMPLETED',
            remaining: 0,
            goal: proj.goal,
            actuel: proj.actuel,
            pending: pendingSum,
          });
        }
        if (amount > remaining) {
          return res.status(400).json({
            error: 'Le montant dépasse le montant restant autorisé pour cet objectif' +
              (pendingSum > 0 ? ' (vos demandes en attente sont déjà comptées)' : '') +
              '. Maximum : ' + remaining.toLocaleString('fr-FR') + ' GNF.',
            code: 'DEPOSIT_EXCEEDS_REMAINING',
            remaining,
            goal: proj.goal,
            actuel: proj.actuel,
            pending: pendingSum,
            requested: amount,
          });
        }

        /* ── Validation selon type de contribution ── */
        if (proj.contribution_type === 'minimal_cap') {
          const minCap = proj.min_contribution_amount || 0;
          if (amount < minCap) {
            return res.status(400).json({
              error: 'Contribution minimale requise: ' + minCap.toLocaleString('fr-FR') + ' GNF',
              code: 'CONTRIBUTION_BELOW_MINIMUM',
              minimum: minCap,
              requested: amount,
            });
          }
        }

        if (proj.contribution_type === 'equal_share') {
          const sharePerPerson = proj.goal / (proj.nb_membres_cible || 1);
          if (amount !== Math.round(sharePerPerson)) {
            return res.status(400).json({
              error: 'Contribution obligatoire: ' + Math.round(sharePerPerson).toLocaleString('fr-FR') + ' GNF par personne',
              code: 'CONTRIBUTION_MUST_EQUAL_SHARE',
              required_amount: Math.round(sharePerPerson),
              requested: amount,
            });
          }
        }
      }
    } catch (capErr) {
      console.warn('[deposit] project cap check:', capErr.message);
      /* Non bloquant si la vérification échoue */
    }
  }

  let user;
  try {
    const rows = await supabaseRequest('GET',
      '/users?id=eq.' + encodeURIComponent(jwtPayload.userId) + '&select=id,phone,prenom,country,currency,email');
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    user = rows[0];
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }

  const now    = new Date().toISOString();
  const prefix = isAlipay ? 'ALI' : 'DEP';
  const ref    = prefix + '-' + now.slice(0,10).replace(/-/g,'') + '-' +
    Math.random().toString(36).substr(2,6).toUpperCase();
  const txnType = isAlipay ? 'depot_alipay' : 'deposit';
  /* Info expéditeur intégrée au label (colonnes note/sender_phone parfois absentes en prod) */
  const senderInfo = senderPhone ? ' · de ' + senderPhone : (alipayReference ? ' · Réf ' + alipayReference : '');
  const label   = ref + ' · ' + (isAlipay ? 'Dépôt Alipay' : 'Dépôt ' + operator) + senderInfo;

  let txnId = null;

  /* ── 1. Écriture transaction ── */
  try {
    const txnBody = {
      user_id:    jwtPayload.userId,
      type:       txnType,
      amount,
      operator,
      is_credit:  true,
      label,
      project_id: projectId,
      statut:     'pending',
      status:     'pending',
      currency,
      ...(alipayReference ? { reference: alipayReference } : {}),
      ...(proofUrl        ? { proof_url: proofUrl }        : {}),
    };

    const txnRows = await supabaseRequest('POST', '/transactions', txnBody);
    const created = Array.isArray(txnRows) ? txnRows[0] : txnRows;
    if (created) txnId = created.id;
    console.log('[deposit] txn=' + txnId + ' type=' + txnType + ' user=' + jwtPayload.userId + ' amount=' + amount);
  } catch (txnErr) {
    console.warn('[deposit] transactions table:', txnErr.message);
  }

  /* ── 2. pending_deposit (rétrocompat) ── */
  const pendingData = JSON.stringify({
    amount, operator, requestedAt: now, txnId, projectId, senderPhone,
    type: txnType, alipayReference, currency,
  });
  try {
    await supabaseRequest('PATCH',
      '/users?id=eq.' + encodeURIComponent(jwtPayload.userId),
      { pending_deposit: pendingData, updated_at: now });
  } catch (pdErr) {
    if (!txnId) {
      return res.status(500).json({ error: 'Erreur enregistrement. Réessayez.' });
    }
    console.warn('[deposit] pending_deposit:', pdErr.message);
  }

  /* ── Email confirmation dépôt ── */
  if (user.email) {
    const cur = user.currency || currency || 'GNF';
    emailTrig('deposit_confirmed', user.id, {
      prenom:    user.prenom || '',
      montant:   amount.toLocaleString('fr-FR') + ' ' + cur,
      operateur: operator,
      reference: ref,
      date:      new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }),
    }, user.email).catch(() => {});
  }

  const msg = isAlipay
    ? 'Demande Alipay enregistrée. Un administrateur validera votre dépôt sous 24-48h.'
    : 'Demande enregistrée. Un administrateur validera votre dépôt sous 24h.';

  return res.status(200).json({
    ok: true, status: 'pending', amount, operator, txnId, ref, currency, message: msg,
  });
};
