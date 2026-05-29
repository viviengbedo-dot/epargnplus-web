/**
 * Epargn+ — Client HTTP Supabase (sans dépendance npm)
 * Utilise le module https natif de Node.js
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL         → https://<project>.supabase.co
 *   SUPABASE_SERVICE_KEY → clé "service_role" (Settings → API)
 */

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Effectue une requête REST vers Supabase.
 * @param {string} method  - GET | POST | PATCH | DELETE
 * @param {string} path    - ex. '/users?phone=eq.620000000&select=*'
 * @param {object} [body]  - corps JSON (POST / PATCH)
 * @returns {Promise<any>} - tableau ou objet JSON retourné
 */
function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return reject(new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis'));
    }

    const base  = SUPABASE_URL.replace(/\/$/, '');
    const urlObj = new URL(base + '/rest/v1' + path);
    const data  = body ? JSON.stringify(body) : null;

    const headers = {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
    };
    if (method === 'POST' || method === 'PATCH') {
      headers['Prefer'] = 'return=representation';
    }
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(
      {
        hostname: urlObj.hostname,
        path:     urlObj.pathname + urlObj.search,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (!raw.trim()) { resolve([]); return; }
          let json;
          try { json = JSON.parse(raw); } catch {
            return reject(new Error('Réponse Supabase non-JSON : ' + raw.slice(0, 200)));
          }
          if (res.statusCode >= 400) {
            const msg = json.message || json.error || json.hint || ('HTTP ' + res.statusCode);
            return reject(new Error(msg));
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = { supabaseRequest };
