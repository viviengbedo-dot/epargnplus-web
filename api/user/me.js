/**
 * GET  /api/user/me                              — profil utilisateur
 * PATCH /api/user/me                             — modifier nom/prénom ou PIN
 * GET  /api/user/me?resource=projects            — liste des projets
 * POST /api/user/me?resource=projects            — créer un projet
 * PATCH /api/user/me?resource=projects&id=<uuid> — modifier un projet
 * DELETE /api/user/me?resource=projects&id=<uuid>— supprimer un projet
 * GET  /api/user/me?resource=transactions        — historique transactions
 * POST /api/user/me?resource=transactions        — enregistrer un retrait
 * GET  /api/user/me?resource=notifications       — notifications in-app
 * PATCH /api/user/me?resource=notifications      — marquer tout lu (ou id spécifique)
 * GET  /api/user/me?resource=invitations         — invitations reçues
 * POST /api/user/me?resource=invitations&id=<id> — accepter/rejeter une invitation
 */

const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT, hashPin, verifyPin } = require('../_lib/auth');
const crypto = require('crypto');

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
    const qs = (req.url || '').split('?')[1] || '';
    const q  = {};
    qs.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { resource: q.resource || '', id: q.id || '' };
  }
}

/* ── Génère un token d'invitation sécurisé ── */
function generateInviteToken() {
  return crypto.randomBytes(16).toString('hex');
}
function generateInviteCode() {
  /* Code court 8 caractères alphanumérique */
  return crypto.randomBytes(4).toString('hex').toUpperCase();
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

  if (resource === 'projects')      return handleProjects(req, res, payload, resourceId);
  if (resource === 'transactions')  return handleTransactions(req, res, payload);
  if (resource === 'notifications') return handleNotifications(req, res, payload, resourceId);
  if (resource === 'invitations')   return handleInvitations(req, res, payload, resourceId);

  /* ══════════ ROUTE PROFIL ══════════ */
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const rows = await supabaseRequest('GET', '/users?id=eq.' + payload.userId + '&select=*');
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
    if (body.email)  patch.email  = String(body.email).trim().toLowerCase();

    if (body.new_pin !== undefined) {
      if (!body.current_pin) return res.status(400).json({ error: 'PIN actuel requis' });
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
  const APP_URL = process.env.APP_URL || 'https://www.epargnplus.com';

  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('GET',
        '/projects?user_id=eq.' + payload.userId + '&order=created_at.desc');
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const nom   = (body.nom   || '').trim();
    const cible = parseInt(body.cible, 10) || 0;
    if (!nom)         return res.status(400).json({ error: 'Nom du projet requis' });
    if (cible < 1000) return res.status(400).json({ error: 'Objectif minimum : 1 000' });

    let colorIdx = 0;
    try {
      const existing = await supabaseRequest('GET',
        '/projects?user_id=eq.' + payload.userId + '&select=id');
      if (Array.isArray(existing)) colorIdx = existing.length;
    } catch {}

    const isCollective = nom.startsWith('🤝');
    const inviteToken  = isCollective ? generateInviteToken() : null;
    const inviteCode   = isCollective ? generateInviteCode()  : null;
    const inviteExpiry = isCollective
      ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
      : null;

    const row = {
      user_id:     payload.userId,
      name:        nom,
      goal:        cible,
      actuel:      0,
      status:      'active',
      color:       body.color || colors[colorIdx % colors.length],
      duree:       body.duree || 'm12',
      ...(body.mise_mensuelle  ? { mise_mensuelle:   parseInt(body.mise_mensuelle, 10) }  : {}),
      ...(body.freq            ? { freq: body.freq }                                       : {}),
      ...(body.nb_membres      ? { nb_membres_cible: parseInt(body.nb_membres, 10) || 1 } : {}),
      ...(inviteToken ? {
        invite_token:      inviteToken,
        invite_code:       inviteCode,
        invite_expires_at: inviteExpiry,
        invite_active:     true,
        members_count:     1,
      } : {}),
    };

    try {
      const rows = await supabaseRequest('POST', '/projects', row);
      const created = Array.isArray(rows) ? rows[0] : rows;

      /* Créer l'entrée project_members pour le créateur */
      if (isCollective && created && created.id) {
        try {
          await supabaseRequest('POST', '/project_members', {
            project_id:   created.id,
            user_id:      payload.userId,
            role:         'creator',
            contribution: 0,
            status:       'active',
          });
        } catch (e) {
          console.warn('[user/me/projects] project_members creator:', e.message);
        }
      }

      const result = created || row;
      /* Ajouter l'URL d'invitation dans la réponse */
      if (inviteCode) {
        result.invite_url = APP_URL + '/join/' + inviteCode;
      }

      console.log('[user/me/projects] créé id=' + (result.id) + ' user=' + payload.userId);
      return res.status(201).json(result);
    } catch (e) {
      return res.status(500).json({ error: 'Erreur création projet : ' + e.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!resourceId) return res.status(400).json({ error: 'id requis' });
    const body  = await parseBody(req);
    const patch = {};
    if (body.actuel  !== undefined) patch.actuel = parseInt(body.actuel, 10);
    if (body.current !== undefined) patch.actuel = parseInt(body.current, 10);
    if (body.nom)                   patch.name   = String(body.nom).trim();
    if (body.cible)                 patch.goal   = parseInt(body.cible, 10);
    if (body.status)                patch.status = String(body.status);
    if (body.color)                 patch.color  = String(body.color);

    /* Régénérer le lien d'invitation si demandé */
    if (body.regenerate_invite) {
      patch.invite_token      = generateInviteToken();
      patch.invite_code       = generateInviteCode();
      patch.invite_expires_at = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      patch.invite_active     = true;
    }

    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });

    try {
      const updated = await supabaseRequest('PATCH',
        '/projects?id=eq.' + encodeURIComponent(resourceId) +
        '&user_id=eq.' + encodeURIComponent(payload.userId), patch);
      const result = Array.isArray(updated) ? updated[0] : updated;
      const APP_URL = process.env.APP_URL || 'https://www.epargnplus.com';
      if (result && result.invite_code) {
        result.invite_url = APP_URL + '/join/' + result.invite_code;
      }
      return res.status(200).json({ ok: true, ...(result || {}) });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur mise à jour projet : ' + e.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!resourceId) return res.status(400).json({ error: 'id requis' });
    try {
      await supabaseRequest('DELETE',
        '/projects?id=eq.' + encodeURIComponent(resourceId) + '&user_id=eq.' + payload.userId);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur suppression projet : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /projects' });
}

/* ── Historique des transactions ── */
async function handleTransactions(req, res, payload) {
  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('GET',
        '/transactions?user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,user_id,type,amount,operator,project_id,statut,status,' +
        'is_credit,label,currency,reference,created_at' +
        '&order=created_at.desc&limit=100');
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    const body      = await parseBody(req);
    const amount    = parseInt(body.amount, 10);
    const projectId = body.projectId || null;
    const operator  = (body.operator  || 'Mobile Money').trim();
    const type      = body.type       || 'withdrawal';
    const isCredit  = body.isCredit   !== undefined ? body.isCredit : false;

    if (!amount || amount < 1) return res.status(400).json({ error: 'Montant invalide' });

    const now = new Date().toISOString();
    const ref = 'RET-' + now.slice(0,10).replace(/-/g,'') + '-' +
      Math.random().toString(36).substr(2,6).toUpperCase();
    const label = body.label || (ref + ' · Retrait ' + operator);

    try {
      await supabaseRequest('POST', '/transactions', {
        user_id: payload.userId, type, amount, operator, is_credit: isCredit,
        label, project_id: projectId, statut: 'completed', status: 'success',
      });

      if (type === 'withdrawal') {
        try {
          const users = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=epargne');
          const currentEpargne = (Array.isArray(users) && users[0] && users[0].epargne)
            ? Number(users[0].epargne) : 0;
          await supabaseRequest('PATCH',
            '/users?id=eq.' + encodeURIComponent(payload.userId),
            { epargne: Math.max(0, currentEpargne - amount), updated_at: now });
        } catch (e) {}

        if (projectId) {
          try {
            await supabaseRequest('PATCH',
              '/projects?id=eq.' + encodeURIComponent(projectId) +
              '&user_id=eq.' + encodeURIComponent(payload.userId),
              { actuel: 0, updated_at: now });
          } catch (e) {}
        }
      }

      return res.status(201).json({ ok: true, ref });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur enregistrement : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

/* ── Notifications in-app ── */
async function handleNotifications(req, res, payload, resourceId) {
  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('GET',
        '/notifications?user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,type,title,body,data,read,created_at' +
        '&order=created_at.desc&limit=50');
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn('[user/me/notifications] GET:', e.message);
      return res.status(200).json([]);
    }
  }

  if (req.method === 'PATCH') {
    /* Marquer tout lu (ou une notification spécifique) */
    try {
      if (resourceId) {
        await supabaseRequest('PATCH',
          '/notifications?id=eq.' + encodeURIComponent(resourceId) +
          '&user_id=eq.' + encodeURIComponent(payload.userId),
          { read: true });
      } else {
        await supabaseRequest('PATCH',
          '/notifications?user_id=eq.' + encodeURIComponent(payload.userId) + '&read=eq.false',
          { read: true });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur mise à jour notifications : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /notifications' });
}

/* ── Invitations reçues ── */
async function handleInvitations(req, res, payload, resourceId) {
  if (req.method === 'GET') {
    try {
      /* Invitations où je suis le destinataire (par user_id ou par email) */
      const userRows = await supabaseRequest('GET',
        '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=email');
      const email = (Array.isArray(userRows) && userRows[0]) ? userRows[0].email : null;

      let invitations = [];
      try {
        invitations = await supabaseRequest('GET',
          '/project_invitations?invitee_user_id=eq.' + encodeURIComponent(payload.userId) +
          '&select=id,project_id,inviter_id,invitee_email,status,expires_at,created_at' +
          '&order=created_at.desc&limit=50');
        if (!Array.isArray(invitations)) invitations = [];
      } catch (e) {
        console.warn('[invitations] GET by user_id:', e.message);
      }

      /* Si email disponible, récupérer aussi celles adressées à l'email */
      if (email) {
        try {
          const byEmail = await supabaseRequest('GET',
            '/project_invitations?invitee_email=eq.' + encodeURIComponent(email) +
            '&invitee_user_id=is.null' +
            '&select=id,project_id,inviter_id,invitee_email,status,expires_at,created_at' +
            '&order=created_at.desc&limit=50');
          if (Array.isArray(byEmail)) {
            invitations = invitations.concat(byEmail);
          }
        } catch (e) {}
      }

      /* Enrichir avec les données du projet */
      const projectIds = [...new Set(invitations.map(i => i.project_id).filter(Boolean))];
      let projects = [];
      for (const pid of projectIds) {
        try {
          const pRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(pid) +
            '&select=id,name,goal,actuel,members_count,status');
          if (Array.isArray(pRows) && pRows[0]) projects.push(pRows[0]);
        } catch (e) {}
      }
      const projectMap = {};
      projects.forEach(p => { projectMap[p.id] = p; });
      invitations = invitations.map(i => ({
        ...i,
        project: projectMap[i.project_id] || null,
      }));

      return res.status(200).json(invitations);
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  /* POST : accepter ou refuser une invitation */
  if (req.method === 'POST') {
    if (!resourceId) return res.status(400).json({ error: 'id invitation requis' });
    const body   = await parseBody(req);
    const accept = body.accept === true || body.accept === 'true';

    try {
      /* Récupérer l'invitation */
      const invRows = await supabaseRequest('GET',
        '/project_invitations?id=eq.' + encodeURIComponent(resourceId) +
        '&select=id,project_id,inviter_id,invitee_user_id,invitee_email,status,expires_at');
      if (!Array.isArray(invRows) || !invRows[0]) {
        return res.status(404).json({ error: 'Invitation introuvable' });
      }
      const inv = invRows[0];

      if (inv.status !== 'pending') {
        return res.status(400).json({ error: 'Cette invitation n\'est plus en attente' });
      }
      if (new Date(inv.expires_at) < new Date()) {
        await supabaseRequest('PATCH',
          '/project_invitations?id=eq.' + encodeURIComponent(resourceId),
          { status: 'expired', responded_at: new Date().toISOString() });
        return res.status(400).json({ error: 'Cette invitation a expiré' });
      }

      const now = new Date().toISOString();

      if (accept) {
        /* Rejoindre le projet */
        await supabaseRequest('PATCH',
          '/project_invitations?id=eq.' + encodeURIComponent(resourceId),
          { status: 'accepted', responded_at: now, invitee_user_id: payload.userId });

        /* Ajouter dans project_members */
        try {
          await supabaseRequest('POST', '/project_members', {
            project_id:   inv.project_id,
            user_id:      payload.userId,
            role:         'member',
            contribution: 0,
            status:       'active',
          });
        } catch (e) {
          /* Peut échouer si déjà membre (contrainte UNIQUE) — ignorer */
          if (!e.message.includes('unique') && !e.message.includes('duplicate')) {
            console.warn('[invitations] project_members insert:', e.message);
          }
        }

        /* Mettre à jour members_count */
        try {
          const pRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(inv.project_id) + '&select=members_count');
          if (Array.isArray(pRows) && pRows[0]) {
            const newCount = (Number(pRows[0].members_count) || 1) + 1;
            await supabaseRequest('PATCH',
              '/projects?id=eq.' + encodeURIComponent(inv.project_id),
              { members_count: newCount });
          }
        } catch (e) {}

        /* Notification au créateur */
        try {
          const uRows = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=prenom,nom');
          const memberName = (Array.isArray(uRows) && uRows[0])
            ? (uRows[0].prenom || '') + ' ' + (uRows[0].nom || '')
            : 'Un membre';

          const pRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(inv.project_id) + '&select=name');
          const projectName = (Array.isArray(pRows) && pRows[0]) ? pRows[0].name : 'votre groupe';

          await supabaseRequest('POST', '/notifications', {
            user_id: inv.inviter_id,
            type:    'invitation',
            title:   '🎉 Nouveau membre !',
            body:    `${memberName.trim()} a rejoint "${projectName}".`,
            data:    { project_id: inv.project_id, user_id: payload.userId },
          });
        } catch (e) {}

        return res.status(200).json({ ok: true, action: 'accepted', project_id: inv.project_id });

      } else {
        /* Refuser */
        await supabaseRequest('PATCH',
          '/project_invitations?id=eq.' + encodeURIComponent(resourceId),
          { status: 'rejected', responded_at: now, invitee_user_id: payload.userId });

        /* Notification au créateur */
        try {
          await supabaseRequest('POST', '/notifications', {
            user_id: inv.inviter_id,
            type:    'invitation',
            title:   '❌ Invitation refusée',
            body:    'Un membre a décliné votre invitation à rejoindre le groupe.',
            data:    { project_id: inv.project_id },
          });
        } catch (e) {}

        return res.status(200).json({ ok: true, action: 'rejected' });
      }

    } catch (e) {
      return res.status(500).json({ error: 'Erreur traitement invitation : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /invitations' });
}
