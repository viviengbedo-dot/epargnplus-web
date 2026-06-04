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
const { isProjectCollective, hasJoinedMembers } = require('../_lib/project');
const { trigger: emailTrigger } = require('../_lib/email');
const { logAudit, checkThrottle, recordFail, resetThrottle } = require('../_lib/security');
const { decodeDataUrl: storageDecode, uploadObject: storageUpload } = require('../_lib/storage');
function extFromMime(m) { return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[m]) || '.jpg'; }
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

  if (resource === 'projects')         return handleProjects(req, res, payload, resourceId);
  if (resource === 'transactions')     return handleTransactions(req, res, payload);
  if (resource === 'notifications')    return handleNotifications(req, res, payload, resourceId);
  if (resource === 'invitations')      return handleInvitations(req, res, payload, resourceId);
  if (resource === 'invitations_sent') return handleInvitationsSent(req, res, payload, resourceId);
  if (resource === 'invitations_send') return handleInvitationsSend(req, res, payload);
  if (resource === 'invitations_resend') return handleInvitationsResend(req, res, payload);
  if (resource === 'my_groups')        return handleMyGroups(req, res, payload);
  if (resource === 'project_history')  return handleProjectHistory(req, res, payload, resourceId);
  if (resource === 'kyc')              return handleKyc(req, res, payload);
  if (resource === 'settings')         return handleSettings(req, res);
  if (resource === 'tickets')          return handleTickets(req, res, payload, resourceId);
  if (resource === 'promos')           return handlePromos(req, res, payload);
  if (resource === 'communities')      return handleCommunities(req, res, payload, resourceId);
  if (resource === 'community')        return handleCommunityDetail(req, res, payload, resourceId);
  if (resource === 'community_feed')   return handleCommunityFeed(req, res, payload, resourceId);
  if (resource === 'gamification')     return handleGamification(req, res, payload);
  if (resource === 'challenges')       return handleChallenges(req, res, payload, resourceId);
  if (resource === 'challenge')        return handleChallengeDetail(req, res, payload, resourceId);
  if (resource === 'activity')         return handleActivity(req, res, payload);

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

    if (req.method === 'GET') {
      /* Garantir un code de parrainage (vieux comptes sans code) */
      if (!safe.code_parrain) {
        const prefix = String(safe.prenom || 'USR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
        const code = prefix + Math.random().toString(36).slice(2, 6).toUpperCase();
        try {
          await supabaseRequest('PATCH', '/users?id=eq.' + payload.userId, { code_parrain: code });
          safe.code_parrain = code;
        } catch (e) {}
      }
      return res.status(200).json(safe);
    }

    /* ── DELETE : suppression du compte + données associées ── */
    if (req.method === 'DELETE') {
      const uid = payload.userId;
      /* Supprimer les données dépendantes (best-effort) puis le compte */
      const cleanups = [
        '/transactions?user_id=eq.' + uid,
        '/project_members?user_id=eq.' + uid,
        '/notifications?user_id=eq.' + uid,
        '/project_invitations?inviter_id=eq.' + uid,
        '/project_invitations?invitee_user_id=eq.' + uid,
        '/promo_uses?user_id=eq.' + uid,
        '/projects?user_id=eq.' + uid,
      ];
      for (const path of cleanups) {
        try { await supabaseRequest('DELETE', path); } catch (e) { /* continue */ }
      }
      try {
        await supabaseRequest('DELETE', '/users?id=eq.' + uid);
      } catch (e) {
        return res.status(500).json({ error: 'Erreur suppression du compte : ' + e.message });
      }
      console.log('[user/me] compte supprimé user=' + uid);
      await logAudit(uid, 'account_deleted', {}, req);
      return res.status(200).json({ ok: true, deleted: true });
    }

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
      contribution_type: body.contribution_type || 'free',
      min_contribution_amount: (body.contribution_type === 'minimal_cap')
        ? (parseInt(body.min_contribution_amount, 10) || 0)
        : 0,
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
    if (body.color)                 patch.color  = String(body.color);

    /* ── Garde-fou : 'actuel' ne peut JAMAIS dépasser l'objectif effectif ──
       (objectif × 1,01 = marge Epargn+). Empêche un client de gonfler le
       montant d'un projet via un PATCH direct (cause des sur-financements). */
    if (patch.actuel !== undefined) {
      if (isNaN(patch.actuel) || patch.actuel < 0) patch.actuel = 0;
      try {
        const gRows = await supabaseRequest('GET',
          '/projects?id=eq.' + encodeURIComponent(resourceId) +
          '&user_id=eq.' + encodeURIComponent(payload.userId) +
          '&select=goal&limit=1');
        if (Array.isArray(gRows) && gRows[0]) {
          const maxActuel = Math.round((Number(gRows[0].goal) || 0) * 1.01);
          if (maxActuel > 0 && patch.actuel > maxActuel) patch.actuel = maxActuel;
        }
      } catch (e) {}
    }

    /* ── Garde-fou : l'objectif ne peut PAS être réduit sous le montant déjà
       déposé. Empêche de créer un sur-financement en baissant la cible
       (ex : projet à 25M rempli, puis cible baissée à 2M). */
    if (patch.goal !== undefined) {
      if (isNaN(patch.goal) || patch.goal < 1000) {
        return res.status(400).json({ error: 'Objectif invalide (minimum 1 000).' });
      }
      try {
        const aRows = await supabaseRequest('GET',
          '/projects?id=eq.' + encodeURIComponent(resourceId) +
          '&user_id=eq.' + encodeURIComponent(payload.userId) +
          '&select=actuel&limit=1');
        if (Array.isArray(aRows) && aRows[0]) {
          const actuel = Number(aRows[0].actuel) || 0;
          if (patch.goal < actuel) {
            return res.status(400).json({
              error: 'L\'objectif ne peut pas être inférieur au montant déjà épargné (' +
                actuel.toLocaleString('fr-FR') + ' GNF).',
              code: 'GOAL_BELOW_SAVED',
              actuel: actuel,
            });
          }
        }
      } catch (e) {}
    }

    /* ── Changement de statut : garde-fou anti-contournement ──
       Un utilisateur ne peut JAMAIS clôturer ('closed') un projet COLLECTIF
       lui-même. Toute tentative est convertie en demande de clôture admin. */
    if (body.status !== undefined) {
      const requested = String(body.status);
      /* Charger le projet pour savoir s'il est collectif */
      let proj = null;
      try {
        const pRows = await supabaseRequest('GET',
          '/projects?id=eq.' + encodeURIComponent(resourceId) +
          '&user_id=eq.' + encodeURIComponent(payload.userId) +
          '&select=id,name,invite_code,invite_token,members_count&limit=1');
        if (Array.isArray(pRows) && pRows[0]) proj = pRows[0];
      } catch (e) {}

      if (proj && isProjectCollective(proj)) {
        /* Collectif : la DEMANDE de clôture est persistée en 'pending_close'
           (seule valeur de demande autorisée par projects_status_check).
           'active' = annulation. Toute autre demande de clôture/suppression
           est convertie en 'pending_close'. */
        if (['closed', 'delete_requested', 'closure_requested', 'pending_close'].includes(requested)) {
          patch.status = 'pending_close';
        } else if (requested === 'active') {
          patch.status = 'active';
        }
        /* tout autre statut est ignoré pour un collectif */
      } else {
        /* Projet individuel : statut libre */
        patch.status = requested;
      }
    }

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
      /* ── Récupérer le projet (avec TOUS les signaux collectif) ── */
      const projRows = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(resourceId) +
        '&user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,name,actuel,goal,status,has_funds,members_count,invite_code,invite_token&limit=1');
      if (!Array.isArray(projRows) || !projRows[0]) {
        return res.status(404).json({ error: 'Projet introuvable' });
      }
      const proj = projRows[0];

      /* ── Calcul des signaux (source de vérité unique) ── */
      const collective   = isProjectCollective(proj);
      const joinedMembers = hasJoinedMembers(proj);

      /* Présence de fonds : has_funds OU actuel OU transactions créditées */
      let hasFunds = proj.has_funds || (proj.actuel > 0);
      if (!hasFunds) {
        try {
          const txns = await supabaseRequest('GET',
            '/transactions?project_id=eq.' + encodeURIComponent(resourceId) +
            '&statut=eq.completed&is_credit=eq.true&select=id&limit=1');
          hasFunds = Array.isArray(txns) && txns.length > 0;
        } catch {}
      }

      /* ═══════════════════════════════════════════════════════════
         RÈGLES DE SUPPRESSION (déterministes)
         ───────────────────────────────────────────────────────────
         COLLECTIF + (membres rejoints OU fonds) → demande clôture admin
         COLLECTIF vide (créateur seul, 0 fonds)  → suppression directe
         INDIVIDUEL avec fonds                    → bloqué
         INDIVIDUEL sans fonds                    → suppression directe
         ═══════════════════════════════════════════════════════════ */

      if (collective && (joinedMembers || hasFunds)) {
        /* Projet collectif actif → fermeture gérée par l'admin.
           Statut 'pending_close' (seule valeur de demande autorisée par la
           contrainte projects_status_check). */
        try {
          await supabaseRequest('PATCH',
            '/projects?id=eq.' + encodeURIComponent(resourceId),
            { status: 'pending_close' });
        } catch (e) {
          console.error('[projects/delete pending_close]:', e.message);
          return res.status(500).json({ error: 'Erreur demande de clôture : ' + e.message });
        }
        return res.status(200).json({
          ok: true,
          action: 'closure_requested',
          message: 'Demande de fermeture envoyée à l\'administrateur. Le projet restera visible jusqu\'à clôture.',
          code: 'CLOSURE_REQUESTED',
        });
      }

      if (!collective && hasFunds) {
        /* Projet individuel avec fonds → bloqué (clôturer ou archiver) */
        return res.status(403).json({
          error: 'Ce projet ne peut plus être supprimé car des fonds y sont déjà associés.',
          code: 'PROJECT_HAS_FUNDS',
          actions: ['close', 'archive'],
        });
      }

      /* ── Suppression directe autorisée (individuel vide OU collectif vide) ── */
      try { await supabaseRequest('DELETE',
        '/project_invitations?project_id=eq.' + encodeURIComponent(resourceId)); } catch {}
      try { await supabaseRequest('DELETE',
        '/transactions?project_id=eq.' + encodeURIComponent(resourceId)); } catch {}
      try { await supabaseRequest('DELETE',
        '/project_members?project_id=eq.' + encodeURIComponent(resourceId)); } catch {}
      await supabaseRequest('DELETE',
        '/projects?id=eq.' + encodeURIComponent(resourceId) + '&user_id=eq.' + payload.userId);

      console.log('[projects/delete] id=' + resourceId + ' user=' + payload.userId +
        ' collective=' + collective);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur suppression projet : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /projects' });
}

/* Date de fin d'un projet : stockée dans `duree` au format ISO (ex: 2026-12-31).
   Les valeurs héritées ('m12', '12', '52w'…) ne sont pas des dates → null. */
function parseProjectDeadline(duree) {
  if (!duree || typeof duree !== 'string' || duree.indexOf('-') === -1) return null;
  const d = new Date(duree);
  return isNaN(d.getTime()) ? null : d;
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
      /* ── Retrait d'un projet : le client reçoit le CAPITAL (objectif),
         la plateforme garde la marge de 1% (actuel − objectif).
         Les retraits démarrent en 'pending' — l'admin confirme après
         avoir envoyé le Mobile Money (cf. confirm-withdrawal). ── */
      const isWithdrawal = (type === 'withdrawal');
      let payout = amount;   /* montant réellement reçu par le client */
      let deduct = amount;   /* montant qui quitte le solde (epargne) */
      let margin = 0;

      if (isWithdrawal) {
        /* ── PIN de transaction : ré-authentification obligatoire ── */
        const txKey = 'txpin:' + payload.userId;
        const pinGate = await checkThrottle(txKey);
        if (pinGate.blocked) {
          return res.status(429).json({ error: 'Trop de tentatives de PIN. Réessayez dans ' + Math.ceil((pinGate.retryAfter || 900) / 60) + ' minutes.' });
        }
        const txPin = String(body.pin || body.transaction_pin || '');
        let uPin = null;
        try {
          const uRows = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=pin_hash&limit=1');
          uPin = (Array.isArray(uRows) && uRows[0]) ? uRows[0].pin_hash : null;
        } catch (e) {}
        if (!uPin) return res.status(401).json({ error: 'Compte introuvable.' });
        if (!txPin || !verifyPin(txPin, uPin)) {
          await recordFail(txKey);
          await logAudit(payload.userId, 'withdrawal_pin_fail', {}, req);
          return res.status(401).json({ error: 'Code PIN incorrect. Saisissez votre PIN pour valider le retrait.' });
        }
        await resetThrottle(txKey);

        /* ── Détection de fraude : vélocité des retraits (24 h) ── */
        try {
          const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const recent = await supabaseRequest('GET',
            '/transactions?user_id=eq.' + encodeURIComponent(payload.userId) +
            '&type=eq.withdrawal&created_at=gte.' + encodeURIComponent(since) + '&select=statut');
          const arr = Array.isArray(recent) ? recent : [];
          const pendingCount = arr.filter(t => t.statut === 'pending').length;
          if (pendingCount >= 3) {
            await logAudit(payload.userId, 'withdrawal_blocked', { reason: 'too_many_pending' }, req);
            return res.status(429).json({ error: 'Vous avez déjà 3 retraits en attente. Patientez qu\'ils soient validés.' });
          }
          if (arr.length >= 10) {
            await logAudit(payload.userId, 'withdrawal_blocked', { reason: 'velocity_24h' }, req);
            return res.status(429).json({ error: 'Trop de demandes de retrait en 24 h. Réessayez plus tard.' });
          }
        } catch (e) {}

        /* ── Règle de retrait : uniquement depuis un projet atteint à 100 %
           ET dont la date de fin est arrivée. Vérifié côté serveur. ── */
        if (!projectId) {
          return res.status(400).json({ error: 'Le retrait n\'est possible que depuis un projet atteint à 100 % à sa date de fin.' });
        }
        let pRow = null;
        try {
          const pRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(projectId) +
            '&user_id=eq.' + encodeURIComponent(payload.userId) +
            '&select=actuel,goal,duree&limit=1');
          pRow = (Array.isArray(pRows) && pRows[0]) ? pRows[0] : null;
        } catch (e) {
          return res.status(500).json({ error: 'Erreur de vérification du projet : ' + e.message });
        }
        if (!pRow) return res.status(404).json({ error: 'Projet introuvable.' });

        const projActuel = Number(pRow.actuel) || 0;
        const projGoal   = Number(pRow.goal)   || 0;

        /* Condition 1 : objectif atteint à 100 % */
        if (projGoal <= 0 || projActuel < projGoal) {
          return res.status(400).json({ error: 'Retrait indisponible : l\'objectif du projet n\'est pas atteint à 100 %.' });
        }
        /* Condition 2 : date de fin du projet atteinte */
        const deadline = parseProjectDeadline(pRow.duree);
        if (deadline && Date.now() < deadline.getTime()) {
          return res.status(400).json({ error: 'Retrait indisponible : la date de fin du projet n\'est pas encore atteinte.' });
        }

        /* Capital rendu = objectif ; la marge de 1 % (actuel − objectif) reste à la plateforme */
        payout = Math.min(projActuel, projGoal);
        deduct = projActuel;
        margin = Math.max(0, projActuel - payout);
      }

      if (isWithdrawal) {
        const users = await supabaseRequest('GET',
          '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=epargne,email,prenom,country,phone');
        const _u = (Array.isArray(users) && users[0]) ? users[0] : null;
        const currentEpargne = (_u && _u.epargne) ? Number(_u.epargne) : 0;
        /* Sécurité : solde insuffisant → refus (empêche le découvert) */
        if (deduct > currentEpargne) {
          return res.status(400).json({ error: 'Solde insuffisant. Votre épargne disponible est de ' + currentEpargne + '.' });
        }
        const _newSolde = currentEpargne - deduct;
        /* Débit immédiat pour empêcher le double-retrait, confirmation admin ensuite */
        await supabaseRequest('PATCH',
          '/users?id=eq.' + encodeURIComponent(payload.userId),
          { epargne: _newSolde, updated_at: now });

        /* ── Email automatique : retrait en cours de traitement ── */
        if (_u && _u.email) {
          const cur = ({ gn:'GNF', bj:'FCFA', ci:'FCFA', cn:'CNY' })[_u.country] || 'GNF';
          emailTrigger('withdrawal_requested', payload.userId, {
            prenom:       _u.prenom || '',
            montant:      Number(payout).toLocaleString('fr-FR') + ' ' + cur,
            phoneRetrait: (body.phoneRetrait || _u.phone || ''),
            phone:        _u.phone || '',
            nouveauSolde: Number(_newSolde).toLocaleString('fr-FR') + ' ' + cur,
          }, _u.email).catch(() => {});
        }

        /* Marge Epargn+ (1%) : retenue implicitement — le solde est débité du
           montant total du projet alors que le client ne reçoit que le capital.
           Pas de transaction 'fee' (type non autorisé par la contrainte DB). */

        if (projectId) {
          await supabaseRequest('PATCH',
            '/projects?id=eq.' + encodeURIComponent(projectId) +
            '&user_id=eq.' + encodeURIComponent(payload.userId),
            { actuel: 0, updated_at: now });
        }
      }

      /* Transaction : retrait = pending (confirmation admin), sinon completed.
         Montant enregistré = montant reçu par le client (payout). */
      await supabaseRequest('POST', '/transactions', {
        user_id: payload.userId, type, amount: payout, operator, is_credit: isCredit,
        label, project_id: projectId,
        statut: isWithdrawal ? 'pending' : 'completed',
        status: isWithdrawal ? 'pending' : 'success',
      });

      if (isWithdrawal) {
        await logAudit(payload.userId, 'withdrawal_request',
          { ref, amount: payout, project_id: projectId, operator }, req);
      }
      return res.status(201).json({ ok: true, ref, payout, margin });
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

/* ── Invitations envoyées par l'utilisateur ── */
async function handleInvitationsSent(req, res, payload) {
  if (req.method === 'GET') {
    try {
      /* Récupérer les invitations envoyées par cet utilisateur */
      const { projectId } = getQuery(req);
      let query = '/project_invitations?inviter_id=eq.' + encodeURIComponent(payload.userId);
      if (projectId) query += '&project_id=eq.' + encodeURIComponent(projectId);
      query += '&select=id,project_id,invitee_email,invitee_phone,invitee_user_id,status,created_at,responded_at,expires_at,viewed_at' +
               '&order=created_at.desc&limit=100';

      let invitations = await supabaseRequest('GET', query);
      if (!Array.isArray(invitations)) invitations = [];

      /* Enrichir avec les noms des projets et des invités */
      const projectIds = [...new Set(invitations.map(i => i.project_id).filter(Boolean))];
      let projects = {};
      for (const pid of projectIds) {
        try {
          const pRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(pid) + '&select=id,name');
          if (Array.isArray(pRows) && pRows[0]) projects[pRows[0].id] = pRows[0].name;
        } catch (e) {}
      }

      const userIds = [...new Set(invitations.map(i => i.invitee_user_id).filter(Boolean))];
      let users = {};
      for (const uid of userIds) {
        try {
          const uRows = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(uid) + '&select=id,prenom');
          if (Array.isArray(uRows) && uRows[0]) users[uRows[0].id] = uRows[0].prenom;
        } catch (e) {}
      }

      invitations = invitations.map(i => ({
        ...i,
        project_name: projects[i.project_id] || null,
        invitee_name: (i.invitee_user_id ? users[i.invitee_user_id] : null) || null,
        /* Calculer le statut affichable */
        display_status: (() => {
          if (i.status === 'accepted') return '✅ Acceptée';
          if (i.status === 'rejected') return '❌ Refusée';
          if (i.status === 'expired' || new Date(i.expires_at) < new Date()) return '⏰ Expirée';
          if (i.viewed_at && !i.responded_at) return '🔗 Vue';
          return '📨 Envoyée';
        })(),
      }));

      return res.status(200).json(invitations);
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /invitations_sent' });
}

/* ── Envoyer une invitation et la gérer (resend, revoke) ── */
async function handleInvitationsSend(req, res, payload) {
  const body = await parseBody(req);

  if (req.method === 'POST') {
    /* POST : envoyer une nouvelle invitation */
    const { projectId, email, phone, message } = body;
    if (!projectId || (!email && !phone)) {
      return res.status(400).json({ error: 'projectId et (email ou phone) requis' });
    }

    try {
      /* Vérifier que l'utilisateur est le créateur du projet */
      const projRows = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(projectId) +
        '&user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,name,goal,invite_active,invite_code,members_count');
      if (!Array.isArray(projRows) || !projRows[0]) {
        return res.status(403).json({ error: 'Vous n\'êtes pas le créateur de ce projet' });
      }
      const proj = projRows[0];

      if (!proj.invite_active) {
        return res.status(400).json({ error: 'Les invitations sont fermées pour ce projet' });
      }

      /* Vérifier que cette personne n'est pas déjà invitée ou membre */
      let query = '/project_invitations?project_id=eq.' + encodeURIComponent(projectId) +
                  '&status=eq.pending';
      if (email) query += '&invitee_email=eq.' + encodeURIComponent(email);
      else query += '&invitee_phone=eq.' + encodeURIComponent(phone);
      query += '&select=id&limit=1';

      let existingInv = [];
      try { existingInv = await supabaseRequest('GET', query); } catch (e) {}
      if (Array.isArray(existingInv) && existingInv.length > 0) {
        return res.status(400).json({ error: 'Cette personne a déjà une invitation en attente' });
      }

      /* Créer l'invitation */
      const token = generateInviteToken();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      const invResp = await supabaseRequest('POST', '/project_invitations', {
        project_id: projectId,
        inviter_id: payload.userId,
        invitee_email: email || null,
        invitee_phone: phone || null,
        token: token,
        status: 'pending',
        expires_at: expiresAt,
        created_at: now,
      });

      const inv = Array.isArray(invResp) ? invResp[0] : invResp;
      const invitationId = inv.id;
      const inviteUrl = 'https://www.epargnplus.com/join/' + (proj.invite_code || token);

      /* Envoyer l'email/SMS via api/invite/send */
      try {
        await fetch(process.env.API_URL + '/invite/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectId,
            tontineName: proj.name,
            email: email || null,
            phone: phone || null,
            goal: proj.goal,
            membersCount: proj.members_count,
            creatorName: payload.userId,
          }),
        });
      } catch (e) {
        console.warn('[invitations_send] email send failed:', e.message);
      }

      console.log('[invitations_send] invitationId=' + invitationId + ' project=' + projectId);
      return res.status(201).json({
        ok: true,
        invitationId: invitationId,
        inviteUrl: inviteUrl,
        inviteCode: proj.invite_code,
        email: email,
        phone: phone,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur envoi invitation : ' + e.message });
    }
  }

  if (req.method === 'POST' && body.action === 'resend') {
    /* Renvoyer une invitation existante */
    const { invitationId } = body;
    if (!invitationId) {
      return res.status(400).json({ error: 'invitationId requis' });
    }

    try {
      const invRows = await supabaseRequest('GET',
        '/project_invitations?id=eq.' + encodeURIComponent(invitationId) +
        '&inviter_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=id,project_id,invitee_email,invitee_phone,status');
      if (!Array.isArray(invRows) || !invRows[0]) {
        return res.status(404).json({ error: 'Invitation introuvable' });
      }
      const inv = invRows[0];

      if (inv.status !== 'pending') {
        return res.status(400).json({ error: 'Cette invitation ne peut plus être renvoyée' });
      }

      /* Renvoyer l'email */
      const projRows = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(inv.project_id) + '&select=id,name,goal,members_count');
      const proj = Array.isArray(projRows) ? projRows[0] : null;

      try {
        await fetch(process.env.API_URL + '/invite/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: inv.project_id,
            tontineName: proj ? proj.name : '—',
            email: inv.invitee_email,
            phone: inv.invitee_phone,
            goal: proj ? proj.goal : 0,
            membersCount: proj ? proj.members_count : 0,
          }),
        });
      } catch (e) {
        console.warn('[resend] email send failed:', e.message);
      }

      return res.status(200).json({ ok: true, message: 'Invitation renvoyée' });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur renvoi invitation : ' + e.message });
    }
  }

  if (req.method === 'DELETE') {
    /* DELETE : révoquer une invitation en attente */
    const { invitationId } = body;
    if (!invitationId) {
      return res.status(400).json({ error: 'invitationId requis' });
    }

    try {
      const invRows = await supabaseRequest('GET',
        '/project_invitations?id=eq.' + encodeURIComponent(invitationId) +
        '&inviter_id=eq.' + encodeURIComponent(payload.userId) +
        '&status=eq.pending&select=id');
      if (!Array.isArray(invRows) || !invRows[0]) {
        return res.status(404).json({ error: 'Invitation introuvable ou déjà acceptée' });
      }

      await supabaseRequest('PATCH',
        '/project_invitations?id=eq.' + encodeURIComponent(invitationId),
        { status: 'revoked', responded_at: new Date().toISOString() });

      return res.status(200).json({ ok: true, message: 'Invitation révoquée' });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur révocation invitation : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée pour /invitations_send' });
}

/* ── Renvoyer une invitation existante (notification + email) ── */
async function handleInvitationsResend(req, res, payload) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST uniquement' });
  }
  const body = await parseBody(req);
  const invitationId = body.invitationId;
  if (!invitationId) return res.status(400).json({ error: 'invitationId requis' });

  try {
    /* Charger l'invitation (et vérifier que je suis l'inviteur) */
    const invRows = await supabaseRequest('GET',
      '/project_invitations?id=eq.' + encodeURIComponent(invitationId) +
      '&inviter_id=eq.' + encodeURIComponent(payload.userId) +
      '&select=id,project_id,invitee_email,invitee_phone,invitee_user_id,token,status');
    if (!Array.isArray(invRows) || !invRows[0]) {
      return res.status(404).json({ error: 'Invitation introuvable' });
    }
    const inv = invRows[0];
    if (inv.status !== 'pending') {
      return res.status(400).json({ error: 'Cette invitation ne peut plus être renvoyée' });
    }

    /* Charger le projet */
    const projRows = await supabaseRequest('GET',
      '/projects?id=eq.' + encodeURIComponent(inv.project_id) +
      '&select=id,name,goal,invite_code');
    const proj = (Array.isArray(projRows) && projRows[0]) ? projRows[0] : null;
    const nom = proj ? proj.name : 'Épargne Collective';
    const inviteUrl = 'https://www.epargnplus.com/join/' + (proj && proj.invite_code ? proj.invite_code : (inv.token || ''));

    /* Prolonger l'expiration de 30 jours */
    try {
      await supabaseRequest('PATCH',
        '/project_invitations?id=eq.' + encodeURIComponent(invitationId),
        { expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() });
    } catch (e) {}

    /* Notification in-app si l'invité a un compte */
    if (inv.invitee_user_id) {
      try {
        await supabaseRequest('POST', '/notifications', {
          user_id: inv.invitee_user_id,
          type:    'invitation',
          title:   '🤝 Rappel : invitation à rejoindre un groupe',
          body:    'Vous êtes invité(e) à rejoindre « ' + nom + ' » sur Epargn+.',
          data:    { project_id: inv.project_id, invitation_id: invitationId, invite_url: inviteUrl },
          read:    false,
        });
      } catch (e) {}
    }

    /* Email si adresse connue */
    let emailSent = false;
    if (inv.invitee_email) {
      try {
        const r = await emailTrigger('collective_invite', inv.invitee_user_id || null, {
          inviter:     '',
          tontineName: nom,
          inviteCode:  (proj && proj.invite_code) || '',
        }, inv.invitee_email);
        emailSent = !!(r && r.ok);
      } catch (e) {}
    }

    return res.status(200).json({ ok: true, message: 'Invitation renvoyée', inviteUrl, emailSent });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur renvoi invitation : ' + e.message });
  }
}

/* ── Groupes collectifs où l'utilisateur est membre (créateur OU invité accepté) ── */
async function handleMyGroups(req, res, payload) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  const SELECT = 'id,user_id,name,goal,actuel,members_count,status,invite_code,' +
    'invite_token,invite_active,mise_mensuelle,freq,duree,contribution_type,created_at';
  try {
    /* 1. Adhésions de l'utilisateur (groupes rejoints) */
    let members = [];
    try {
      members = await supabaseRequest('GET',
        '/project_members?user_id=eq.' + encodeURIComponent(payload.userId) +
        '&select=project_id,role,status');
      if (!Array.isArray(members)) members = [];
    } catch (e) {
      console.warn('[my_groups] project_members:', e.message);
    }
    const roleMap = {};
    members.forEach(m => { roleMap[m.project_id] = m.role || 'member'; });

    /* 2. Projets COLLECTIFS dont l'utilisateur est PROPRIÉTAIRE
       (rattrape les anciens groupes absents de project_members). */
    let owned = [];
    try {
      owned = await supabaseRequest('GET',
        '/projects?user_id=eq.' + encodeURIComponent(payload.userId) +
        '&status=neq.closed&select=' + SELECT);
      if (!Array.isArray(owned)) owned = [];
    } catch (e) {
      console.warn('[my_groups] owned:', e.message);
    }
    const ownedCollective = owned.filter(p => isProjectCollective(p));

    /* 3. Union des IDs (rejoints + possédés collectifs) */
    const have = {};
    let projects = [];
    ownedCollective.forEach(p => { have[p.id] = true; projects.push(p); });

    const missing = [...new Set(members.map(m => m.project_id).filter(Boolean))]
      .filter(id => !have[id]);
    if (missing.length) {
      try {
        const more = await supabaseRequest('GET',
          '/projects?id=in.(' + missing.map(encodeURIComponent).join(',') + ')&select=' + SELECT);
        if (Array.isArray(more)) projects = projects.concat(more);
      } catch (e) { console.warn('[my_groups] missing:', e.message); }
    }

    if (projects.length === 0) return res.status(200).json([]);

    const result = projects.map(p => ({
      id:                p.id,
      name:              p.name,
      goal:              p.goal,
      actuel:            p.actuel || 0,
      members_count:     p.members_count || 1,
      status:            p.status || 'active',
      invite_code:       p.invite_code || null,
      invite_active:     p.invite_active,
      mise_mensuelle:    p.mise_mensuelle || 0,
      freq:              p.freq || 'mensuelle',
      duree:             p.duree || 'm12',
      contribution_type: p.contribution_type || 'free',
      created_at:        p.created_at,
      role:              (p.user_id === payload.userId) ? 'creator' : (roleMap[p.id] || 'member'),
      is_creator:        p.user_id === payload.userId,
    }));

    return res.status(200).json(result);
  } catch (e) {
    return res.status(200).json([]);
  }
}

/* ── Historique des dépôts d'un projet collectif (membres + traçabilité) ──
   GET ?resource=project_history&id=<projectId>
   Renvoie : { ok, total, byMember:[{name,phone,total,pct,count}], transactions:[...] } */
async function handleProjectHistory(req, res, payload, projectId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  if (!projectId) return res.status(400).json({ error: 'id projet requis' });

  try {
    /* 1. Sécurité : l'utilisateur doit être propriétaire OU membre du projet */
    let allowed = false;
    try {
      const own = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(projectId) +
        '&user_id=eq.' + encodeURIComponent(payload.userId) + '&select=id&limit=1');
      if (Array.isArray(own) && own[0]) allowed = true;
    } catch (e) {}
    if (!allowed) {
      try {
        const mem = await supabaseRequest('GET',
          '/project_members?project_id=eq.' + encodeURIComponent(projectId) +
          '&user_id=eq.' + encodeURIComponent(payload.userId) + '&select=id&limit=1');
        if (Array.isArray(mem) && mem[0]) allowed = true;
      } catch (e) {}
    }
    if (!allowed) return res.status(403).json({ error: 'Accès non autorisé à ce projet' });

    /* 2. Dépôts complétés du projet */
    let txns = [];
    try {
      txns = await supabaseRequest('GET',
        '/transactions?project_id=eq.' + encodeURIComponent(projectId) +
        '&is_credit=eq.true&statut=eq.completed' +
        '&select=user_id,amount,created_at,label&order=created_at.desc&limit=300');
      if (!Array.isArray(txns)) txns = [];
    } catch (e) { console.warn('[project_history] txns:', e.message); }

    /* 3. Noms des déposants */
    const userIds = [...new Set(txns.map(t => t.user_id).filter(Boolean))];
    const nameMap = {};
    if (userIds.length) {
      try {
        const users = await supabaseRequest('GET',
          '/users?id=in.(' + userIds.map(encodeURIComponent).join(',') + ')&select=id,prenom,nom,phone');
        (Array.isArray(users) ? users : []).forEach(u => {
          nameMap[u.id] = {
            name: ((u.prenom || '') + ' ' + (u.nom || '')).trim() || u.phone || 'Membre',
            phone: u.phone || '',
          };
        });
      } catch (e) {}
    }

    /* 4. Agrégats par membre + total */
    const totals = {};
    let total = 0;
    txns.forEach(t => {
      const uid = t.user_id || 'inconnu';
      const amt = Number(t.amount) || 0;
      if (!totals[uid]) totals[uid] = { count: 0, total: 0 };
      totals[uid].count += 1;
      totals[uid].total += amt;
      total += amt;
    });
    const byMember = Object.keys(totals).map(uid => ({
      user_id: uid,
      name:    (nameMap[uid] && nameMap[uid].name) || 'Membre',
      phone:   (nameMap[uid] && nameMap[uid].phone) || '',
      total:   totals[uid].total,
      count:   totals[uid].count,
      pct:     total > 0 ? Math.round(totals[uid].total / total * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    const transactions = txns.map(t => ({
      name:       (nameMap[t.user_id] && nameMap[t.user_id].name) || 'Membre',
      amount:     Number(t.amount) || 0,
      created_at: t.created_at,
    }));

    return res.status(200).json({ ok: true, total, byMember, transactions });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur historique : ' + e.message });
  }
}

/* ── KYC : fournit l'URL de vérification Smile ID (pré-remplie avec user_id) ── */
async function handleKyc(req, res, payload) {
  /* POST : soumission manuelle des documents (document + selfie en data URL base64) */
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const document = body.document || '';
    const selfie   = body.selfie   || '';
    if (!document || !selfie) return res.status(400).json({ error: 'Document et selfie requis' });
    try {
      /* ── Upload des pièces dans le bucket PRIVÉ "kyc" (PII jamais en clair en DB).
         Repli sur la data-URL si Storage indisponible (bucket non créé). ── */
      const ts = Date.now();
      let docVal = document, selfieVal = selfie;
      try {
        const d = storageDecode(document), s = storageDecode(selfie);
        if (d) docVal    = await storageUpload('kyc', payload.userId + '/document-' + ts + extFromMime(d.contentType), d.buffer, d.contentType);
        if (s) selfieVal = await storageUpload('kyc', payload.userId + '/selfie-' + ts + extFromMime(s.contentType), s.buffer, s.contentType);
      } catch (upErr) {
        console.warn('[kyc] upload Storage échoué, repli data-URL :', upErr.message);
        docVal = document; selfieVal = selfie;
      }
      await supabaseRequest('PATCH', '/users?id=eq.' + encodeURIComponent(payload.userId), {
        kyc_document_url: docVal,
        kyc_selfie_url:   selfieVal,
        kyc_status:       'pending',
        kyc_submitted_at: new Date().toISOString(),
      });
      /* Notifier l'utilisateur + email "dossier reçu" */
      try {
        const uRows = await supabaseRequest('GET',
          '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=email,prenom&limit=1');
        const u = Array.isArray(uRows) && uRows[0];
        if (u && u.email) {
          emailTrigger('kyc_received', payload.userId, { prenom: u.prenom || '' }, u.email).catch(() => {});
        }
      } catch (e) {}
      await logAudit(payload.userId, 'kyc_submitted', {}, req);
      return res.status(200).json({ ok: true, kyc_status: 'pending' });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur soumission KYC : ' + e.message });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  const base = process.env.SMILE_LINK_URL || '';
  if (!base) {
    /* Smile ID pas encore configuré → le frontend bascule sur la validation manuelle */
    return res.status(200).json({ ok: true, configured: false, smile_url: null });
  }
  /* Passer le user_id à Smile (devient partner_params.user_id, renvoyé au webhook) */
  const sep = base.indexOf('?') === -1 ? '?' : '&';
  const smileUrl = base + sep + 'user_id=' + encodeURIComponent(payload.userId);
  return res.status(200).json({ ok: true, configured: true, smile_url: smileUrl });
}

/* ── Communautés / Cercles d'épargne ──
   GET  ?resource=communities            → liste (avec flag joined)
   POST ?resource=communities            → créer { name, type, goal }
   POST ?resource=communities&id=<id>    → rejoindre */
async function handleCommunities(req, res, payload, communityId) {
  const TYPES = ['famille','entreprise','quartier','mosquee','etudiants','femmes','chauffeurs','cooperative','autre'];

  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('GET',
        '/communities?select=id,name,type,goal,total_saved,members_count,created_by&order=total_saved.desc&limit=100');
      const list = Array.isArray(rows) ? rows : [];
      /* Marquer celles que l'utilisateur a rejointes */
      let mine = [];
      try {
        mine = await supabaseRequest('GET',
          '/community_members?user_id=eq.' + encodeURIComponent(payload.userId) + '&select=community_id');
      } catch (e) {}
      const joined = new Set((Array.isArray(mine) ? mine : []).map(m => m.community_id));
      return res.status(200).json(list.map(c => ({ ...c, joined: joined.has(c.id) })));
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST' && communityId) {
    /* Rejoindre */
    try {
      await supabaseRequest('POST', '/community_members', {
        community_id: communityId, user_id: payload.userId, role: 'member', points: 0,
      });
      try {
        const c = await supabaseRequest('GET', '/communities?id=eq.' + encodeURIComponent(communityId) + '&select=members_count');
        if (Array.isArray(c) && c[0]) {
          await supabaseRequest('PATCH', '/communities?id=eq.' + encodeURIComponent(communityId),
            { members_count: (Number(c[0].members_count) || 1) + 1 });
        }
      } catch (e) {}
      return res.status(200).json({ ok: true, joined: true });
    } catch (e) {
      if (String(e.message).match(/duplicate|unique/i)) return res.status(200).json({ ok: true, joined: true });
      return res.status(500).json({ error: 'Erreur adhésion : ' + e.message });
    }
  }

  if (req.method === 'POST') {
    /* Créer */
    const body = await parseBody(req);
    const name = (body.name || '').trim();
    const type = TYPES.includes(body.type) ? body.type : 'autre';
    const goal = parseInt(body.goal, 10) || 0;
    if (!name)        return res.status(400).json({ error: 'Nom de la communauté requis' });
    if (goal < 1000)  return res.status(400).json({ error: 'Objectif minimum : 1 000' });
    try {
      const created = await supabaseRequest('POST', '/communities', {
        name, type, goal, total_saved: 0, members_count: 1, created_by: payload.userId,
      });
      const c = Array.isArray(created) ? created[0] : created;
      if (c && c.id) {
        try {
          await supabaseRequest('POST', '/community_members', {
            community_id: c.id, user_id: payload.userId, role: 'creator', points: 0,
          });
        } catch (e) {}
      }
      return res.status(201).json(c);
    } catch (e) {
      return res.status(500).json({ error: 'Erreur création communauté : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

/* Défis & Arène
   GET  ?resource=challenges&id=<communityId>  → défis d'une communauté
   GET  ?resource=challenges                    → mes défis (participant)
   POST ?resource=challenges                    → créer { name, goal, days, community_id?, kind }
   POST ?resource=challenges&id=<challengeId>   → rejoindre */
async function handleChallenges(req, res, payload, id) {
  if (req.method === 'GET') {
    try {
      let rows;
      if (id) {
        rows = await supabaseRequest('GET',
          '/challenges?community_id=eq.' + encodeURIComponent(id) +
          '&select=id,name,kind,goal,reward_points,ends_at,community_id&order=ends_at.asc&limit=50');
      } else {
        const parts = await supabaseRequest('GET',
          '/challenge_participants?user_id=eq.' + encodeURIComponent(payload.userId) + '&select=challenge_id');
        const ids = [...new Set((Array.isArray(parts) ? parts : []).map(p => p.challenge_id))];
        if (!ids.length) return res.status(200).json([]);
        rows = await supabaseRequest('GET',
          '/challenges?id=in.(' + ids.map(encodeURIComponent).join(',') +
          ')&select=id,name,kind,goal,reward_points,ends_at,community_id&order=ends_at.asc&limit=50');
      }
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    } catch (e) { return res.status(200).json([]); }
  }

  if (req.method === 'POST' && id) {
    /* Rejoindre */
    try {
      await supabaseRequest('POST', '/challenge_participants',
        { challenge_id: id, user_id: payload.userId, progress: 0 });
      return res.status(200).json({ ok: true, joined: true });
    } catch (e) {
      if (String(e.message).match(/duplicate|unique/i)) return res.status(200).json({ ok: true, joined: true });
      return res.status(500).json({ error: 'Erreur participation : ' + e.message });
    }
  }

  if (req.method === 'POST') {
    /* Créer */
    const body = await parseBody(req);
    const name = (body.name || '').trim();
    const goal = parseInt(body.goal, 10) || 0;
    const days = Math.max(1, Math.min(365, parseInt(body.days, 10) || 7));
    const kind = ['community', 'private', 'duel'].includes(body.kind) ? body.kind : 'private';
    if (!name)       return res.status(400).json({ error: 'Nom du défi requis' });
    if (goal < 1000) return res.status(400).json({ error: 'Objectif minimum : 1 000' });
    const ends_at = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    try {
      const created = await supabaseRequest('POST', '/challenges', {
        community_id: body.community_id || null, kind, name, goal,
        reward_points: 50, created_by: payload.userId, ends_at,
      });
      const c = Array.isArray(created) ? created[0] : created;
      if (c && c.id) {
        try { await supabaseRequest('POST', '/challenge_participants',
          { challenge_id: c.id, user_id: payload.userId, progress: 0 }); } catch (e) {}
      }
      return res.status(201).json(c);
    } catch (e) {
      return res.status(500).json({ error: 'Erreur création défi : ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

/* GET ?resource=challenge&id=<id> → { challenge, participants[], joined } */
async function handleChallengeDetail(req, res, payload, challengeId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  if (!challengeId) return res.status(400).json({ error: 'id requis' });
  try {
    const cRows = await supabaseRequest('GET',
      '/challenges?id=eq.' + encodeURIComponent(challengeId) +
      '&select=id,name,kind,goal,reward_points,ends_at,community_id&limit=1');
    if (!Array.isArray(cRows) || !cRows[0]) return res.status(404).json({ error: 'Défi introuvable' });
    const challenge = cRows[0];

    let parts = [];
    try {
      parts = await supabaseRequest('GET',
        '/challenge_participants?challenge_id=eq.' + encodeURIComponent(challengeId) +
        '&select=user_id,progress&order=progress.desc&limit=100');
      if (!Array.isArray(parts)) parts = [];
    } catch (e) {}
    const ids = [...new Set(parts.map(p => p.user_id).filter(Boolean))];
    const nameMap = {};
    if (ids.length) {
      try {
        const users = await supabaseRequest('GET',
          '/users?id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=id,prenom,nom');
        (Array.isArray(users) ? users : []).forEach(u => {
          nameMap[u.id] = ((u.prenom || '') + ' ' + (u.nom || '')).trim() || 'Membre';
        });
      } catch (e) {}
    }
    const g = challenge.goal || 1;
    const participants = parts.map(p => ({
      user_id: p.user_id, name: nameMap[p.user_id] || 'Membre', progress: p.progress || 0,
      pct: Math.min(100, Math.round(((p.progress || 0) / g) * 100)),
    }));
    const joined = parts.some(p => p.user_id === payload.userId);
    return res.status(200).json({ challenge, participants, joined });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur défi : ' + e.message });
  }
}

/* GET ?resource=community_feed&id=<id> → fil d'activité de la communauté */
async function handleCommunityFeed(req, res, payload, communityId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  if (!communityId) return res.status(400).json({ error: 'id requis' });
  try {
    const rows = await supabaseRequest('GET',
      '/community_activity?community_id=eq.' + encodeURIComponent(communityId) +
      '&select=type,text,points,created_at&order=created_at.desc&limit=50');
    return res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.status(200).json([]);
  }
}

/* GET ?resource=activity → journal d'activité du compte (connexions, retraits…) */
async function handleActivity(req, res, payload) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  try {
    const rows = await supabaseRequest('GET',
      '/audit_log?user_id=eq.' + encodeURIComponent(payload.userId) +
      '&action=in.(login_success,login_fail,login_blocked,withdrawal_request,withdrawal_confirmed,account_deleted,kyc_submitted)' +
      '&select=action,meta,ip,created_at&order=created_at.desc&limit=50');
    const LABELS = {
      login_success: 'Connexion réussie', login_fail: 'Échec de connexion',
      login_blocked: 'Connexion bloquée (trop d\'essais)', withdrawal_request: 'Demande de retrait',
      withdrawal_confirmed: 'Retrait confirmé', account_deleted: 'Compte supprimé',
      kyc_submitted: 'Vérification d\'identité soumise',
    };
    const items = (Array.isArray(rows) ? rows : []).map(r => ({
      action: r.action, label: LABELS[r.action] || r.action,
      ip: r.ip || null, created_at: r.created_at,
    }));
    return res.status(200).json(items);
  } catch (e) {
    return res.status(200).json([]);
  }
}

/* GET ?resource=gamification → { points, league, badges[] } */
async function handleGamification(req, res, payload) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  try {
    const uRows = await supabaseRequest('GET',
      '/users?id=eq.' + encodeURIComponent(payload.userId) + '&select=points&limit=1');
    const points = (Array.isArray(uRows) && uRows[0]) ? (Number(uRows[0].points) || 0) : 0;

    /* Stats dépôts pour les badges */
    let count = 0, total = 0;
    try {
      const txns = await supabaseRequest('GET',
        '/transactions?user_id=eq.' + encodeURIComponent(payload.userId) +
        '&is_credit=eq.true&statut=eq.completed&select=amount&limit=1000');
      if (Array.isArray(txns)) { count = txns.length; total = txns.reduce((s, t) => s + (Number(t.amount) || 0), 0); }
    } catch (e) {}

    const league =
      points >= 10000 ? { key: 'elite',   label: 'Élite Afrique', min: 10000 } :
      points >= 5000  ? { key: 'diamant', label: 'Diamant',       min: 5000  } :
      points >= 2000  ? { key: 'or',      label: 'Or',            min: 2000  } :
      points >= 500   ? { key: 'argent',  label: 'Argent',        min: 500   } :
                        { key: 'bronze',  label: 'Bronze',        min: 0     };

    const badges = [
      { key: 'premier_depot', emoji: '🏆', label: 'Premier Dépôt',        earned: count >= 1 },
      { key: 'depot_7',       emoji: '🏅', label: 'Défi 7 jours',         earned: count >= 7 },
      { key: 'serie_30',      emoji: '🔥', label: 'Série 30 dépôts',      earned: count >= 30 },
      { key: 'million',       emoji: '💎', label: 'Premier Million',      earned: total >= 1000000 },
      { key: 'epargnant_or',  emoji: '🥇', label: 'Épargnant Or',         earned: total >= 5000000 },
      { key: 'investisseur',  emoji: '🚀', label: 'Investisseur Confirmé',earned: total >= 20000000 },
      { key: 'ambassadeur',   emoji: '👑', label: 'Ambassadeur Epargn+',  earned: points >= 1000 },
    ];

    return res.status(200).json({ points, league, badges });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur gamification : ' + e.message });
  }
}

/* GET ?resource=community&id=<id> → { community, members[], progress } */
async function handleCommunityDetail(req, res, payload, communityId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  if (!communityId) return res.status(400).json({ error: 'id requis' });
  try {
    const cRows = await supabaseRequest('GET',
      '/communities?id=eq.' + encodeURIComponent(communityId) +
      '&select=id,name,type,goal,total_saved,members_count,created_by&limit=1');
    if (!Array.isArray(cRows) || !cRows[0]) return res.status(404).json({ error: 'Communauté introuvable' });
    const community = cRows[0];

    let members = [];
    try {
      members = await supabaseRequest('GET',
        '/community_members?community_id=eq.' + encodeURIComponent(communityId) +
        '&select=user_id,points,role&order=points.desc&limit=100');
      if (!Array.isArray(members)) members = [];
    } catch (e) {}

    /* Noms des membres */
    const ids = [...new Set(members.map(m => m.user_id).filter(Boolean))];
    const nameMap = {};
    if (ids.length) {
      try {
        const users = await supabaseRequest('GET',
          '/users?id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=id,prenom,nom');
        (Array.isArray(users) ? users : []).forEach(u => {
          nameMap[u.id] = ((u.prenom || '') + ' ' + (u.nom || '')).trim() || 'Membre';
        });
      } catch (e) {}
    }
    const leaderboard = members.map(m => ({
      user_id: m.user_id, name: nameMap[m.user_id] || 'Membre', points: m.points || 0, role: m.role,
    }));

    const progress = community.goal > 0
      ? Math.min(100, Math.round((community.total_saved / community.goal) * 100)) : 0;

    return res.status(200).json({ community, members: leaderboard, progress });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur communauté : ' + e.message });
  }
}
