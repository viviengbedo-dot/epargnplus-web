/**
 * /api/otp/verify — Epargn+
 * Vérifie le code OTP saisi par l'utilisateur contre le token signé.
 * Stateless : aucune base de données requise.
 *
 * Variables d'environnement :
 *   OTP_SECRET → même secret que send.js
 */

const crypto     = require('crypto');
const OTP_SECRET = process.env.OTP_SECRET || 'epargn-otp-dev-secret-change-me';
const OTP_TTL_MS = 120_000;

function signOTP(otp, phone, ts) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${otp}:${phone}:${ts}`)
    .digest('hex');
}

function safeEqual(a, b) {
  // timingSafeEqual exige même longueur
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { phone, code, token } = await parseBody(req);
  if (!phone || !code || !token) {
    return res.status(400).json({ error: 'Missing params: phone, code, token' });
  }

  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return res.status(400).json({ error: 'Invalid token format' });

  const ts  = parseInt(token.slice(0, dotIdx), 10);
  const sig = token.slice(dotIdx + 1);

  if (isNaN(ts)) return res.status(400).json({ error: 'Invalid token' });

  // Vérification expiry
  if (Date.now() - ts > OTP_TTL_MS) {
    return res.status(400).json({ error: 'expired', message: 'Code OTP expiré — veuillez en demander un nouveau.' });
  }

  // Vérification HMAC
  const expected = signOTP(code, phone, ts);
  if (!safeEqual(expected, sig)) {
    return res.status(400).json({ error: 'invalid', message: 'Code incorrect.' });
  }

  return res.status(200).json({ valid: true });
};
