/**
 * POST /api/kyc/verify — Epargn+
 * Endpoint unifié pour les vérifications KYC admin.
 *
 * Headers : Authorization: Bearer <ADMIN_SECRET>
 * Corps   : { action, ...params }
 *
 * Actions disponibles :
 *   action: 'aml'
 *     { userId, firstName, lastName }
 *     → OpenSanctions (ONU · OFAC · UE · BCEAO · Interpol)
 *
 *   action: 'id'
 *     { userId, country, idType, idNumber, firstName, lastName, dob? }
 *     → Smile Identity (Guinée, CI, Bénin, Sénégal…)
 *
 * Variables d'environnement :
 *   OPENSANCTIONS_API_KEY  (optionnel — accès étendu)
 *   SMILE_PARTNER_ID       (requis pour action:'id')
 *   SMILE_API_KEY          (requis pour action:'id')
 *   SMILE_SANDBOX          ('true' = mode test, défaut: true)
 */

const https  = require('https');
const crypto = require('crypto');
const { supabaseRequest } = require('../_lib/supabase');

const ADMIN_SECRET      = process.env.ADMIN_SECRET      || 'epargn-admin-dev-2026';
const OPENSANCTIONS_KEY = process.env.OPENSANCTIONS_API_KEY || '';
const SMILE_PARTNER     = process.env.SMILE_PARTNER_ID  || '';
const SMILE_KEY         = process.env.SMILE_API_KEY     || '';
const SMILE_SANDBOX     = (process.env.SMILE_SANDBOX || 'true') !== 'false';
const SMILE_HOST        = SMILE_SANDBOX ? 'testapi.smileidentity.com' : 'api.smileidentity.com';

const VALID_IDS = {
  GN: ['NATIONAL_ID','VOTER_ID','PASSPORT','DRIVERS_LICENSE'],
  CI: ['NATIONAL_ID','VOTER_ID','PASSPORT','DRIVERS_LICENSE','SSNIT'],
  BJ: ['NATIONAL_ID','VOTER_ID','PASSPORT'],
  SN: ['NATIONAL_ID','VOTER_ID','PASSPORT'],
  GH: ['NATIONAL_ID','VOTER_ID','PASSPORT','SSNIT','DRIVERS_LICENSE'],
};

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* ─── OpenSanctions ─── */
function queryOpenSanctions(fullName) {
  return new Promise((resolve, reject) => {
    const q = encodeURIComponent(fullName.trim());
    const headers = { 'Accept': 'application/json', 'User-Agent': 'EpargnPlus/1.0' };
    if (OPENSANCTIONS_KEY) headers['Authorization'] = 'ApiKey ' + OPENSANCTIONS_KEY;
    const options = {
      method: 'GET', hostname: 'api.opensanctions.org',
      path: '/search/default?q=' + q + '&schema=Person&limit=10&fuzzy=true', headers,
    };
    const req = https.request(options, (r) => {
      let body = '';
      r.on('data', (c) => { body += c; });
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('OpenSanctions: ' + body.slice(0,200))); } });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout OpenSanctions')); });
    req.end();
  });
}

function computeRiskScore(results, lastName) {
  if (!results || !results.results || results.results.length === 0) return 0;
  let score = 0;
  const lName = lastName.toLowerCase();
  for (const r of results.results) {
    const ms = Math.round((r.score || 0) * 100);
    const names = (r.properties && r.properties.name) || [];
    if (names.some(n => n.toLowerCase().includes(lName))) score = Math.max(score, ms);
  }
  return score;
}

/* ─── Smile Identity ─── */
function generateSmileSignature(partnerId, apiKey, timestamp) {
  return crypto.createHmac('sha256', apiKey).update(partnerId + ':' + timestamp).digest('base64');
}

function callSmileIdentity(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      method: 'POST', hostname: SMILE_HOST, path: '/v1/id_verification',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (r) => {
      let resp = '';
      r.on('data', (c) => { resp += c; });
      r.on('end', () => { try { resolve({ status: r.statusCode, data: JSON.parse(resp) }); } catch { reject(new Error('Réponse Smile invalide')); } });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout Smile Identity')); });
    req.write(body);
    req.end();
  });
}

/* ─── Handler principal ─── */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST uniquement' });

  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  const body   = await parseBody(req);
  const action = body.action || '';

  /* ════════ ACTION AML ════════ */
  if (action === 'aml') {
    const { userId, firstName, lastName } = body;
    if (!userId || !firstName || !lastName) {
      return res.status(400).json({ error: 'userId, firstName et lastName requis' });
    }
    const fullName  = (firstName + ' ' + lastName).trim();
    const checkedAt = new Date().toISOString();
    try {
      const sanctions = await queryOpenSanctions(fullName);
      const riskScore = computeRiskScore(sanctions, lastName);
      const amlStatus = riskScore >= 60 ? 'flagged' : 'clear';
      const matches   = (sanctions.results || []).slice(0,5).map(r => ({
        name:      ((r.properties && r.properties.name) || [r.caption || '']).join(', '),
        score:     Math.round((r.score || 0) * 100),
        datasets:  (r.datasets || []).join(', '),
        topics:    (r.properties && r.properties.topics) || [],
      }));
      try {
        await supabaseRequest('PATCH',
          '/users?id=eq.' + encodeURIComponent(userId),
          { aml_status: amlStatus, aml_checked_at: checkedAt, risk_score: riskScore, updated_at: checkedAt });
      } catch (dbErr) {
        console.warn('[verify/aml] DB :', dbErr.message);
      }
      console.log('[verify/aml] ' + fullName + ' → ' + amlStatus + ' score=' + riskScore);
      return res.status(200).json({
        ok: true, userId, fullName, amlStatus, riskScore, matches, checkedAt,
        source: 'OpenSanctions (ONU · OFAC · UE · BCEAO · Interpol)',
      });
    } catch (err) {
      console.error('[verify/aml] Erreur :', err.message);
      return res.status(200).json({ ok: false, userId, amlStatus: 'error', riskScore: -1, matches: [], error: err.message, checkedAt });
    }
  }

  /* ════════ ACTION ID (Smile Identity) ════════ */
  if (action === 'id') {
    if (!SMILE_PARTNER || !SMILE_KEY) {
      return res.status(503).json({
        error: 'Smile Identity non configuré. Ajoutez SMILE_PARTNER_ID et SMILE_API_KEY dans Vercel.',
        setup: 'https://portal.smileidentity.com → API Keys',
      });
    }
    const { userId, country, idType, idNumber, firstName, lastName, dob } = body;
    if (!userId || !country || !idType || !idNumber || !firstName || !lastName) {
      return res.status(400).json({ error: 'userId, country, idType, idNumber, firstName, lastName requis' });
    }
    const countryUpper = country.toUpperCase();
    const idTypeUpper  = idType.toUpperCase();
    const validTypes   = VALID_IDS[countryUpper] || VALID_IDS.GN;
    if (!validTypes.includes(idTypeUpper)) {
      return res.status(400).json({ error: 'Type ID invalide pour ' + countryUpper, validTypes });
    }
    const timestamp = new Date().toISOString();
    const signature = generateSmileSignature(SMILE_PARTNER, SMILE_KEY, timestamp);
    const smilePayload = {
      partner_id: SMILE_PARTNER, timestamp, signature,
      country: countryUpper, id_type: idTypeUpper,
      id_number: idNumber.replace(/[\s\-]/g, '').toUpperCase(),
      first_name: firstName.trim(), last_name: lastName.trim(),
      ...(dob ? { dob } : {}),
    };
    try {
      const smileResult = await callSmileIdentity(smilePayload);
      const data        = smileResult.data || {};
      const resultCode  = String(data.ResultCode || data.result_code || '');
      const isVerified  = ['1012','1010'].includes(resultCode);
      const isNotFound  = resultCode === '1011';
      const newKyc      = isVerified ? 'verified' : (isNotFound ? 'rejected' : 'pending');
      try {
        const patch = { kyc_status: newKyc, updated_at: timestamp };
        if (isVerified) patch.kyc_verified_at = timestamp;
        await supabaseRequest('PATCH', '/users?id=eq.' + encodeURIComponent(userId), patch);
      } catch (dbErr) { console.warn('[verify/id] DB :', dbErr.message); }
      console.log('[verify/id] userId=' + userId + ' code=' + resultCode + ' → ' + newKyc);
      return res.status(200).json({
        ok: true, userId,
        verificationResult: {
          resultCode, resultText: data.ResultText || data.result_text || '',
          isVerified, isNotFound, confidence: data.ConfidenceValue || 0,
        },
        updatedKycStatus: newKyc, sandbox: SMILE_SANDBOX, timestamp,
      });
    } catch (err) {
      console.error('[verify/id] Erreur :', err.message);
      return res.status(500).json({ error: 'Erreur Smile Identity : ' + err.message });
    }
  }

  return res.status(400).json({ error: "action doit être 'aml' ou 'id'" });
};
