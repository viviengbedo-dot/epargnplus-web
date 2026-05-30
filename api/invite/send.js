/**
 * POST /api/invite/send — Epargn+
 * Envoie une invitation SMS à un nouveau membre d'une épargne collective.
 *
 * Body : { phone, tontineName, mise, freq, creatorName }
 * Auth : Bearer token utilisateur (vérifié via Supabase)
 */

const https  = require('https');
const { supabaseRequest } = require('../_lib/supabase');
const { sendEmail }       = require('../_lib/email');

const INFOBIP_API_KEY  = process.env.INFOBIP_API_KEY;
const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL;
const INFOBIP_FROM     = process.env.INFOBIP_FROM;
const AT_API_KEY       = process.env.AT_API_KEY;
const AT_USERNAME      = process.env.AT_USERNAME;
const AT_SENDER_ID     = process.env.AT_SENDER_ID;

const APP_URL = 'https://epargnplus.com';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* ── Formater fréquence ── */
function freqLabel(freq) {
  if (freq === 'journalier')   return 'par jour';
  if (freq === 'hebdomadaire') return 'par semaine';
  if (freq === 'bimensuelle')  return '2× par mois';
  return 'par mois';
}

/* ── Format montant ── */
function fmt(n) {
  return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* ════ Infobip SMS ════ */
function infobipSend(to, text) {
  if (!INFOBIP_API_KEY || !INFOBIP_BASE_URL) return Promise.resolve({ ok: false, error: 'Infobip non configuré' });
  const body = JSON.stringify({ to, text });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: INFOBIP_BASE_URL,
      path:     '/sms/1/text/single',
      method:   'POST',
      headers:  {
        'Authorization':  `App ${INFOBIP_API_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept':         'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const groupId = j?.messages?.[0]?.status?.groupId;
          if (res.statusCode < 400 && groupId !== 5 && groupId !== 2) {
            resolve({ ok: true, provider: 'infobip' });
          } else {
            resolve({ ok: false, error: 'Infobip groupId=' + groupId });
          }
        } catch { resolve({ ok: false, error: 'Infobip parse error' }); }
      });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

/* ════ Africa's Talking SMS ════ */
function atSend(to, text) {
  if (!AT_API_KEY || !AT_USERNAME) return Promise.resolve({ ok: false, error: "AT non configuré" });
  const params = new URLSearchParams({ username: AT_USERNAME, to, message: text });
  if (AT_SENDER_ID) params.set('from', AT_SENDER_ID);
  const payload = params.toString();
  return new Promise((resolve) => {
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
        try {
          const j = JSON.parse(data);
          const first = j?.SMSMessageData?.Recipients?.[0];
          if (first && [100, 101, 102].includes(first.statusCode)) {
            resolve({ ok: true, provider: 'africastalking' });
          } else {
            resolve({ ok: false, error: 'AT statusCode=' + (first?.statusCode) });
          }
        } catch { resolve({ ok: false, error: 'AT parse error' }); }
      });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

/* ════ HANDLER ════ */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST uniquement' });

  /* Auth — vérifier que le créateur est connecté */
  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const rows = await supabaseRequest('GET', '/users?token=eq.' + encodeURIComponent(token) + '&select=id,prenom,nom,phone');
    if (!Array.isArray(rows) || !rows[0]) {
      return res.status(401).json({ error: 'Token invalide' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Erreur auth : ' + e.message });
  }

  const body = await parseBody(req);
  const { phone, tontineName, mise, freq, creatorName } = body;

  if (!phone) return res.status(400).json({ error: 'phone requis' });

  const fl   = freqLabel(freq || 'mensuelle');
  const mFmt = fmt(mise || 0);
  const nom  = tontineName || 'Épargne Collective';
  const creator = creatorName || 'Un membre';

  /* ── Chercher l'email du destinataire via son numéro (côté serveur) ── */
  let inviteeEmail = null;
  let inviteeName  = null;
  try {
    /* Normaliser le numéro : retirer espaces/tirets pour la recherche */
    const phoneClean = phone.replace(/[\s\-]/g, '');
    const found = await supabaseRequest(
      'GET',
      '/users?phone=eq.' + encodeURIComponent(phoneClean) +
      '&select=email,prenom,nom&limit=1'
    );
    if (Array.isArray(found) && found[0]) {
      inviteeEmail = found[0].email  || null;
      inviteeName  = found[0].prenom || null;
    }
  } catch (e) {
    console.warn('[invite/send] lookup email:', e.message);
  }

  /* ── Message SMS ── */
  const greeting  = inviteeName ? `Bonjour ${inviteeName},\n` : '';
  const smsText   =
    `${greeting}${creator} vous a ajouté(e) au groupe d'épargne « ${nom} » sur Epargn+.\n` +
    `Mise : ${mFmt} GNF ${fl}.\n` +
    `Rejoignez l'app : ${APP_URL}/connexion`;

  /* ── Tentative SMS — Infobip d'abord, AT en fallback ── */
  let smsResult = { ok: false };
  const hasInfobip = INFOBIP_API_KEY && INFOBIP_BASE_URL;
  const hasAT      = AT_API_KEY && AT_USERNAME;

  if (hasInfobip) {
    smsResult = await infobipSend(phone, smsText);
    if (!smsResult.ok && hasAT) smsResult = await atSend(phone, smsText);
  } else if (hasAT) {
    smsResult = await atSend(phone, smsText);
  }

  const demo = !hasInfobip && !hasAT;
  if (demo) {
    console.log('[invite/send] DEMO phone=' + phone + ' email=' + (inviteeEmail || 'none') + ' msg=' + smsText);
  } else {
    console.log('[invite/send] phone=' + phone + ' ok=' + smsResult.ok + ' provider=' + (smsResult.provider || smsResult.error) + ' email=' + (inviteeEmail || 'none'));
  }

  /* ── Email automatique si le compte est trouvé et RESEND configuré ── */
  let emailSent = false;
  if (inviteeEmail && process.env.RESEND_API_KEY) {
    const salut = inviteeName ? `Bonjour ${inviteeName},` : 'Bonjour,';
    await sendEmail({
      to:      inviteeEmail,
      subject: `${creator} vous invite à rejoindre « ${nom} » sur Epargn+`,
      html:    `<div style="font-family:sans-serif;max-width:480px;margin:auto;background:#f9fafb;padding:32px 24px;border-radius:16px;">
        <div style="background:#0B1566;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <div style="font-size:36px;margin-bottom:8px;">🤝</div>
          <div style="color:#C8E000;font-size:20px;font-weight:800;">Invitation Epargn+</div>
        </div>
        <p style="font-size:15px;color:#374151;line-height:1.6;">${salut}</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;">
          <strong>${creator}</strong> vous a ajouté(e) au groupe d'épargne collective
          <strong>« ${nom} »</strong>.
        </p>
        <div style="background:#EEF2FF;border-radius:10px;padding:16px;margin:20px 0;">
          <div style="font-size:13px;color:#6B7280;margin-bottom:4px;">Mise de participation</div>
          <div style="font-size:22px;font-weight:900;color:#0B1566;">${mFmt} GNF <span style="font-size:14px;font-weight:600;">${fl}</span></div>
        </div>
        <a href="${APP_URL}/connexion" style="display:block;background:#0B1566;color:#fff;padding:15px 24px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px;text-align:center;margin-top:8px;">
          Rejoindre le groupe →
        </a>
        <p style="font-size:12px;color:#9CA3AF;margin-top:24px;text-align:center;">
          Epargn+ — L'épargne intelligente pour l'Afrique de l'Ouest<br>
          <a href="${APP_URL}" style="color:#9CA3AF;">${APP_URL}</a>
        </p>
      </div>`,
    }).then(() => { emailSent = true; }).catch(() => {});
  }

  return res.status(200).json({
    ok:        true,
    smsSent:   smsResult.ok,
    emailSent,
    provider:  smsResult.provider || null,
    demo,
  });
};
