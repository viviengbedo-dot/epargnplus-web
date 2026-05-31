/**
 * Epargn+ — Moteur Email v7
 * ═══════════════════════════════════════════════════════════════════
 * Architecture :
 *   emailEngine.trigger(triggerName, userId, data)
 *     → Charger préférences utilisateur (email_prefs)
 *     → Charger template DB ou fallback JS
 *     → Personnaliser (variables, pays, devise)
 *     → Envoyer via provider (Resend primary, SMTP fallback)
 *     → Journaliser dans email_logs
 *
 * Variables d'environnement :
 *   RESEND_API_KEY  — clé Resend (re_...)
 *   RESEND_FROM     — expéditeur vérifié
 *   EMAIL_PROVIDER  — 'resend' | 'brevo' | 'sendgrid' (défaut: resend)
 *   BREVO_API_KEY   — si EMAIL_PROVIDER=brevo
 *   SENDGRID_API_KEY — si EMAIL_PROVIDER=sendgrid
 *   APP_URL         — URL publique de l'app
 *   CRON_SECRET     — secret pour les jobs planifiés
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';
const https        = require('https');
const { supabaseRequest } = require('./supabase');

const FROM         = process.env.RESEND_FROM    || 'Epargn+ <noreply@epargnplus.com>';
const APP_URL      = process.env.APP_URL         || 'https://www.epargnplus.com';
const PROVIDER     = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();

/* ════════════════════════════════════════════════════════════════════
   PROVIDER ABSTRACTION
   ════════════════════════════════════════════════════════════════════ */

async function _sendViaResend({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY non configuré' };

  const body = JSON.stringify({
    from: FROM,
    to:   Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(text ? { text } : {}),
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: {
        'Authorization':  `Bearer ${key}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(res.statusCode >= 400
            ? { ok: false, error: j.message || 'Resend HTTP ' + res.statusCode }
            : { ok: true, id: j.id }
          );
        } catch { resolve({ ok: false, error: 'Resend réponse invalide' }); }
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

async function _sendViaBrevo({ to, subject, html, text }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: 'BREVO_API_KEY non configuré' };

  const [namePart, emailPart] = FROM.replace('>', '').split('<');
  const body = JSON.stringify({
    sender:  { name: namePart.trim(), email: (emailPart || FROM).trim() },
    to:      (Array.isArray(to) ? to : [to]).map(e => ({ email: e })),
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
      headers: {
        'api-key': key, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(res.statusCode >= 400
            ? { ok: false, error: j.message || 'Brevo HTTP ' + res.statusCode }
            : { ok: true, id: j.messageId }
          );
        } catch { resolve({ ok: false, error: 'Brevo réponse invalide' }); }
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

async function _sendViaSendgrid({ to, subject, html, text }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { ok: false, error: 'SENDGRID_API_KEY non configuré' };

  const [namePart, emailPart] = FROM.replace('>', '').split('<');
  const body = JSON.stringify({
    personalizations: [{ to: (Array.isArray(to) ? to : [to]).map(e => ({ email: e })) }],
    from: { email: (emailPart || FROM).trim(), name: namePart.trim() },
    subject,
    content: [
      { type: 'text/html', value: html },
      ...(text ? [{ type: 'text/plain', value: text }] : []),
    ],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.sendgrid.com', path: '/v3/mail/send', method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        resolve(res.statusCode >= 400
          ? { ok: false, error: 'SendGrid HTTP ' + res.statusCode }
          : { ok: true, id: res.headers['x-message-id'] || 'sg-ok' }
        );
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

async function sendEmail({ to, subject, html, text }) {
  switch (PROVIDER) {
    case 'brevo':    return _sendViaBrevo({ to, subject, html, text });
    case 'sendgrid': return _sendViaSendgrid({ to, subject, html, text });
    default:         return _sendViaResend({ to, subject, html, text });
  }
}

/* ════════════════════════════════════════════════════════════════════
   TEMPLATE ENGINE
   ════════════════════════════════════════════════════════════════════ */

/**
 * Remplace {{variable}} dans une chaîne.
 */
function interpolate(str, vars) {
  if (!str) return '';
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : ''
  );
}

/**
 * Devise et suffixe selon le pays.
 */
function currencyFor(country) {
  const map = { gn: 'GNF', bj: 'FCFA', ci: 'FCFA', cn: 'CNY' };
  return map[country] || 'GNF';
}

function formatMoney(amount, country) {
  const cur = currencyFor(country);
  return Number(amount || 0).toLocaleString('fr-FR') + ' ' + cur;
}

/**
 * Charge le template depuis Supabase ou retourne null (→ fallback JS).
 */
async function loadTemplate(trigger, language) {
  try {
    const rows = await supabaseRequest('GET',
      `/email_templates?trigger=eq.${encodeURIComponent(trigger)}&language=eq.${language}&active=eq.true&select=id,subject,body_html,body_text&limit=1`
    );
    if (Array.isArray(rows) && rows[0] && rows[0].body_html &&
        !rows[0].body_html.includes('Template géré par le moteur JS')) {
      return rows[0];
    }
  } catch (e) { /* ignore — utilise fallback */ }
  return null;
}

/**
 * Vérifie si l'utilisateur accepte ce type d'email.
 */
async function userAcceptsEmail(userId, triggerCategory) {
  try {
    const rows = await supabaseRequest('GET',
      `/email_prefs?user_id=eq.${encodeURIComponent(userId)}&select=unsubscribed_all,${triggerCategory}&limit=1`
    );
    if (Array.isArray(rows) && rows[0]) {
      if (rows[0].unsubscribed_all) return false;
      if (rows[0][triggerCategory] === false) return false;
    }
  } catch (e) { /* par défaut autorisé */ }
  return true;
}

/**
 * Journalise l'envoi dans email_logs.
 */
async function logEmail(userId, trigger, toEmail, subject, result, templateId) {
  try {
    await supabaseRequest('POST', '/email_logs', {
      user_id:     userId || null,
      template_id: templateId || null,
      trigger,
      to_email:    toEmail,
      subject,
      provider_id: result.id || null,
      status:      result.ok ? 'sent' : 'failed',
      error:       result.ok ? null : (result.error || null),
    });
  } catch (e) { /* log non bloquant */ }
}

/* ════════════════════════════════════════════════════════════════════
   BASE HTML WRAPPER
   ════════════════════════════════════════════════════════════════════ */

function wrapHtml({ title, preheader, bodyHtml, footerExtra, logId }) {
  const trackingPixel = logId
    ? `<img src="${APP_URL}/api/email/track?id=${logId}&event=open" width="1" height="1" style="display:none;" />`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#F0F3FF; font-family:'Segoe UI',Arial,Helvetica,sans-serif; }
  a { color:#0B1566; }
  @media (max-width:600px) { .container { border-radius:0 !important; } .pad { padding:28px 20px !important; } }
</style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F0F3FF;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F3FF;padding:32px 16px;">
    <tr><td align="center">
      <table class="container" width="560" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(11,21,102,0.10);max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0B1566,#1a2a8a);padding:32px 40px;text-align:center;">
            <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:1px;">Epargn+</div>
            <div style="color:#A5B4FC;font-size:13px;margin-top:4px;">Épargne mobile · Afrique de l'Ouest</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="pad" style="padding:40px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFF;padding:20px 40px;border-top:1px solid #E8EDF5;">
            ${footerExtra ? `<p style="color:#6B7280;font-size:13px;margin:0 0 8px;">${footerExtra}</p>` : ''}
            <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.6;">
              © 2026 Epargn+ · <a href="${APP_URL}" style="color:#9CA3AF;">epargnplus.com</a>
              · <a href="${APP_URL}/unsubscribe?u=USERID" style="color:#9CA3AF;">Se désabonner</a>
            </p>
            ${trackingPixel}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text, href) {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#0B1566,#1a2a8a);
      color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;
      font-weight:700;font-size:15px;letter-spacing:.02em;">${text}</a>
  </div>`;
}

function infoBox(label, value, bg) {
  return `<div style="background:${bg||'#F0F3FF'};border-radius:12px;padding:14px 18px;margin:8px 0;">
    <div style="color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">${label}</div>
    <div style="color:#0B1566;font-weight:700;font-size:16px;margin-top:3px;">${value}</div>
  </div>`;
}

function statusBadge(label, color) {
  const colors = {
    success: { bg:'#D1FAE5', fg:'#065F46' },
    warning: { bg:'#FEF3C7', fg:'#92400E' },
    error:   { bg:'#FEE2E2', fg:'#991B1B' },
    info:    { bg:'#EEF2FF', fg:'#3730A3' },
  };
  const c = colors[color] || colors.info;
  return `<span style="background:${c.bg};color:${c.fg};padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;">${label}</span>`;
}

/* ════════════════════════════════════════════════════════════════════
   TEMPLATES FALLBACK JS
   ════════════════════════════════════════════════════════════════════ */

const TEMPLATES = {

  welcome: (v) => ({
    subject: `Bienvenue sur Epargn+, ${v.prenom} ! 🎉`,
    body: wrapHtml({
      title: 'Bienvenue sur Epargn+',
      preheader: 'Votre parcours d\'épargne commence aujourd\'hui.',
      bodyHtml: `
        <h2 style="color:#0B1566;margin:0 0 16px;font-size:22px;">Bienvenue, ${v.prenom} ! 🎉</h2>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Votre compte Epargn+ est actif. Vous pouvez maintenant épargner, créer des objectifs financiers et rejoindre des groupes d'épargne collective depuis votre téléphone.
        </p>
        ${infoBox('Numéro enregistré', v.phone, '#F0F3FF')}
        ${infoBox('Pays', v.countryLabel || v.country || '—', '#F0F3FF')}
        <p style="color:#374151;font-size:14px;margin:20px 0 8px;font-weight:700;">Par où commencer ?</p>
        <ul style="color:#374151;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
          <li>Créez votre premier objectif d'épargne</li>
          <li>Effectuez un premier dépôt</li>
          <li>Vérifiez votre identité (KYC) pour accéder aux retraits</li>
        </ul>
        ${btn('Accéder à mon espace →', APP_URL + '/connexion')}
        <p style="color:#6B7280;font-size:12px;text-align:center;margin:0;">
          🔒 Vos données sont chiffrées et sécurisées.
        </p>`,
    }),
  }),

  deposit_confirmed: (v) => ({
    subject: `Dépôt de ${v.montant} reçu — ref. ${v.reference}`,
    body: wrapHtml({
      title: 'Dépôt reçu',
      preheader: `Votre dépôt de ${v.montant} via ${v.operateur} est en cours de traitement.`,
      bodyHtml: `
        <h2 style="color:#0B1566;margin:0 0 16px;font-size:20px;">Dépôt enregistré ⏳</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          Bonjour ${v.prenom}, votre demande de dépôt a bien été reçue et est en cours de validation.
        </p>
        <div style="background:#F0F3FF;border-radius:14px;padding:20px;margin-bottom:20px;">
          ${infoBox('Montant', v.montant)}
          ${infoBox('Opérateur', v.operateur)}
          ${infoBox('Référence', v.reference, '#fff')}
          ${infoBox('Date', v.date)}
          <div style="margin-top:12px;">${statusBadge('En attente de validation', 'warning')}</div>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">
          ⏱ Délai estimé : <strong>2 à 24h ouvrées</strong>.<br>
          Vous recevrez un email de confirmation dès validation.
        </p>
        ${btn('Suivre mon dépôt →', APP_URL + '/espace-client')}`,
    }),
  }),

  deposit_approved: (v) => ({
    subject: `✅ Dépôt de ${v.montant} confirmé !`,
    body: wrapHtml({
      title: 'Dépôt confirmé',
      preheader: `Votre solde est maintenant de ${v.nouveauSolde}.`,
      bodyHtml: `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:56px;">✅</div>
        </div>
        <h2 style="color:#065F46;margin:0 0 12px;font-size:20px;text-align:center;">Dépôt confirmé !</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;text-align:center;">
          Bonjour ${v.prenom}, votre dépôt a été validé par notre équipe.
        </p>
        <div style="background:#D1FAE5;border-radius:14px;padding:20px;margin-bottom:20px;">
          ${infoBox('Montant crédité', v.montant, '#fff')}
          ${infoBox('Nouveau solde', v.nouveauSolde, '#fff')}
          ${v.projet ? infoBox('Projet associé', v.projet, '#fff') : ''}
          ${v.progression ? infoBox('Progression objectif', v.progression + '%', '#fff') : ''}
        </div>
        ${btn('Voir mon espace →', APP_URL + '/espace-client')}`,
    }),
  }),

  deposit_rejected: (v) => ({
    subject: `Information sur votre dépôt`,
    body: wrapHtml({
      title: 'Dépôt non traité',
      preheader: 'Votre demande de dépôt n\'a pas pu être traitée.',
      bodyHtml: `
        <h2 style="color:#991B1B;margin:0 0 12px;font-size:20px;">Dépôt non traité ❌</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          Bonjour ${v.prenom}, votre demande de dépôt de ${v.montant} n'a pas pu être traitée.
        </p>
        ${v.motif ? infoBox('Motif', v.motif, '#FEE2E2') : ''}
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0;">
          Vous pouvez effectuer une nouvelle demande de dépôt ou contacter notre support.
        </p>
        ${btn('Nouvelle tentative →', APP_URL + '/espace-client')}`,
    }),
  }),

  withdrawal_requested: (v) => ({
    subject: `Retrait de ${v.montant} en cours de traitement`,
    body: wrapHtml({
      title: 'Retrait demandé',
      preheader: `Votre retrait de ${v.montant} est en cours.`,
      bodyHtml: `
        <h2 style="color:#0B1566;margin:0 0 12px;font-size:20px;">Retrait en cours ⏳</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          Bonjour ${v.prenom}, votre demande de retrait a été reçue.
        </p>
        <div style="background:#F0F3FF;border-radius:14px;padding:20px;margin-bottom:20px;">
          ${infoBox('Montant', v.montant)}
          ${infoBox('Numéro de réception', v.phoneRetrait || v.phone)}
          <div style="margin-top:12px;">${statusBadge('Traitement en cours', 'warning')}</div>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">
          Délai estimé : <strong>2 à 24h ouvrées</strong> selon votre opérateur.
        </p>
        ${btn('Voir mon historique →', APP_URL + '/espace-client')}`,
    }),
  }),

  withdrawal_confirmed: (v) => ({
    subject: `✅ Retrait de ${v.montant} envoyé !`,
    body: wrapHtml({
      title: 'Retrait confirmé',
      preheader: `Votre retrait de ${v.montant} a été envoyé.`,
      bodyHtml: `
        <div style="text-align:center;margin-bottom:24px;"><div style="font-size:56px;">💸</div></div>
        <h2 style="color:#065F46;margin:0 0 12px;font-size:20px;text-align:center;">Retrait envoyé !</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;text-align:center;">
          Votre retrait de ${v.montant} a été traité et envoyé sur votre compte Mobile Money.
        </p>
        <div style="background:#D1FAE5;border-radius:14px;padding:20px;margin-bottom:20px;">
          ${infoBox('Montant envoyé', v.montant, '#fff')}
          ${infoBox('Nouveau solde', v.nouveauSolde, '#fff')}
        </div>
        ${btn('Voir mon historique →', APP_URL + '/espace-client')}`,
    }),
  }),

  kyc_received: (v) => ({
    subject: `Dossier KYC reçu — vérification en cours`,
    body: wrapHtml({
      title: 'KYC reçu',
      preheader: 'Votre dossier d\'identité est en cours de vérification.',
      bodyHtml: `
        <h2 style="color:#0B1566;margin:0 0 12px;font-size:20px;">Dossier reçu 📋</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          Bonjour ${v.prenom}, nous avons bien reçu votre dossier de vérification d'identité.
        </p>
        <div style="background:#FEF9C3;border-radius:12px;padding:16px 18px;margin-bottom:20px;">
          <p style="color:#92400E;font-size:14px;margin:0;line-height:1.6;">
            ⏱ Notre équipe vérifie votre dossier <strong>sous 2 heures ouvrées</strong>.<br>
            Vous recevrez un email dès la décision.
          </p>
        </div>
        ${btn('Voir mon espace →', APP_URL + '/espace-client')}`,
    }),
  }),

  kyc_approved: (v) => ({
    subject: `🎉 Identité vérifiée — accès complet débloqué`,
    body: wrapHtml({
      title: 'KYC approuvé',
      preheader: 'Votre identité a été vérifiée. Les retraits sont maintenant disponibles.',
      bodyHtml: `
        <div style="text-align:center;margin-bottom:24px;"><div style="font-size:56px;">🎉</div></div>
        <h2 style="color:#065F46;margin:0 0 12px;font-size:20px;text-align:center;">Identité vérifiée !</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;text-align:center;">
          Bonjour ${v.prenom}, votre identité a été vérifiée avec succès.
        </p>
        <div style="background:#D1FAE5;border-radius:12px;padding:16px 18px;margin-bottom:24px;">
          <p style="color:#065F46;font-size:14px;margin:0;line-height:1.6;">
            ✅ Retraits activés<br>
            ✅ Limites de dépôt augmentées<br>
            ✅ Accès aux fonctionnalités premium
          </p>
        </div>
        ${btn('Accéder à mon espace →', APP_URL + '/espace-client')}`,
    }),
  }),

  kyc_rejected: (v) => ({
    subject: `Action requise — nouveau dépôt de documents`,
    body: wrapHtml({
      title: 'KYC — action requise',
      preheader: 'Votre dossier KYC nécessite des corrections.',
      bodyHtml: `
        <h2 style="color:#991B1B;margin:0 0 12px;font-size:20px;">Dossier incomplet ❌</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          Bonjour ${v.prenom}, votre dossier de vérification n'a pas pu être validé.
        </p>
        ${v.motif ? `<div style="background:#FEE2E2;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
          <p style="color:#991B1B;font-size:14px;margin:0;"><strong>Motif :</strong> ${v.motif}</p>
        </div>` : ''}
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">
          Veuillez soumettre à nouveau vos documents en vous assurant que :
        </p>
        <ul style="color:#374151;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
          <li>La photo de la pièce d'identité est nette et lisible</li>
          <li>Le selfie est bien éclairé et votre visage est visible</li>
          <li>Les documents ne sont pas expirés</li>
        </ul>
        ${btn('Resoumettre mes documents →', APP_URL + '/espace-client')}`,
    }),
  }),

  goal_reached: (v) => ({
    subject: `🎉 Félicitations — objectif "${v.projet}" atteint !`,
    body: wrapHtml({
      title: 'Objectif atteint',
      preheader: `Vous avez atteint votre objectif ${v.projet} !`,
      bodyHtml: `
        <div style="text-align:center;margin-bottom:24px;"><div style="font-size:64px;">🏆</div></div>
        <h2 style="color:#0B1566;margin:0 0 12px;font-size:22px;text-align:center;">Objectif atteint !</h2>
        <p style="color:#374151;font-size:15px;text-align:center;margin:0 0 20px;">
          Félicitations ${v.prenom} ! Vous avez atteint votre objectif <strong>${v.projet}</strong>.
        </p>
        <div style="background:#F0F3FF;border-radius:14px;padding:20px;margin-bottom:24px;text-align:center;">
          <div style="font-size:36px;font-weight:900;color:#0B1566;">${v.montant}</div>
          <div style="color:#6B7280;font-size:13px;margin-top:4px;">épargné en ${v.duree || 'votre parcours'}</div>
        </div>
        <p style="color:#374151;font-size:14px;text-align:center;margin:0 0 24px;">
          Prêt pour votre prochain défi ?
        </p>
        ${btn('Créer un nouvel objectif →', APP_URL + '/espace-client')}`,
    }),
  }),

  reminder_7d: (v) => ({
    subject: `Un petit geste aujourd'hui pour ${v.projet || 'votre objectif'}`,
    body: wrapHtml({
      title: 'Rappel d\'épargne',
      preheader: 'Vous n\'avez pas épargné depuis 7 jours. Un petit dépôt compte !',
      bodyHtml: `
        <h2 style="color:#0B1566;margin:0 0 12px;font-size:20px;">Votre objectif vous attend 🎯</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          Bonjour ${v.prenom}, cela fait ${v.jours || 7} jours sans dépôt.
          Un petit versement régulier est plus efficace qu'un grand geste rare.
        </p>
        ${v.projet ? `<div style="background:#F0F3FF;border-radius:14px;padding:20px;margin-bottom:20px;">
          ${infoBox('Objectif', v.projet)}
          ${infoBox('Progression', v.progression + '%')}
          ${infoBox('Reste à épargner', v.reste, '#fff')}
        </div>` : ''}
        <p style="color:#6B7280;font-size:13px;font-style:italic;margin:0 0 24px;text-align:center;">
          « Un petit dépôt aujourd'hui vous rapproche de votre rêve de demain. »
        </p>
        ${btn('Faire un dépôt maintenant →', APP_URL + '/espace-client')}`,
      footerExtra: '<a href="' + APP_URL + '/unsubscribe?type=reminders">Ne plus recevoir ces rappels</a>',
    }),
  }),

  collective_invite: (v) => ({
    subject: `Invitation : rejoignez le groupe "${v.tontineName}"`,
    body: wrapHtml({
      title: 'Invitation épargne collective',
      preheader: `${v.inviter} vous invite à rejoindre ${v.tontineName}.`,
      bodyHtml: `
        <h2 style="color:#0B1566;margin:0 0 12px;font-size:20px;">Vous êtes invité(e) ! 🤝</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          <strong>${v.inviter}</strong> vous invite à rejoindre le groupe d'épargne collective <strong>${v.tontineName}</strong>.
        </p>
        <div style="background:#F0F3FF;border-radius:14px;padding:20px;margin-bottom:20px;">
          ${infoBox('Groupe', v.tontineName)}
          ${infoBox('Mise mensuelle', v.mise)}
          ${infoBox('Fréquence', v.freq || 'Mensuelle')}
        </div>
        ${btn('Accepter l\'invitation →', APP_URL + '/join/' + (v.inviteCode || ''))}
        <p style="color:#6B7280;font-size:12px;text-align:center;margin:8px 0 0;">
          Cette invitation expire dans 7 jours.
        </p>`,
    }),
  }),

  collective_closed: (v) => ({
    subject: `Épargne collective "${v.tontineName}" clôturée`,
    body: wrapHtml({
      title: 'Groupe clôturé',
      preheader: `Le groupe ${v.tontineName} a été clôturé. Un remboursement est en cours.`,
      bodyHtml: `
        <h2 style="color:#0B1566;margin:0 0 12px;font-size:20px;">Groupe clôturé 📦</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">
          Bonjour ${v.prenom}, le groupe <strong>${v.tontineName}</strong> a été clôturé par l'administrateur.
        </p>
        ${infoBox('Votre part à rembourser', v.part)}
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0 24px;">
          Le remboursement sera effectué sur votre Mobile Money dans les <strong>24h ouvrées</strong>.
        </p>
        ${btn('Voir mon espace →', APP_URL + '/espace-client')}`,
    }),
  }),

  ai_suggestion: (v) => ({
    subject: v.sujet || `Conseil personnalisé pour votre épargne`,
    body: wrapHtml({
      title: 'Conseil Epargn+',
      preheader: v.intro || 'Un conseil personnalisé basé sur votre profil.',
      bodyHtml: `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="font-size:32px;">🤖</div>
          <h2 style="color:#0B1566;margin:0;font-size:18px;">Conseil personnalisé</h2>
        </div>
        <p style="color:#374151;font-size:15px;margin:0 0 20px;">Bonjour ${v.prenom},</p>
        <div style="background:#F0F3FF;border-radius:14px;padding:20px;margin-bottom:20px;">
          <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;">${v.conseil}</p>
        </div>
        ${v.objectif_suggere ? `<p style="color:#374151;font-size:14px;margin:0 0 20px;">
          <strong>Objectif suggéré :</strong> ${v.objectif_suggere}<br>
          <strong>Rythme recommandé :</strong> ${v.rythme || 'Hebdomadaire'}
        </p>` : ''}
        ${btn('Appliquer ce conseil →', APP_URL + '/espace-client')}`,
      footerExtra: '<a href="' + APP_URL + '/unsubscribe?type=marketing">Ne plus recevoir ces conseils</a>',
    }),
  }),
};

/* ════════════════════════════════════════════════════════════════════
   MOTEUR PRINCIPAL
   ════════════════════════════════════════════════════════════════════ */

/**
 * Catégorie d'email_prefs par trigger.
 */
const TRIGGER_PREF = {
  welcome:              'welcome',
  deposit_confirmed:    'deposit',
  deposit_approved:     'deposit',
  deposit_rejected:     'deposit',
  withdrawal_requested: 'withdrawal',
  withdrawal_confirmed: 'withdrawal',
  kyc_received:         'kyc',
  kyc_approved:         'kyc',
  kyc_rejected:         'kyc',
  goal_reached:         'deposit',
  reminder_7d:          'reminders',
  collective_invite:    'collective',
  collective_closed:    'collective',
  ai_suggestion:        'marketing',
};

/**
 * Envoie un email déclenché par un événement.
 *
 * @param {string} trigger      — nom du déclencheur (ex: 'deposit_approved')
 * @param {string|null} userId  — UUID utilisateur Supabase
 * @param {object} vars         — variables de personnalisation
 * @param {string} toEmail      — adresse email destinataire
 * @returns {Promise<{ok, id?, error?}>}
 */
async function trigger(triggerName, userId, vars, toEmail) {
  if (!toEmail) return { ok: false, error: 'no email' };

  // Vérification préférences utilisateur
  const pref = TRIGGER_PREF[triggerName] || 'deposit';
  if (userId) {
    const allowed = await userAcceptsEmail(userId, pref);
    if (!allowed) return { ok: false, error: 'unsubscribed' };
  }

  // Charger template DB
  const dbTemplate = await loadTemplate(triggerName, 'fr');
  let subject, html;

  if (dbTemplate) {
    subject = interpolate(dbTemplate.subject, vars);
    html    = interpolate(dbTemplate.body_html, vars);
  } else {
    // Fallback JS template
    const tplFn = TEMPLATES[triggerName];
    if (!tplFn) {
      console.warn('[email] trigger inconnu:', triggerName);
      return { ok: false, error: 'template inconnu: ' + triggerName };
    }
    const tpl = tplFn(vars);
    subject = tpl.subject;
    html    = tpl.body;
  }

  const result = await sendEmail({ to: toEmail, subject, html });

  // Log async (non bloquant)
  logEmail(userId, triggerName, toEmail, subject, result, dbTemplate?.id).catch(() => {});

  return result;
}

/**
 * Envoi de masse pour une campagne.
 */
async function runCampaign(campaignId) {
  try {
    const campaigns = await supabaseRequest('GET',
      `/email_campaigns?id=eq.${encodeURIComponent(campaignId)}&select=*&limit=1`
    );
    const campaign = Array.isArray(campaigns) && campaigns[0];
    if (!campaign) return { ok: false, error: 'Campaign not found' };

    // Charger les utilisateurs selon le segment
    let usersQuery = '/users?select=id,email,prenom,nom,country,epargne&limit=2000';
    switch (campaign.segment) {
      case 'gn': usersQuery += '&country=eq.gn'; break;
      case 'bj': usersQuery += '&country=eq.bj'; break;
      case 'ci': usersQuery += '&country=eq.ci'; break;
      case 'cn': usersQuery += '&country=eq.cn'; break;
      case 'kyc_verified':
        usersQuery = '/users?kyc_status=eq.verified&select=id,email,prenom,nom,country&limit=2000'; break;
      case 'kyc_pending':
        usersQuery = '/users?kyc_status=eq.pending&select=id,email,prenom,nom,country&limit=2000'; break;
      default: break;
    }
    const users = await supabaseRequest('GET', usersQuery);
    if (!Array.isArray(users)) return { ok: false, error: 'Users query failed' };

    let sentCount = 0;
    for (const u of users) {
      if (!u.email) continue;
      const vars = {
        prenom:       u.prenom || u.nom || 'Cher client',
        phone:        u.phone || '',
        country:      u.country || 'gn',
        countryLabel: { gn: 'Guinée', bj: 'Bénin', ci: 'Côte d\'Ivoire', cn: 'Chine' }[u.country] || '',
      };
      const res = await trigger(
        campaign.template_id ? 'campaign' : 'ai_suggestion',
        u.id, vars, u.email
      );
      if (res.ok) sentCount++;
    }

    await supabaseRequest('PATCH',
      `/email_campaigns?id=eq.${encodeURIComponent(campaignId)}`,
      { status: 'done', sent_count: sentCount }
    );
    return { ok: true, sentCount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Cron : rappels utilisateurs inactifs depuis N jours.
 */
async function runReminderCron() {
  const results = { sent: 0, skipped: 0, errors: 0 };
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Utilisateurs avec email, qui ont un solde > 0 mais sans transaction récente
    const users = await supabaseRequest('GET',
      `/users?email=not.is.null&epargne=gt.0&select=id,email,prenom,nom,country&limit=500`
    );
    if (!Array.isArray(users)) return results;

    for (const u of users) {
      if (!u.email) { results.skipped++; continue; }
      try {
        // Vérifier dernière transaction
        const txns = await supabaseRequest('GET',
          `/transactions?user_id=eq.${encodeURIComponent(u.id)}&created_at=gte.${cutoff}&select=id&limit=1`
        );
        if (Array.isArray(txns) && txns.length > 0) { results.skipped++; continue; }

        // Récupérer projet actif pour personnaliser
        let projetName = null, progression = 0, reste = null;
        try {
          const projets = await supabaseRequest('GET',
            `/projects?user_id=eq.${encodeURIComponent(u.id)}&status=eq.active&select=name,goal,actuel&limit=1`
          );
          if (Array.isArray(projets) && projets[0]) {
            const p = projets[0];
            projetName  = p.name;
            progression = p.goal > 0 ? Math.round((p.actuel || 0) / p.goal * 100) : 0;
            reste       = ((p.goal || 0) - (p.actuel || 0)).toLocaleString('fr-FR') + ' ' + currencyFor(u.country);
          }
        } catch {}

        const res = await trigger('reminder_7d', u.id, {
          prenom:      u.prenom || 'Cher client',
          jours:       7,
          projet:      projetName || '',
          progression: progression,
          reste:       reste || '',
        }, u.email);
        if (res.ok) results.sent++; else results.errors++;
      } catch { results.errors++; }
    }
  } catch (e) {
    console.error('[email/cron]', e.message);
  }
  return results;
}

/* ════════════════════════════════════════════════════════════════════
   EXPORTS (compatibilité ascendante)
   ════════════════════════════════════════════════════════════════════ */

// Fonctions héritées — gardées pour compatibilité avec register.js, reset-pin.js
function otpEmailHtml(otp, prenom) {
  return TEMPLATES.welcome({ prenom: prenom || '' }).body
    .replace('Bienvenue sur Epargn+', 'Vérification')
    .replace(/<h2.*?<\/h2>/s,
      `<h2 style="color:#0B1566;margin:0 0 16px;font-size:22px;">Code de vérification</h2>`)
    + `<!-- OTP: ${otp} -->`; // Le vrai template OTP est inline dans register.js
}

function buildOtpHtml(otp, prenom) {
  return wrapHtml({
    title: 'Code de vérification',
    preheader: `Votre code Epargn+ : ${otp}`,
    bodyHtml: `
      <p style="color:#374151;font-size:16px;margin:0 0 24px;">Bonjour${prenom ? ' ' + prenom : ''},</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">Votre code de vérification Epargn+ :</p>
      <div style="background:#F0F3FF;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <span style="font-size:48px;font-weight:900;letter-spacing:10px;color:#0B1566;">${otp}</span>
      </div>
      <p style="color:#6B7280;font-size:14px;text-align:center;margin:0;">
        Valable <strong>10 minutes</strong>. Ne partagez jamais ce code.
      </p>`,
  });
}

function buildResetPinHtml(otp, prenom) {
  return wrapHtml({
    title: 'Réinitialisation PIN',
    preheader: 'Code de réinitialisation de votre PIN Epargn+',
    bodyHtml: `
      <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour${prenom ? ' ' + prenom : ''},</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">Code de réinitialisation de votre PIN :</p>
      <div style="background:#FEF3C7;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <span style="font-size:48px;font-weight:900;letter-spacing:10px;color:#92400E;">${otp}</span>
      </div>
      <p style="color:#6B7280;font-size:14px;text-align:center;">
        Valable <strong>10 minutes</strong>. Si vous n'avez pas demandé ce code, ignorez cet email.
      </p>`,
  });
}

module.exports = {
  sendEmail,
  trigger,
  runCampaign,
  runReminderCron,
  interpolate,
  // Compat
  otpEmailHtml: buildOtpHtml,
  welcomeEmailHtml: (prenom, phone) =>
    TEMPLATES.welcome({ prenom, phone }).body,
  resetPinEmailHtml: buildResetPinHtml,
  buildOtpHtml,
  buildResetPinHtml,
};
