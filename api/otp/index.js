/**
 * /api/otp — Epargn+
 * Gère l'envoi ET la vérification OTP en un seul endpoint.
 *
 * POST /api/otp?action=send   — envoie un OTP par email
 * POST /api/otp?action=verify — vérifie un OTP
 * (les anciens /api/otp/send et /api/otp/verify sont redirigés via vercel.json)
 */

const https  = require('https');
const crypto = require('crypto');
const { supabaseRequest } = require('../_lib/supabase');
const { sendEmail, otpEmailHtml } = require('../_lib/email');

const OTP_SECRET    = process.env.OTP_SECRET || 'epargn-otp-dev-secret-change-me';
const OTP_TTL_MS    = 10 * 60 * 1000; // 10 minutes
const MAX_RESEND    = 3;               // max renvois par heure
const RESEND_WINDOW = 60 * 60 * 1000; // 1 heure

/* Compteur en mémoire : { phone → [timestamp, ...] } */
const _resendLog = new Map();

function generateOTP()              { return Math.floor(100000 + Math.random() * 900000).toString(); }
function signOTP(otp, phone, ts)    { return crypto.createHmac('sha256', OTP_SECRET).update(`${otp}:${phone}:${ts}`).digest('hex'); }
function safeEqual(a, b)            { if (a.length !== b.length) return false; return crypto.timingSafeEqual(Buffer.from(a,'hex'), Buffer.from(b,'hex')); }

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* ── ACTION DÉTERMINÉE PAR L'URL ou body.action ── */
function getAction(req) {
  const url = req.url || '';
  if (url.includes('/send') || url.includes('action=send'))   return 'send';
  if (url.includes('/verify') || url.includes('action=verify')) return 'verify';
  const qs = url.split('?')[1] || '';
  const params = new URLSearchParams(qs);
  return params.get('action') || 'send';
}

/* ══════════════ HANDLER ══════════════ */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  const body   = await parseBody(req);
  const action = getAction(req) || body.action || 'send';

  /* ════ VERIFY ════ */
  if (action === 'verify') {
    const { phone, code, token } = body;
    if (!phone || !code || !token) return res.status(400).json({ error: 'Missing params: phone, code, token' });

    const dotIdx = token.indexOf('.');
    if (dotIdx === -1) return res.status(400).json({ error: 'Invalid token format' });

    const ts  = parseInt(token.slice(0, dotIdx), 10);
    const sig = token.slice(dotIdx + 1);
    if (isNaN(ts)) return res.status(400).json({ error: 'Invalid token' });

    if (Date.now() - ts > OTP_TTL_MS) {
      return res.status(400).json({ error: 'expired', message: 'Code OTP expiré — veuillez en demander un nouveau.' });
    }
    const expected = signOTP(code, phone, ts);
    if (!safeEqual(expected, sig)) {
      return res.status(400).json({ error: 'invalid', message: 'Code incorrect.' });
    }
    return res.status(200).json({ valid: true });
  }

  /* ════ SEND (défaut) ════ */
  const phone   = (body.phone  || '').trim();
  const email   = (body.email  || '').trim().toLowerCase();
  const prenom  = (body.prenom || '').trim();
  const purpose = body.purpose || 'register';

  if (!phone) return res.status(400).json({ error: 'phone requis' });

  /* ── Rate limiting : max 3 renvois / heure par numéro ── */
  const now = Date.now();
  const key = phone;
  const history = (_resendLog.get(key) || []).filter(t => now - t < RESEND_WINDOW);
  if (history.length >= MAX_RESEND) {
    const retryAfterMin = Math.ceil((RESEND_WINDOW - (now - history[0])) / 60000);
    return res.status(429).json({
      error: `Trop de demandes. Réessayez dans ${retryAfterMin} minute${retryAfterMin > 1 ? 's' : ''}.`,
      retry_after_min: retryAfterMin,
    });
  }
  _resendLog.set(key, [...history, now]);

  /* Vérification existence selon le but */
  if (purpose === 'register') {
    try {
      const rows = await supabaseRequest('GET', '/users?phone=eq.' + encodeURIComponent(phone) + '&select=id');
      if (Array.isArray(rows) && rows.length > 0) {
        return res.status(409).json({ error: 'Ce numéro est déjà enregistré. Connectez-vous.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  } else if (purpose === 'reset') {
    try {
      const rows = await supabaseRequest('GET', '/users?phone=eq.' + encodeURIComponent(phone) + '&select=id,prenom,email');
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ error: 'Aucun compte trouvé pour ce numéro.' });
      }
      if (!email && rows[0].email) body._emailFromDb = rows[0].email;
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  const otp         = generateOTP();
  const ts          = Date.now();
  const token       = `${ts}.${signOTP(otp, phone, ts)}`;
  const hasResend   = !!process.env.RESEND_API_KEY;
  const targetEmail = email || body._emailFromDb || null;
  const demo        = !hasResend;

  if (!targetEmail) {
    return res.status(400).json({ error: 'Entrez votre adresse email pour recevoir le code.' });
  }

  if (!demo) {
    const emailResult = await sendEmail({
      to:      targetEmail,
      subject: `${otp} — Votre code Epargn+`,
      html:    otpEmailHtml(otp, prenom),
    });
    if (!emailResult.ok) {
      return res.status(502).json({ error: emailResult.error || "Envoi email échoué. Vérifiez l'adresse." });
    }
  } else {
    console.log(`[DEMO OTP] phone=${phone} email=${targetEmail} code=${otp} purpose=${purpose}`);
  }

  return res.status(200).json({
    token,
    expires:      ts + OTP_TTL_MS,
    ttl_ms:       OTP_TTL_MS,
    resends_left: MAX_RESEND - history.length - 1,
    demo,
    emailSent: !!(targetEmail && hasResend),
    channel:   'email',
  });
};
