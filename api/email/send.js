/**
 * POST /api/email/send
 * Envoie un email basé sur un template
 *
 * Body: { user_id, template_type, variables }
 */

const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT } = require('../_lib/auth');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
  });
}

function extractToken(req) {
  const auth = (req.headers['authorization'] || '').trim();
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

// Interpoler les variables dans le template
function interpolate(template, variables = {}) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

// Envoyer via Resend
async function sendViaResend(recipientEmail, subject, htmlContent, variables) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Epargn+ <noreply@epargnplus.com>',
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
      reply_to: 'support@epargnplus.com',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${error}`);
  }

  const data = await response.json();
  return { provider: 'resend', provider_id: data.id };
}

// Mettre à jour le log d'email
async function updateEmailLog(logId, status, providerInfo, errorMessage = null) {
  const patch = {
    status: status,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    ...providerInfo,
    ...(errorMessage ? { error_message: errorMessage } : {}),
  };

  try {
    await supabaseRequest('PATCH',
      '/email_logs?id=eq.' + encodeURIComponent(logId),
      patch);
  } catch (e) {
    console.warn('[email/send] update log failed:', e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* ── CRON : rappels d'épargne (Vercel Cron, GET protégé par CRON_SECRET) ──
     Déclenché quotidiennement → envoie reminder_7d aux inactifs depuis 7 j. */
  if (req.method === 'GET' && /cron=reminders/.test(req.url || '')) {
    const secret = process.env.CRON_SECRET;
    const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
    if (!secret || auth !== secret) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { runReminderCron } = require('../_lib/email');
      const result = await runReminderCron();
      console.log('[email/cron] reminders', JSON.stringify(result));
      return res.status(200).json({ ok: true, job: 'reminders', ...result });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const rawToken = extractToken(req);
    if (!rawToken) return res.status(401).json({ error: 'Not authenticated' });

    const jwtPayload = verifyJWT(rawToken);
    if (!jwtPayload) return res.status(401).json({ error: 'Session expired' });

    const body = await parseBody(req);
    const { user_id, template_type, variables } = body;

    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    if (!template_type) return res.status(400).json({ error: 'template_type required' });

    // Récupérer le template
    const templates = await supabaseRequest('GET',
      '/email_templates?template_type=eq.' + encodeURIComponent(template_type) +
      '&select=id,subject,html_content,enabled');

    if (!Array.isArray(templates) || !templates[0]) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templates[0];
    if (!template.enabled) {
      return res.status(400).json({ error: 'Template is disabled' });
    }

    // Récupérer l'utilisateur
    const users = await supabaseRequest('GET',
      '/users?id=eq.' + encodeURIComponent(user_id) +
      '&select=id,email,prenom');

    if (!Array.isArray(users) || !users[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    if (!user.email) {
      return res.status(400).json({ error: 'User has no email' });
    }

    // Interpoler les variables
    const vars = { ...variables, prenom: user.prenom, app_url: process.env.APP_URL || 'https://www.epargnplus.com' };
    const subject = interpolate(template.subject, vars);
    const htmlContent = interpolate(template.html_content, vars);

    // Créer le log
    const logs = await supabaseRequest('POST', '/email_logs', {
      user_id: user_id,
      template_type: template_type,
      recipient_email: user.email,
      subject: subject,
      variables: vars,
      status: 'pending',
    });

    const logId = Array.isArray(logs) ? logs[0]?.id : logs?.id;
    if (!logId) throw new Error('Failed to create email log');

    // Envoyer l'email
    let providerInfo = {};
    try {
      providerInfo = await sendViaResend(user.email, subject, htmlContent, vars);
      await updateEmailLog(logId, 'sent', providerInfo);

      return res.status(200).json({
        ok: true,
        log_id: logId,
        recipient: user.email,
        template: template_type,
        provider: providerInfo.provider,
      });
    } catch (sendErr) {
      console.error('[email/send] send failed:', sendErr.message);
      await updateEmailLog(logId, 'failed', {}, sendErr.message);

      return res.status(500).json({
        error: 'Failed to send email: ' + sendErr.message,
        log_id: logId,
      });
    }
  } catch (e) {
    console.error('[email/send] error:', e.message);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
