/**
 * POST /api/user/push-subscribe  — enregistrer un abonnement push
 * DELETE /api/user/push-subscribe — supprimer un abonnement push
 */
const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT }        = require('../_lib/auth');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = (req.headers['authorization'] || '').trim();
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = verifyJWT(token);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const body = await parseBody(req);

  /* ── DELETE : désabonnement ── */
  if (req.method === 'DELETE') {
    const { endpoint } = body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint requis' });
    try {
      await supabaseRequest('DELETE',
        '/push_subscriptions?endpoint=eq.' + encodeURIComponent(endpoint) +
        '&user_id=eq.' + encodeURIComponent(payload.userId));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  /* ── POST : abonnement ── */
  if (req.method === 'POST') {
    const { endpoint, p256dh, auth: authKey, device_hint } = body;
    if (!endpoint || !p256dh || !authKey) {
      return res.status(400).json({ error: 'endpoint, p256dh et auth requis' });
    }
    try {
      /* Upsert sur l'endpoint (peut changer de user_id si même navigateur) */
      await supabaseRequest('POST', '/push_subscriptions', {
        user_id:     payload.userId,
        endpoint,
        p256dh:      p256dh,
        auth:        authKey,
        device_hint: device_hint || null,
        updated_at:  new Date().toISOString(),
      });
      return res.status(201).json({ ok: true });
    } catch (e) {
      /* Conflit endpoint existant → PATCH */
      try {
        await supabaseRequest('PATCH',
          '/push_subscriptions?endpoint=eq.' + encodeURIComponent(endpoint),
          { user_id: payload.userId, p256dh, auth: authKey,
            device_hint: device_hint || null, updated_at: new Date().toISOString() });
        return res.status(200).json({ ok: true, updated: true });
      } catch (e2) {
        return res.status(500).json({ error: e2.message });
      }
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};
