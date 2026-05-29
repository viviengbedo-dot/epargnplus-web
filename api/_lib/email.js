/**
 * Epargn+ — Client Resend pour l'envoi d'emails
 * Variables d'environnement :
 *   RESEND_API_KEY → clé API Resend (re_...)
 *   RESEND_FROM    → expéditeur vérifié (ex: Epargn+ <noreply@epargnplus.com>)
 */

const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM    = process.env.RESEND_FROM || 'Epargn+ <noreply@epargnplus.com>';

function sendEmail({ to, subject, html }) {
  return new Promise((resolve) => {
    if (!RESEND_API_KEY) return resolve({ ok: false, error: 'RESEND_API_KEY non configuré' });

    const body = JSON.stringify({
      from: RESEND_FROM,
      to:   Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    const req = https.request(
      {
        hostname: 'api.resend.com',
        path:     '/emails',
        method:   'POST',
        headers:  {
          'Authorization':  `Bearer ${RESEND_API_KEY}`,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              resolve({ ok: false, error: json.message || 'Resend HTTP ' + res.statusCode });
            } else {
              resolve({ ok: true, id: json.id });
            }
          } catch {
            resolve({ ok: false, error: 'Resend réponse invalide' });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

/* ── Templates ── */

function otpEmailHtml(otp, prenom) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F3FF;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(11,21,102,0.10);">
    <div style="background:linear-gradient(135deg,#0B1566,#1a2a8a);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:1px;">Epargn+</div>
      <div style="color:#A5B4FC;font-size:14px;margin-top:4px;">Épargne mobile · Afrique de l'Ouest</div>
    </div>
    <div style="padding:40px;">
      <p style="color:#374151;font-size:16px;margin:0 0 24px;">Bonjour${prenom ? ' ' + prenom : ''},</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">Votre code de vérification Epargn+ :</p>
      <div style="background:#F0F3FF;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <span style="font-size:48px;font-weight:900;letter-spacing:10px;color:#0B1566;">${otp}</span>
      </div>
      <p style="color:#6B7280;font-size:14px;text-align:center;margin:0;">Valable <strong>5 minutes</strong>. Ne partagez jamais ce code.</p>
    </div>
    <div style="background:#F8FAFF;padding:20px 40px;border-top:1px solid #E8EDF5;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">© 2026 Epargn+ · Vous recevez cet email car vous avez créé un compte.</p>
    </div>
  </div>
</body>
</html>`;
}

function welcomeEmailHtml(prenom, phone) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F3FF;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(11,21,102,0.10);">
    <div style="background:linear-gradient(135deg,#0B1566,#1a2a8a);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:1px;">Epargn+</div>
      <div style="color:#A5B4FC;font-size:14px;margin-top:4px;">Épargne mobile · Afrique de l'Ouest</div>
    </div>
    <div style="padding:40px;">
      <h2 style="color:#0B1566;margin:0 0 16px;font-size:22px;">Bienvenue, ${prenom} ! 🎉</h2>
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Votre compte Epargn+ est créé avec succès. Vous pouvez maintenant commencer à épargner, gérer vos projets et rejoindre des tontines directement depuis votre téléphone.
      </p>
      <div style="background:#F0F3FF;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
        <div style="color:#6B7280;font-size:13px;">Numéro de compte</div>
        <div style="color:#0B1566;font-weight:700;font-size:16px;margin-top:4px;">${phone}</div>
      </div>
      <div style="text-align:center;">
        <a href="https://www.epargnplus.com/connexion" style="display:inline-block;background:linear-gradient(135deg,#0B1566,#1a2a8a);color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
          Accéder à mon espace →
        </a>
      </div>
    </div>
    <div style="background:#F8FAFF;padding:20px 40px;border-top:1px solid #E8EDF5;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">© 2026 Epargn+ · L'épargne à portée de main pour la Guinée, le Bénin et la Côte d'Ivoire.</p>
    </div>
  </div>
</body>
</html>`;
}

function resetPinEmailHtml(otp, prenom) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F3FF;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(11,21,102,0.10);">
    <div style="background:linear-gradient(135deg,#0B1566,#1a2a8a);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:1px;">Epargn+</div>
    </div>
    <div style="padding:40px;">
      <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour${prenom ? ' ' + prenom : ''},</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">Voici votre code pour réinitialiser votre PIN :</p>
      <div style="background:#FEF3C7;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <span style="font-size:48px;font-weight:900;letter-spacing:10px;color:#92400E;">${otp}</span>
      </div>
      <p style="color:#6B7280;font-size:14px;text-align:center;">Valable <strong>5 minutes</strong>. Si vous n'avez pas demandé ce code, ignorez cet email.</p>
    </div>
    <div style="background:#F8FAFF;padding:20px 40px;border-top:1px solid #E8EDF5;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">© 2026 Epargn+</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendEmail, otpEmailHtml, welcomeEmailHtml, resetPinEmailHtml };
