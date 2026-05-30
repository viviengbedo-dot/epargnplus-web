/**
 * GET  /api/user/me                     — profil utilisateur
 * PATCH /api/user/me                    — modifier nom/prénom ou PIN
 * GET  /api/user/me?resource=projects   — liste des projets
 * POST /api/user/me?resource=projects   — créer un projet
 * PATCH /api/user/me?resource=projects&id=<uuid>  — modifier un projet
 * DELETE /api/user/me?resource=projects&id=<uuid> — supprimer un projet
 * GET  /api/user/me?resource=transactions — historique transactions
 *
 * Header requis : Authorization: Bearer <jwt>
 */

const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT, hashPin, verifyPin } = require('../_lib/auth');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function extractToken(req) {
  const auth = (req.headers['authorization'] || '').trim();
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

function getQuery(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return { resource: url.searchParams.get('resource') || '', id: url.searchParams.get('id') || '' };
  } catch {
    /* Fallback manuel */
    const qs = (req.url || '').split('?')[1] || '';
    const q = {};
    qs.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { resource: q.resource || '', id: q.id || '' };
  }
}

/* ══════════════════════════════════════════════════════════ */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawToken = extractToken(req);
  if (!rawToken) return res.status(401).json({ error: 'Non authentifié' });

  const payload = verifyJWT(rawToken);
  if (!payload) return res.status(401).json({ error: 'Session expirée — reconnectez-vous' });

  const { resource, id: resourceId } = getQuery(req);

  /* ══════════ ROUTE PROJETS ══════════ */
  if (resource === 'projects') {
    return handleProjects(req, res, payload, resourceId);
  }

  /* ══════════ ROUTE TRANSACTIONS ══════════ */
  if (resource === 'transactions') {
    return handleTransactions(req, res, payload);
  }

  /* ══════════ ROUTE PROFIL (défaut) ══════════ */
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const rows = await supabaseRequest('GET',
      '/users?id=eq.' + payload.userId + '&select=*');
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    const user = rows[0];
    const { pin_hash, ...safe } = user;

    if (req.method === 'GET') return res.status(200).json(safe);

    /* PATCH profil */
    const body  = await parseBody(req);
    const patch = {};

    if (body.prenom) patch.prenom = String(body.prenom).trim();
    if (body.nom)    patch.nom    = String(body.nom).trim();

    if (body.new_pin !== undefined) {
      if (!body.current_pin) {
        return res.status(400).json({ error: 'PIN actuel requis pour changer de PIN' });
      }
      if (!verifyPin(String(body.current_pin), pin_hash)) {
        return res.status(400).json({ error: 'PIN actuel incorrect' });
      }
      if (!/^\d{4}$/.test(body.new_pin)) {
        return res.status(400).json({ error: 'Le nouveau PIN doit contenir exactement 4 chiffres' });
      }
      patch.pin_hash = hashPin(String(body.new_pin));
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }
    patch.updated_at = new Date().toISOString();

    const updated = await supabaseRequest('PATCH', '/users?id=eq.' + payload.userId, patch);
    const u = (Array.isArray(updated) ? updated[0] : updated) || { ...safe, ...patch };
    const { pin_hash: _ph, ...safeUpdated } = u;
    return res.status(200).json(safeUpdated);

  } catch (err) {
    console.error('[user/me] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/* ── Gestion des projets ── */
async function handleProjects(req, res, payload, resourceId) {
  const colors = ['#0B1566','#22CC66','#3B82F6','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#EF4444'];

  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('GET',
        '/projects?user_id=eq.' + payload.userId + '&order=created_at.desc');
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn('[user/me/projects] GET:', e.message);
      return res.status(200).json([]); /* table peut ne pas exister */
    }
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const nom   = (body.nom   || '').trim();
    const cible = parseInt(body.cible, 10) || 0;
    if (!nom)         return res.status(400).json({ error: 'Nom du projet requis' });
    if (cible < 1000) return res.status(400).json({ error: 'Objectif minimum : 1 000' });

    /* Compter les projets existants pour la couleur */
    let colorIdx = 0;
    try {
      const existing = await supabaseRequest('GET', '/projects?user_id=eq.' + payload.userId + '&select=id');
      if (Array.isArray(existing)) colorIdx = existing.length;
    } catch {}

    const row = {
      user_id: payload.userId,
      name:    nom,
      goal:    cible,
      actuel:  0,
      status:  'active',
      color:   body.color  || colors[colorIdx % colors.length],
      duree:   body.duree  || '12',
    };
    try {
      const rows = await supabaseRequest('POST', '/projects', row);
      const created = Array.isArray(rows) ? rows[0] : rows;
      console.log('[user/me/projects] créé id=' + (created && created.id) + ' user=' + payload.userId);
      return res.status(201).json(created || row);
    } catch (e) {
      console.error('[user/me/projects] POST:', e.message);
      return res.status(500).json({ error: 'Erreur création projet : ' + e.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!resourceId) return res.status(400).json({ error: 'id requis' });
    const body  = await parseBody(req);
    /* Ne pas inclure updated_at automatiquement — la colonne peut ne pas exister */
    const patch = {};
    if (body.actuel  !== undefined) patch.actuel = parseInt(body.actuel, 10);
    if (body.current !== undefined) patch.actuel = parseInt(body.current, 10);
    if (body.nom)                   patch.name   = String(body.nom).trim();
    if (body.cible)                 patch.goal   = parseInt(body.cible, 10);
    if (body.status)                patch.status = String(body.status);
    if (body.color)                 patch.color  = String(body.color);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }
    try {
      await supabaseRequest('PATCH',
        '/projects?id=eq.' + encodeURIComponent(resourceId) +
        '&user_id=eq.' + encodeURIComponent(payload.userId), patch);
      console.log('[user/me/projects] PATCH id=' + resourceId + ' patch=' + JSON.stringify(patch));
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[user/me/projects] PATCH error:', e.message);
      return res.status(500).json({ error: 'Erreur mise à jour projet : ' + e.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!resourceId) return res.status(400).json({ error: 'id requis' });
    try {
      await supabaseRequest('DELETE',
        '/projects?id=eq.' + encodeURIComponent(resourceId) + '&user_id=eq.' + payload.userId);
      console.log('[user/me/projects] supprimé id=' + resourceId + ' user=' + payload.userId);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur suppression projet : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /projects' });
}

/* ── Historique des transactions + Enregistrement retrait ── */
async function handleTransactions(req, res, payload) {

  /* ── GET : historique ── */
  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('GET',
        '/transactions?user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,user_id,type,amount,operator,project_id,statut,status,is_credit,label,created_at' +
        '&order=created_at.desc&limit=100');
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn('[user/me/transactions] GET:', e.message);
      return res.status(200).json([]);
    }
  }

  /* ── POST : enregistrer un retrait validé ── */
  if (req.method === 'POST') {
    const body      = await parseBody(req);
    const amount    = parseInt(body.amount, 10);
    const projectId = body.projectId || null;
    const operator  = (body.operator  || 'Mobile Money').trim();
    const type      = body.type       || 'withdrawal';
    const isCredit  = body.isCredit   !== undefined ? body.isCredit : false;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const now = new Date().toISOString();
    const ref = 'RET-' + now.slice(0,10).replace(/-/g,'') + '-' +
      Math.random().toString(36).substr(2,6).toUpperCase();
    const label = body.label || (ref + ' · Retrait ' + operator);

    try {
      /* 1. Insérer la transaction */
      await supabaseRequest('POST', '/transactions', {
        user_id:    payload.userId,
        type,
        amount,
        operator,
        is_credit:  isCredit,
        label,
        project_id: projectId,
        statut:     'completed',
        status:     'success',
      });

      /* 2. Pour un retrait : déduire du solde + réinitialiser le projet */
      if (type === 'withdrawal') {
        try {
          const users = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=epargne');
          const currentEpargne = (Array.isArray(users) && users[0] && users[0].epargne) ? Number(users[0].epargne) : 0;
          const newEpargne     = Math.max(0, currentEpargne - amount);
          await supabaseRequest('PATCH',
            '/users?id=eq.' + encodeURIComponent(payload.userId),
            { epargne: newEpargne, updated_at: now });
        } catch (e) {
          console.warn('[user/me/transactions] balance deduction:', e.message);
        }

        if (projectId) {
          try {
            await supabaseRequest('PATCH',
              '/projects?id=eq.' + encodeURIComponent(projectId) +
              '&user_id=eq.' + encodeURIComponent(payload.userId),
              { actuel: 0, updated_at: now });
          } catch (e) {
            console.warn('[user/me/transactions] project reset:', e.message);
          }
        }
      }

      console.log('[user/me/transactions] POST type=' + type + ' amount=' + amount + ' user=' + payload.userId);
      return res.status(201).json({ ok: true, ref });

    } catch (e) {
      console.error('[user/me/transactions] POST error:', e.message);
      return res.status(500).json({ error: 'Erreur enregistrement : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
