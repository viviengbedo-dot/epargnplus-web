/**
 * POST /api/kyc/verify — Epargn+
 * Vérifications KYC/AML déclenchées par l'admin.
 *
 *   action = 'aml' → screening sanctions/PEP via OpenSanctions (api.opensanctions.org)
 *                    Nécessite la variable d'env OPENSANCTIONS_API_KEY
 *                    (clé gratuite sur opensanctions.org → à ajouter dans Vercel).
 *   action = 'id'  → vérification de pièce via Smile Identity (non configuré :
 *                    nécessite un compte + clés Smile). Renvoie un message clair.
 *
 * Auth : Bearer ADMIN_SECRET (même secret que /api/admin/*).
 */

const https = require('https');
const { supabaseRequest } = require('../_lib/supabase');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026';
const OS_KEY       = process.env.OPENSANCTIONS_API_KEY || '';
const OS_MATCH_THRESHOLD = 0.70;   /* score ≥ 70 % = correspondance retenue */

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* Appel OpenSanctions /match/default — matching d'entité "Person" par nom. */
function opensanctionsMatch(fullName) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      queries: { q1: { schema: 'Person', properties: { name: [fullName] } } },
    });
    const req = https.request({
      hostname: 'api.opensanctions.org',
      path: '/match/default',
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'ApiKey ' + OS_KEY,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) return reject(new Error('AUTH'));
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Réponse non-JSON')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (token !== ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  const body   = await parseBody(req);
  const action = body.action;

  /* ── Vérification de pièce (Smile Identity) — non configuré ── */
  if (action === 'id') {
    return res.status(200).json({
      ok: false,
      error: 'Vérification d\'identité (Smile Identity) non configurée.',
      setup: 'Nécessite un compte Smile Identity + clés API. Utilisez la validation KYC manuelle en attendant.',
    });
  }

  /* ── Screening AML via OpenSanctions ── */
  if (action === 'aml') {
    const fullName = ((body.firstName || '') + ' ' + (body.lastName || '')).trim();
    if (!fullName) return res.status(400).json({ error: 'Prénom et nom requis' });

    if (!OS_KEY) {
      return res.status(200).json({
        ok: false,
        error: 'Clé API OpenSanctions manquante.',
        setup: 'Créez une clé (gratuite en évaluation) sur opensanctions.org, puis ajoutez la variable OPENSANCTIONS_API_KEY dans les paramètres Vercel du projet.',
      });
    }

    try {
      const data    = await opensanctionsMatch(fullName);
      const results = (data && data.responses && data.responses.q1 && data.responses.q1.results) || [];
      const matches = results
        .filter((r) => (r.score || 0) >= OS_MATCH_THRESHOLD)
        .map((r) => ({
          name:     r.caption || '(inconnu)',
          score:    Math.round((r.score || 0) * 100),
          datasets: (r.datasets || []).slice(0, 4).join(', '),
          schema:   r.schema || '',
        }));
      const flagged   = matches.length > 0;
      const topScore  = results.length ? Math.round((results[0].score || 0) * 100) : 0;
      const riskScore = flagged ? matches[0].score : topScore;
      const amlStatus = flagged ? 'flagged' : 'clear';

      /* Journaliser le résultat sur le compte (best-effort). */
      if (body.userId) {
        try {
          await supabaseRequest('PATCH', '/users?id=eq.' + encodeURIComponent(body.userId),
            { aml_status: amlStatus, risk_score: riskScore, updated_at: new Date().toISOString() });
        } catch (e) { /* colonnes optionnelles */ }
      }

      return res.status(200).json({
        ok: true, amlStatus, fullName, riskScore,
        source: 'OpenSanctions', matches,
      });
    } catch (e) {
      if (e.message === 'AUTH') {
        return res.status(200).json({
          ok: false,
          error: 'Clé OpenSanctions invalide ou expirée.',
          setup: 'Vérifiez la valeur de OPENSANCTIONS_API_KEY dans Vercel.',
        });
      }
      return res.status(200).json({ ok: false, error: 'OpenSanctions indisponible : ' + e.message });
    }
  }

  return res.status(400).json({ error: 'action inconnue (aml | id)' });
};
