/**
 * Epargn+ — Client SMS Orange (Guinée) via l'API Orange Developer.
 * Sans dépendance npm (module https natif).
 *
 * Variables d'environnement (Vercel) :
 *   ORANGE_SMS_CLIENT_ID      → "Identifiant du client" (console.developer.orange.com)
 *   ORANGE_SMS_CLIENT_SECRET  → "Secret du client" (NE JAMAIS committer)
 *   ORANGE_SMS_SENDER         → adresse expéditeur, ex. "tel:+224XXXXXXXX"
 *   (optionnel) ORANGE_TOKEN_URL, ORANGE_SMS_BASE  → pour surcharger les endpoints
 *
 * Flux Orange : OAuth client_credentials → POST smsmessaging.
 */
const https = require('https');

const CLIENT_ID     = process.env.ORANGE_SMS_CLIENT_ID;
const CLIENT_SECRET = process.env.ORANGE_SMS_CLIENT_SECRET;
const SENDER_RAW    = process.env.ORANGE_SMS_SENDER || '';
const TOKEN_URL     = process.env.ORANGE_TOKEN_URL || 'https://api.orange.com/oauth/v3/token';
const SMS_BASE      = process.env.ORANGE_SMS_BASE  || 'https://api.orange.com/smsmessaging/v1/outbound';

let _token = null; /* { value, exp } — cache mémoire du jeton OAuth */

function httpRequest(options, bodyStr) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/* Format attendu par Orange : "tel:+224XXXXXXXX" (alphanumérique accepté tel quel) */
function senderAddress() {
  if (!SENDER_RAW) return '';
  if (SENDER_RAW.indexOf('tel:') === 0) return SENDER_RAW;
  /* Si c'est un numéro, on préfixe "tel:" ; sinon (nom court) on laisse tel quel */
  return /^\+?\d[\d\s]*$/.test(SENDER_RAW) ? 'tel:' + SENDER_RAW.replace(/\s/g, '') : SENDER_RAW;
}

function normalizePhone(phone) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.indexOf('+') !== 0) {
    p = p.indexOf('00') === 0 ? '+' + p.slice(2) : '+' + p;
  }
  return p;
}

function smsConfigured() { return !!(CLIENT_ID && CLIENT_SECRET && SENDER_RAW); }

async function getToken() {
  if (_token && _token.exp > Date.now() + 30000) return _token.value;
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('ORANGE_SMS_CLIENT_ID / ORANGE_SMS_CLIENT_SECRET manquants');
  const basic   = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const u       = new URL(TOKEN_URL);
  const bodyStr = 'grant_type=client_credentials';
  const { status, body } = await httpRequest({
    hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
    headers: {
      'Authorization':  'Basic ' + basic,
      'Content-Type':   'application/x-www-form-urlencoded',
      'Accept':         'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  }, bodyStr);
  let json; try { json = JSON.parse(body); } catch { throw new Error('Token Orange : réponse non-JSON'); }
  if (status >= 400 || !json.access_token) {
    throw new Error('Token Orange échec : ' + (json.error_description || json.error || ('HTTP ' + status)));
  }
  const ttl = (Number(json.expires_in) || 3600) * 1000;
  _token = { value: json.access_token, exp: Date.now() + ttl };
  return _token.value;
}

/**
 * Envoie un SMS.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
async function sendSms(toPhone, message) {
  const sender = senderAddress();
  if (!sender) return { ok: false, error: 'ORANGE_SMS_SENDER manquant' };
  try {
    const token = await getToken();
    const url   = SMS_BASE + '/' + encodeURIComponent(sender) + '/requests';
    const u     = new URL(url);
    const payload = JSON.stringify({
      outboundSMSMessageRequest: {
        address:                'tel:' + normalizePhone(toPhone),
        senderAddress:          sender,
        outboundSMSTextMessage: { message: String(message || '') },
      },
    });
    const { status, body } = await httpRequest({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, payload);
    if (status >= 400) {
      let parsed = body; try { parsed = JSON.stringify(JSON.parse(body)); } catch {}
      return { ok: false, error: 'SMS Orange (' + status + ') : ' + String(parsed).slice(0, 200) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendSms, getToken, smsConfigured };
