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
  if (resource === 'settings')      return handleSettings(req, res);
  if (resource === 'tickets')       return handleTickets(req, res, payload, resourceId);
  if (resource === 'promos')        return handlePromos(req, res, payload);

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

/* ── Paramètres publics (merchant config) ── */
async function handleSettings(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  try {
    const rows = await supabaseRequest('GET', '/settings?key=eq.merchant_config&select=value');
    const cfg  = (Array.isArray(rows) && rows.length > 0) ? rows[0].value : null;
    return res.status(200).json({ ok: true, merchant_config: cfg });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur chargement paramètres : ' + err.message });
  }
}

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

      /* ── Détection et injection automatique du surplus ── */
      let surplusInjected = 0;
      let surplusMessage  = null;
      if (result && result.id && !isCollective) {
        try {
          /* 1. Solde actuel */
          const uRows = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=epargne');
          const solde = Number((Array.isArray(uRows) && uRows[0]) ? uRows[0].epargne : 0) || 0;

          /* 2. Capacité totale absorbée par les autres projets actifs */
          const allProjects = await supabaseRequest('GET',
            '/projects?user_id=eq.' + encodeURIComponent(payload.userId) +
            '&status=eq.active&id=neq.' + encodeURIComponent(result.id) +
            '&select=goal,actuel');
          const capaciteAbsorbee = Array.isArray(allProjects)
            ? allProjects.reduce((s, p) => s + Math.max(0, (p.goal || 0) - (p.actuel || 0)), 0)
            : 0;

          /* 3. Calcul surplus */
          const surplus = Math.max(0, solde - capaciteAbsorbee);

          if (surplus > 0) {
            const nouvelObjectif = Number(cible) || 0;
            const injection = Math.min(surplus, nouvelObjectif);

            if (injection > 0) {
              /* Mettre à jour actuel du nouveau projet */
              await supabaseRequest('PATCH',
                '/projects?id=eq.' + encodeURIComponent(result.id),
                { actuel: injection, has_funds: true });

              /* Créer transaction de réattribution */
              const refSurplus = 'SURPLUS-' + new Date().toISOString().slice(0,10).replace(/-/g,'') +
                '-' + Math.random().toString(36).substr(2,5).toUpperCase();
              await supabaseRequest('POST', '/transactions', {
                user_id:    payload.userId,
                type:       'reattribution',
                amount:     injection,
                is_credit:  true,
                project_id: result.id,
                statut:     'completed',
                status:     'success',
                label:      refSurplus + ' · Réattribution automatique excédent',
              });

              /* Logger */
              try {
                await supabaseRequest('POST', '/surplus_log', {
                  user_id:        payload.userId,
                  project_id:     result.id,
                  surplus_amount: surplus,
                  injected_amount:injection,
                  remaining:      surplus - injection,
                  status:         'auto',
                });
              } catch {}

              surplusInjected = injection;
              result.actuel   = injection;
              result.has_funds = true;
              surplusMessage = 'Votre solde disponible non affecté (' +
                injection.toLocaleString('fr-FR') + ' GNF) a été automatiquement injecté dans ce projet.';
            }
          }
        } catch (surplusErr) {
          console.warn('[projects/create] surplus detection:', surplusErr.message);
        }
      }

      return res.status(201).json({
        ...result,
        surplus_injected: surplusInjected,
        surplus_message: surplusMessage,
      });
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
      /* ── Récupérer le projet ── */
      const projRows = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(resourceId) +
        '&user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,name,actuel,goal,status,has_funds&limit=1');
      if (!Array.isArray(projRows) || !projRows[0]) {
        return res.status(404).json({ error: 'Projet introuvable' });
      }
      const proj = projRows[0];

      const isCollective = String(proj.name || '').startsWith('🤝');

      /* ── Projet individuel avec fonds : BLOQUÉ ── */
      if (!isCollective) {
        /* Vérifier via has_funds ET actuel ET transactions */
        const hasFunds = proj.has_funds || (proj.actuel > 0);
        let hasTransactions = false;
        if (!hasFunds) {
          try {
            const txns = await supabaseRequest('GET',
              '/transactions?project_id=eq.' + encodeURIComponent(resourceId) +
              '&statut=eq.completed&is_credit=eq.true&select=id&limit=1');
            hasTransactions = Array.isArray(txns) && txns.length > 0;
          } catch {}
        }
        if (hasFunds || hasTransactions) {
          return res.status(403).json({
            error: 'Ce projet ne peut plus être supprimé car des fonds y sont déjà associés.',
            code: 'PROJECT_HAS_FUNDS',
            actions: ['close', 'archive'],
          });
        }
      }

      /* ── Projet collectif : demande de suppression uniquement ── */
      if (isCollective) {
        if (proj.actuel > 0 || proj.has_funds) {
          /* Marquer comme delete_requested — admin devra valider */
          await supabaseRequest('PATCH',
            '/projects?id=eq.' + encodeURIComponent(resourceId),
            { status: 'delete_requested' });
          return res.status(200).json({
            ok: true,
            action: 'delete_requested',
            message: 'Demande de clôture envoyée. L\'administrateur traitera les remboursements.',
          });
        }
      }

      /* ── Suppression autorisée (pas de fonds) ── */
      try { await supabaseRequest('DELETE',
        '/transactions?project_id=eq.' + encodeURIComponent(resourceId)); } catch {}
      try { await supabaseRequest('DELETE',
        '/project_members?project_id=eq.' + encodeURIComponent(resourceId)); } catch {}
      await supabaseRequest('DELETE',
        '/projects?id=eq.' + encodeURIComponent(resourceId) + '&user_id=eq.' + payload.userId);

      console.log('[projects/delete] id=' + resourceId + ' user=' + payload.userId);
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
          if (amount > currentEpargne) {
            return res.status(400).json({ error: 'Solde insuffisant. Votre épargne disponible est de ' + currentEpargne + '.' });
          }
          await supabaseRequest('PATCH',
            '/users?id=eq.' + encodeURIComponent(payload.userId),
            { epargne: currentEpargne - amount, updated_at: now });
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

/* ── Tickets support utilisateur ── */
async function handleTickets(req, res, payload, resourceId) {
  /* GET — liste des tickets de l'utilisateur */
  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('GET',
        '/support_tickets?user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,subject,message,status,priority,category,admin_reply,resolved_at,created_at,updated_at' +
        '&order=created_at.desc&limit=50');
      const tickets = Array.isArray(rows) ? rows : [];
      /* Pour chaque ticket, récupérer les réponses */
      const result = [];
      for (const t of tickets) {
        let replies = [];
        try {
          replies = await supabaseRequest('GET',
            '/ticket_replies?ticket_id=eq.' + encodeURIComponent(t.id) +
            '&select=id,message,is_admin,created_at&order=created_at.asc');
          if (!Array.isArray(replies)) replies = [];
        } catch (e) { /* ignore */ }
        result.push({ ...t, replies });
      }
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ error: 'Erreur chargement tickets : ' + e.message });
    }
  }

  /* POST — créer un ticket */
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const { subject, message: msg, category } = body;
    if (!subject || !msg) return res.status(400).json({ error: 'subject et message requis' });
    try {
      const categories = ['general','depot','retrait','kyc','compte','technique','autre'];
      const cat = categories.includes(category) ? category : 'general';
      const created = await supabaseRequest('POST', '/support_tickets', {
        user_id: payload.userId,
        subject: String(subject).slice(0, 200),
        message: String(msg).slice(0, 2000),
        category: cat,
        status: 'open',
        priority: 'normal',
      });
      const ticket = Array.isArray(created) ? created[0] : created;
      return res.status(201).json({ ok: true, ticket });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur création ticket : ' + e.message });
    }
  }

  /* PATCH — ajouter une réponse utilisateur */
  if (req.method === 'PATCH' && resourceId) {
    const body = await parseBody(req);
    const { message: replyMsg } = body;
    if (!replyMsg) return res.status(400).json({ error: 'message requis' });
    try {
      /* Vérifier ownership */
      const tRows = await supabaseRequest('GET',
        '/support_tickets?id=eq.' + encodeURIComponent(resourceId) +
        '&user_id=eq.' + encodeURIComponent(payload.userId) + '&select=id,status');
      if (!Array.isArray(tRows) || !tRows[0]) {
        return res.status(404).json({ error: 'Ticket introuvable' });
      }
      if (tRows[0].status === 'closed') {
        return res.status(400).json({ error: 'Ce ticket est clôturé' });
      }
      await supabaseRequest('POST', '/ticket_replies', {
        ticket_id: resourceId, author_id: payload.userId, message: String(replyMsg).slice(0, 2000), is_admin: false,
      });
      await supabaseRequest('PATCH', '/support_tickets?id=eq.' + encodeURIComponent(resourceId), {
        status: 'in_progress', updated_at: new Date().toISOString(),
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur réponse ticket : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /tickets' });
}

/* ── Application d'un code promo ── */
async function handlePromos(req, res, payload) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  const body = await parseBody(req);
  const { code } = body;
  if (!code) return res.status(400).json({ error: 'code requis' });

  try {
    /* Récupérer le promo */
    const rows = await supabaseRequest('GET',
      '/promo_codes?code=eq.' + encodeURIComponent(code.toUpperCase().trim()) +
      '&select=id,code,type,value,currency,max_uses,uses_count,target_country,active,expires_at');
    if (!Array.isArray(rows) || !rows[0]) {
      return res.status(404).json({ error: 'Code promo invalide ou inexistant.' });
    }
    const promo = rows[0];

    /* Vérifications */
    if (!promo.active) return res.status(400).json({ error: 'Ce code promo est désactivé.' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Ce code promo a expiré.' });
    }
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return res.status(400).json({ error: 'Ce code promo a atteint sa limite d\'utilisation.' });
    }

    /* Vérifier pays si ciblé */
    if (promo.target_country) {
      const uRows = await supabaseRequest('GET',
        '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=country');
      const userCountry = (Array.isArray(uRows) && uRows[0]) ? uRows[0].country : null;
      if (userCountry !== promo.target_country) {
        return res.status(400).json({ error: 'Ce code promo n\'est pas disponible dans votre pays.' });
      }
    }

    /* Vérifier utilisation déjà faite */
    const usedRows = await supabaseRequest('GET',
      '/promo_uses?promo_id=eq.' + encodeURIComponent(promo.id) +
      '&user_id=eq.' + encodeURIComponent(payload.userId) + '&select=id');
    if (Array.isArray(usedRows) && usedRows.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà utilisé ce code promo.' });
    }

    /* Appliquer le bonus */
    let bonusAmount = 0;
    if (promo.type === 'bonus_deposit') {
      bonusAmount = Number(promo.value) || 0;
      if (bonusAmount > 0) {
        const uRows = await supabaseRequest('GET',
          '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=id,epargne');
        if (Array.isArray(uRows) && uRows[0]) {
          const newEp = (Number(uRows[0].epargne) || 0) + bonusAmount;
          await supabaseRequest('PATCH', '/users?id=eq.' + encodeURIComponent(payload.userId),
            { epargne: newEp, updated_at: new Date().toISOString() });
          await supabaseRequest('POST', '/transactions', {
            user_id: payload.userId, type: 'bonus', amount: bonusAmount,
            statut: 'completed', status: 'success', is_credit: true,
            label: 'Bonus promo — ' + promo.code,
            currency: promo.currency || 'GNF',
          });
        }
      }
    }

    /* Enregistrer l'utilisation */
    await supabaseRequest('POST', '/promo_uses', {
      promo_id: promo.id, user_id: payload.userId, amount: bonusAmount,
    });

    /* Incrémenter le compteur */
    await supabaseRequest('PATCH', '/promo_codes?id=eq.' + encodeURIComponent(promo.id), {
      uses_count: promo.uses_count + 1,
    });

    console.log('[promos] user=' + payload.userId + ' code=' + promo.code + ' bonus=' + bonusAmount);
    return res.status(200).json({
      ok: true, promo: { code: promo.code, type: promo.type, value: promo.value, currency: promo.currency },
      bonusAmount,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erreur application promo : ' + err.message });
  }
}
