/**
 * Epargn+ — Client Supabase Storage (module https natif, sans dépendance).
 * Sert à stocker les pièces KYC dans un bucket PRIVÉ (jamais en clair en DB).
 * Utilise la clé service_role (accès complet ; le bucket reste privé pour le public).
 */

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

/** Décode une data-URL base64 → { buffer, contentType }. Null si invalide. */
function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function _request(method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return reject(new Error('SUPABASE_URL/SERVICE_KEY manquants'));
    const base = SUPABASE_URL.replace(/\/$/, '');
    const u = new URL(base + path);
    const h = Object.assign({
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
    }, headers || {});
    if (body) h['Content-Length'] = Buffer.byteLength(body);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers: h }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('Storage ' + res.statusCode + ': ' + raw.slice(0, 200)));
        resolve(raw);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Upload binaire dans bucket/path (upsert). Retourne le path stocké. */
async function uploadObject(bucket, path, buffer, contentType) {
  await _request('POST', '/storage/v1/object/' + bucket + '/' + path, {
    body: buffer,
    headers: { 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
  });
  return bucket + '/' + path;
}

/** URL signée temporaire pour lire un objet privé. `stored` = "bucket/path". */
async function signedUrl(stored, expiresIn = 600) {
  const s = String(stored || '');
  const slash = s.indexOf('/');
  if (slash === -1) return null;
  const bucket = s.slice(0, slash);
  const path = s.slice(slash + 1);
  try {
    const raw = await _request('POST', '/storage/v1/object/sign/' + bucket + '/' + path, {
      body: JSON.stringify({ expiresIn }),
      headers: { 'Content-Type': 'application/json' },
    });
    const json = JSON.parse(raw);
    if (!json.signedURL) return null;
    return SUPABASE_URL.replace(/\/$/, '') + '/storage/v1' + json.signedURL.replace(/^\/?storage\/v1/, '');
  } catch (e) {
    return null;
  }
}

/** Vrai si la valeur est un chemin Storage (et non une data-URL ou http). */
function isStoragePath(v) {
  const s = String(v || '');
  return s.length > 0 && !s.startsWith('data:') && !s.startsWith('http');
}

module.exports = { decodeDataUrl, uploadObject, signedUrl, isStoragePath };
