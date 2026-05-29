/**
 * POST /api/kyc/submit — Epargn+
 * Endpoint unifié KYC client.
 *
 * Header requis : Authorization: Bearer <jwt>
 *
 * Actions :
 *   action: 'upload'   { type:'document'|'selfie', imageBase64, mimeType? }
 *     → Upload vers Supabase Storage, retourne { ok, url }
 *
 *   action: 'submit' (ou aucun action)
 *     { documentUrl?, selfieUrl?, docNumber?, docType? }
 *     → Marque le KYC 'pending' en DB avec les URLs si fournies
 *
 * Variables d'environnement :
 *   SUPABASE_URL         — pour l'upload Storage
 *   SUPABASE_SERVICE_KEY — pour l'upload Storage
 */

const https = require('https');
const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT }       = require('../_lib/auth');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET       = 'kyc-documents';

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

/* ─── Upload vers Supabase Storage ─── */
function uploadToStorage(path, buffer, mimeType) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return reject(new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY manquants'));
    }
    const base   = SUPABASE_URL.replace(/\/$/, '');
    const urlObj = new URL(base + '/storage/v1/object/' + BUCKET + '/' + path);
    const options = {
      method: 'PUT', hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type':   mimeType || 'image/jpeg',
        'apikey':         SUPABASE_KEY,
        'Authorization':  'Bearer ' + SUPABASE_KEY,
        'Content-Length': buffer.length,
        'x-upsert':       'true',
      },
    };
    const req = https.request(options, (r) => {
      let body = '';
      r.on('data', (c) => { body += c; });
      r.on('end', () => {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          resolve({ url: base + '/storage/v1/object/public/' + BUCKET + '/' + path });
        } else {
          reject(new Error('Storage ' + r.statusCode + ' — ' + body));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

/* ═══════════════════════════════════════════ */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST uniquement' });

  /* Auth JWT */
  const rawToken = extractToken(req);
  if (!rawToken) return res.status(401).json({ error: 'Non authentifié' });
  const payload = verifyJWT(rawToken);
  if (!payload)  return res.status(401).json({ error: 'Session expirée — reconnectez-vous' });

  const body   = await parseBody(req);
  const action = body.action || 'submit';

  /* ════════ ACTION UPLOAD ════════ */
  if (action === 'upload') {
    const { type, imageBase64, mimeType } = body;
    if (!type || !imageBase64) {
      return res.status(400).json({ error: 'type et imageBase64 requis' });
    }
    if (type !== 'document' && type !== 'selfie') {
      return res.status(400).json({ error: "type doit être 'document' ou 'selfie'" });
    }
    let buffer;
    try {
      const b64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(b64, 'base64');
    } catch (e) {
      return res.status(400).json({ error: 'imageBase64 invalide' });
    }
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Fichier trop volumineux (max 8 Mo)' });
    }
    const storagePath = payload.userId + '/' + type + '.jpg';
    const mime        = (mimeType || 'image/jpeg').split(';')[0].trim();
    try {
      const result = await uploadToStorage(storagePath, buffer, mime);
      console.log('[kyc/submit/upload] userId=' + payload.userId + ' type=' + type + ' → ' + result.url);
      return res.status(200).json({ ok: true, url: result.url });
    } catch (err) {
      console.error('[kyc/submit/upload] Erreur :', err.message);
      return res.status(500).json({ error: 'Erreur upload : ' + err.message });
    }
  }

  /* ════════ ACTION SUBMIT ════════ */
  const documentUrl = body.documentUrl || null;
  const selfieUrl   = body.selfieUrl   || null;
  const docNumber   = body.docNumber   || null;
  const docType     = body.docType     || 'CNI';

  try {
    const rows = await supabaseRequest(
      'GET',
      '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=id,kyc_status'
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    if (rows[0].kyc_status === 'verified') {
      return res.status(200).json({ ok: true, kyc_status: 'verified', message: 'KYC déjà vérifié' });
    }

    const patch = { kyc_status: 'pending', updated_at: new Date().toISOString() };
    const extPatch = Object.assign({}, patch, {
      kyc_submitted_at: new Date().toISOString(),
      kyc_document_url: documentUrl,
      kyc_selfie_url:   selfieUrl,
      kyc_doc_number:   docNumber,
      kyc_doc_type:     docType,
    });

    try {
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(payload.userId), extPatch);
    } catch (extErr) {
      /* Fallback si colonnes étendues absentes */
      console.warn('[kyc/submit] Colonnes KYC v2 absentes — migration SQL requise');
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(payload.userId), patch);
    }

    console.log('[kyc/submit] userId=' + payload.userId +
      ' doc=' + (documentUrl ? '✓' : '—') + ' selfie=' + (selfieUrl ? '✓' : '—') + ' → pending');
    return res.status(200).json({ ok: true, kyc_status: 'pending' });

  } catch (err) {
    console.error('[kyc/submit] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
