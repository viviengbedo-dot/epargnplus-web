/**
 * POST /api/admin/send-push
 * Envoie une notification push à un user, un segment ou tous les abonnés.
 *
 * Body :
 *   { target: 'user'|'all', user_id?, title, body, url?, tag? }
 */
const webpush = require('web-push');
const { supabaseRequest } = require('../_lib/supabase');

const ADMIN_SECRET   = process.env.ADMIN_SECRET   || 'epargn-admin-dev-2026';
const VAPID_PUBLIC   = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE  = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL    = 'mailto:ceo@epargnplus.com';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const auth = (req.headers['authorization'] || '').trim();
  if (auth.replace('Bearer ', '') !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY requis dans les variables Vercel' });
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

  const body = await parseBody(req);
  const { target, user_id, title, body: msgBody, url, tag, icon } = body;

  if (!title || !msgBody) return res.status(400).json({ error: 'title et body requis' });

  /* Récupérer les abonnements */
  let subs = [];
  try {
    const qs = target === 'user' && user_id
      ? '/push_subscriptions?user_id=eq.' + encodeURIComponent(user_id) + '&select=*'
      : '/push_subscriptions?select=*&limit=500';
    subs = await supabaseRequest('GET', qs);
    if (!Array.isArray(subs)) subs = [];
  } catch (e) {
    return res.status(500).json({ error: 'Erreur lecture abonnements : ' + e.message });
  }

  if (subs.length === 0) return res.status(200).json({ ok: true, sent: 0, message: 'Aucun abonné' });

  const payload = JSON.stringify({
    title,
    body: msgBody,
    url:  url  || '/espace-client',
    tag:  tag  || 'epargnplus',
    icon: icon || '/icon-192.png',
  });

  let sent = 0, failed = 0, expired = [];

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 86400 }
      );
      sent++;
    } catch (e) {
      failed++;
      /* 410 Gone = abonnement expiré → supprimer */
      if (e.statusCode === 410 || e.statusCode === 404) {
        expired.push(sub.endpoint);
      }
    }
  }));

  /* Nettoyer les abonnements expirés */
  if (expired.length > 0) {
    for (const ep of expired) {
      supabaseRequest('DELETE',
        '/push_subscriptions?endpoint=eq.' + encodeURIComponent(ep)).catch(() => {});
    }
  }

  return res.status(200).json({ ok: true, sent, failed, expired: expired.length });
};
