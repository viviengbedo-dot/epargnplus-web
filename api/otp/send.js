/**
 * /api/otp/send — Epargn+
 * Canal unique : Email via Resend (tous pays).
 * L'envoi SMS a été supprimé — seul le canal email est utilisé.
 */

const https  = require('https');
const crypto = require('crypto');
const { supabaseRequest } = require('../_lib/supabase');
const { sendEmail, otpEmailHtml } = require('../_lib/email');

const OTP_SECRET       = process.env.OTP_SECRET       || 'epargn-otp-dev-secret-change-me';
const INFOBIP_API_KEY  = process.env.INFOBIP_API_KEY;
const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL;
const INFOBIP_FROM     = process.env.INFOBIP_FROM;
const AT_API_KEY       = process.env.AT_API_KEY;
const AT_USERNAME      = process.env.AT_USERNAME;
const AT_SENDER_ID     = process.env.AT_SENDER_ID;
const OTP_TTL_MS       = 5 * 60 * 1000;

function detectCountry(phone) {
  if (phone.startsWith('+224')) return 'gn';
  if (phone.startsWith('+229')) return 'bj';
  if (phone.startsWith('+225')) return 'ci';
  return 'other';
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signOTP(otp, phone, ts) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${otp}:${phone}:${ts}`)
    .digest('hex');
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* ══ INFOBIP ══ */
function infobipSend(to, text, withFrom) {
  const body = { to, text };
  if (withFrom && INFOBIP_FROM) body.from = INFOBIP_FROM;
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: INFOBIP_BASE_URL,
      path:     '/sms/1/text/single',
      method:   'POST',
      headers:  {
        'Authorization':  `App ${INFOBIP_API_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Accept':         'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ statusCode: res.statusCode, raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendViaInfobip(to, text) {
  const r1      = await infobipSend(to, text, true);
  const msg1    = r1.body?.messages?.[0] || r1.body;
  const groupId = msg1?.status?.groupId;
  const statusD = msg1?.status?.description || '—';
  const msgId   = msg1?.messageId || '—';
  console.log(`[otp/send] infobip attempt1 to=${to} httpStatus=${r1.statusCode} groupId=${groupId} status="${statusD}"`);
  if (groupId === 5 && INFOBIP_FROM) {
    const r2   = await infobipSend(to, text, false);
    const msg2 = r2.body?.messages?.[0] || r2.body;
    const gid2 = msg2?.status?.groupId;
    const sta2 = msg2?.status?.description || '—';
    console.log(`[otp/send] infobip attempt2 to=${to} httpStatus=${r2.statusCode} groupId=${gid2} status="${sta2}"`);
    if (r2.statusCode >= 400) return { ok: false, error: 'Infobip HTTP ' + r2.statusCode };
    if (gid2 === 5 || gid2 === 6 || gid2 === 2) return { ok: false, error: 'SMS rejeté : ' + sta2 };
    return { ok: true, provider: 'infobip' };
  }
  if (r1.statusCode >= 400) return { ok: false, error: 'Infobip HTTP ' + r1.statusCode };
  if (groupId === 6 || groupId === 2) return { ok: false, error: 'SMS non livrable : ' + statusD };
  return { ok: true, provider: 'infobip' };
}

/* ══ AFRICA'S TALKING ══ */
async function sendViaAT(to, text) {
  const params = new URLSearchParams();
  params.set('username', AT_USERNAME);
  params.set('to', to);
  params.set('message', text);
  if (AT_SENDER_ID) params.set('from', AT_SENDER_ID);
  const payload = params.toString();
  const r = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.africastalking.com',
      path:     '/version1/messaging',
      method:   'POST',
      headers:  {
        'apiKey':         AT_API_KEY,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
        'Accept':         'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ statusCode: res.statusCode, raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  console.log(`[otp/send] africas-talking to=${to} httpStatus=${r.statusCode} body=${JSON.stringify(r.body || r.raw)}`);
  if (r.statusCode >= 400) return { ok: false, error: "Africa's Talking HTTP " + r.statusCode };
  const recipients = r.body?.SMSMessageData?.Recipients || [];
  if (!recipients.length) return { ok: false, error: "Africa's Talking: aucun destinataire" };
  const first = recipients[0];
  if ([100, 101, 102].includes(first.statusCode)) return { ok: true, provider: 'africastalking' };
  return { ok: false, error: `Africa's Talking rejeté (${first.statusCode}) : ${first.status}` };
}

/* ══ HANDLER PRINCIPAL ══ */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  const body    = await parseBody(req);
  const phone   = (body.phone   || '').trim();
  const email   = (body.email   || '').trim().toLowerCase();
  const prenom  = (body.prenom  || '').trim();
  const purpose = body.purpose  || 'register';
  const channel = 'email'; // canal unique — SMS supprimé

  if (!phone) return res.status(400).json({ error: 'phone requis' });

  /* Vérification existence selon le but */
  if (purpose === 'register') {
    /* Bloquer si le numéro est déjà enregistré */
    try {
      const rows = await supabaseRequest('GET',
        '/users?phone=eq.' + encodeURIComponent(phone) + '&select=id');
      if (Array.isArray(rows) && rows.length > 0) {
        return res.status(409).json({ error: 'Ce numéro est déjà enregistré. Connectez-vous.' });
      }
    } catch (err) {
      console.error('[otp/send] Supabase error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  } else if (purpose === 'reset') {
    /* Bloquer si le numéro n'existe pas */
    try {
      const rows = await supabaseRequest('GET',
        '/users?phone=eq.' + encodeURIComponent(phone) + '&select=id,prenom,email');
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ error: "Aucun compte trouvé pour ce numéro." });
      }
      /* Si email non fourni mais stocké en base, l'utiliser */
      if (!email && rows[0].email) {
        body._emailFromDb = rows[0].email;
      }
    } catch (err) {
      console.error('[otp/send] Supabase error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  const otp      = generateOTP();
  const ts       = Date.now();
  const token    = `${ts}.${signOTP(otp, phone, ts)}`;
  const smsText  = `Votre code Epargn+ : ${otp}. Valable 5 min. Ne jamais partager ce code.`;

  const hasResend   = !!process.env.RESEND_API_KEY;
  const targetEmail = email || body._emailFromDb || null;
  const demo        = !hasResend;

  /* ── Validation email obligatoire ── */
  if (!targetEmail) {
    return res.status(400).json({ error: 'Entrez votre adresse email pour recevoir le code.' });
  }

  if (!demo) {
    /* ── Envoi OTP par email (Resend) ── */
    const emailResult = await sendEmail({
      to:      targetEmail,
      subject: `${otp} — Votre code Epargn+`,
      html:    otpEmailHtml(otp, prenom),
    });
    console.log(`[otp/send] email to=${targetEmail} ok=${emailResult.ok} ${emailResult.error || ''}`);
    if (!emailResult.ok) {
      return res.status(502).json({ error: emailResult.error || "Envoi email échoué. Vérifiez l'adresse." });
    }
  } else {
    console.log(`[DEMO OTP] phone=${phone} email=${targetEmail} code=${otp} purpose=${purpose}`);
  }

  return res.status(200).json({
    token,
    expires:   ts + OTP_TTL_MS,
    demo,
    emailSent: !!(targetEmail && hasResend && !demo),
    channel,
  });
};
