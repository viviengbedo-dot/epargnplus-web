/**
 * POST /api/kyc/callback — Webhook Smile ID
 *
 * Smile ID appelle ce endpoint (PUBLIC, pas d'auth JWT) après une vérification
 * d'identité (Smile Links / Document Verification). On vérifie la signature
 * Smile, on interprète le résultat, et on met à jour users.kyc_status.
 *
 * Variables d'environnement requises (à définir dans Vercel) :
 *   SMILE_PARTNER_ID  — votre Partner ID Smile (ex. "1234")
 *   SMILE_API_KEY     — votre clé API Smile (pour vérifier la signature)
 *
 * Le user_id de l'app DOIT être passé à Smile via partner_params.user_id
 * (fait côté frontend en ouvrant le Smile Link avec ?user_id=...).
 */

const crypto = require('crypto');
const { supabaseRequest } = require('../_lib/supabase');

const SMILE_PARTNER_ID = process.env.SMILE_PARTNER_ID || '';
const SMILE_API_KEY     = process.env.SMILE_API_KEY     || '';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* Signature Smile ID : base64(HMAC_SHA256(timestamp + partner_id + "sid_request", api_key)) */
function expectedSignature(timestamp) {
  return crypto.createHmac('sha256', SMILE_API_KEY)
    .update(String(timestamp), 'utf8')
    .update(String(SMILE_PARTNER_ID), 'utf8')
    .update('sid_request', 'utf8')
    .digest('base64');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

/* Interprète le résultat Smile → 'verified' | 'rejected' | 'pending'
   Document Verification : Actions.Verify_ID_Number / Selfie_To_ID_Card_Compare,
   et ResultCode global. On reste conservateur : approuvé seulement si tout est OK. */
function interpretResult(body) {
  const actions = body.Actions || body.actions || {};
  const idOk    = /verified|provisional|passed/i.test(String(actions.Verify_ID_Number || ''));
  const faceOk  = /completed|passed|match/i.test(String(actions.Selfie_To_ID_Card_Compare || actions.Human_Review_Compare || ''));
  const liveOk  = !actions.Liveness_Check || /passed|completed/i.test(String(actions.Liveness_Check));
  const code    = String(body.ResultCode || body.result_code || '');

  /* Codes Smile "succès" courants pour Document Verification */
  const successCodes = ['0810', '1020', '1012'];
  if (successCodes.includes(code) || (idOk && faceOk && liveOk)) return 'verified';

  /* Codes "en revue humaine / en attente" */
  const pendingCodes = ['0811', '0812', '1013'];
  if (pendingCodes.includes(code)) return 'pending';

  return 'rejected';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  if (!SMILE_PARTNER_ID || !SMILE_API_KEY) {
    console.warn('[kyc/callback] SMILE_PARTNER_ID / SMILE_API_KEY non configurés');
    return res.status(503).json({ error: 'KYC provider non configuré' });
  }

  try {
    const body = await parseBody(req);

    /* 1. Vérifier la signature Smile */
    const ts  = body.timestamp || body.Timestamp;
    const sig = body.signature || body.Signature;
    if (!ts || !sig || !safeEqual(sig, expectedSignature(ts))) {
      console.warn('[kyc/callback] signature invalide');
      return res.status(401).json({ error: 'Signature invalide' });
    }

    /* 2. Retrouver le user_id (passé via partner_params) */
    const pp = body.PartnerParams || body.partner_params || {};
    const userId = pp.user_id || pp.userId || body.user_id;
    if (!userId) {
      console.warn('[kyc/callback] user_id manquant');
      return res.status(400).json({ error: 'user_id manquant' });
    }

    /* 3. Interpréter et mettre à jour le statut */
    const status = interpretResult(body);
    const patch = {
      kyc_status: status === 'verified' ? 'verified' : (status === 'pending' ? 'pending' : 'rejected'),
      kyc_submitted_at: new Date().toISOString(),
    };
    if (status === 'rejected') {
      patch.kyc_rejection_reason = String(body.ResultText || body.result_text || 'Vérification non concluante');
    }

    await supabaseRequest('PATCH',
      '/users?id=eq.' + encodeURIComponent(userId), patch);

    /* 4. Notifier l'utilisateur */
    try {
      const titles = {
        verified: '✅ Identité vérifiée',
        pending:  '⏳ Vérification en cours',
        rejected: '❌ Vérification refusée',
      };
      await supabaseRequest('POST', '/notifications', {
        user_id: userId, type: 'system', title: titles[status] || 'KYC',
        body: status === 'verified'
          ? 'Votre identité a été vérifiée. Tous les plafonds sont débloqués.'
          : status === 'rejected'
            ? 'Votre vérification n\'a pas abouti. ' + (patch.kyc_rejection_reason || '')
            : 'Votre dossier est en cours d\'examen.',
        read: false, created_at: new Date().toISOString(),
      });
    } catch (e) {}

    console.log('[kyc/callback] user=' + userId + ' status=' + status);
    return res.status(200).json({ ok: true, status });
  } catch (e) {
    console.error('[kyc/callback] error:', e.message);
    return res.status(500).json({ error: 'Erreur traitement KYC : ' + e.message });
  }
};
