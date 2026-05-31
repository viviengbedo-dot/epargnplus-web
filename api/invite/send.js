/**
 * POST /api/invite/send  — Envoyer une invitation à un projet collectif
 * GET  /api/invite/send  — Vérifier/résoudre un lien d'invitation (?code=XXXX ou ?token=XXXX)
 *
 * POST Body :
 *   { projectId, phone?, email?, tontineName, mise, freq, creatorName, goal?, deadline? }
 *   ou { token } pour générer un nouveau lien (si code est absent de l'invitation DB)
 *
 * GET Query :
 *   ?code=XXXX   → résoudre le code court d'invitation
 *   ?token=XXXX  → résoudre le token long d'invitation
 */

const https  = require('https');
const { supabaseRequest } = require('../_lib/supabase');
const { sendEmail }       = require('../_lib/email');
const { verifyJWT }       = require('../_lib/auth');
const crypto = require('crypto');

const INFOBIP_API_KEY  = process.env.INFOBIP_API_KEY;
const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL;
const INFOBIP_FROM     = process.env.INFOBIP_FROM;
const AT_API_KEY       = process.env.AT_API_KEY;
const AT_USERNAME      = process.env.AT_USERNAME;
const AT_SENDER_ID     = process.env.AT_SENDER_ID;

const APP_URL = process.env.APP_URL || 'https://www.epargnplus.com';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function freqLabel(freq) {
  if (freq === 'journalier')   return 'par jour';
  if (freq === 'hebdomadaire') return 'par semaine';
  if (freq === 'bimensuelle')  return '2× par mois';
  return 'par mois';
}

function fmt(n) {
  return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function extractToken(req) {
  const auth = (req.headers['authorization'] || '').trim();
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

/* ════ Infobip SMS ════ */
function infobipSend(to, text) {
  if (!INFOBIP_API_KEY || !INFOBIP_BASE_URL) return Promise.resolve({ ok: false });
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
          resolve({ ok: res.statusCode < 400 && groupId !== 5, provider: 'infobip' });
        } catch { resolve({ ok: false }); }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.write(body);
    req.end();
  });
}

/* ════ Africa's Talking SMS ════ */
function atSend(to, text) {
  if (!AT_API_KEY || !AT_USERNAME) return Promise.resolve({ ok: false });
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
          resolve({ ok: first && [100, 101, 102].includes(first.statusCode), provider: 'africastalking' });
        } catch { resolve({ ok: false }); }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.write(payload);
    req.end();
  });
}

/* ════ Email d'invitation riche ════ */
function buildInviteEmailHtml(opts) {
  const {
    creatorName, nom, mise, freq, goal, deadline, inviteUrl, inviteeName,
  } = opts;
  const salut   = inviteeName ? `Bonjour ${inviteeName},` : 'Bonjour,';
  const fl      = freqLabel(freq || 'mensuelle');
  const mFmt    = fmt(mise || 0);
  const gFmt    = fmt(goal || 0);
  const dlFmt   = deadline ? new Date(deadline).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F3FF;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(11,21,102,.12);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0B1566,#1a2a8a);padding:32px 36px;text-align:center;">
    <div style="font-size:40px;margin-bottom:8px;">🤝</div>
    <div style="color:#C8E000;font-size:20px;font-weight:800;letter-spacing:.05em;">Invitation Epargn+</div>
    <div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:4px;">Épargne Collective</div>
  </div>

  <!-- Body -->
  <div style="padding:32px 36px;">
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">${salut}</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
      <strong>${creatorName || 'Un ami'}</strong> vous invite à rejoindre le groupe d'épargne collective
      <strong>« ${nom || 'Épargne Collective'} »</strong> sur Epargn+.
    </p>

    <!-- Récapitulatif -->
    <div style="background:#F0F3FF;border-radius:14px;padding:20px 24px;margin:20px 0;">
      ${goal ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E5E7EB;font-size:14px;color:#374151;"><span style="color:#6B7280;">Objectif total</span><strong>${gFmt} GNF</strong></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:8px 0;${goal ? 'border-bottom:1px solid #E5E7EB;' : ''}font-size:14px;color:#374151;">
        <span style="color:#6B7280;">Mise de participation</span>
        <strong style="color:#0B1566;font-size:17px;">${mFmt} GNF <span style="font-size:12px;font-weight:600;color:#6B7280;">${fl}</span></strong>
      </div>
      ${dlFmt ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#374151;"><span style="color:#6B7280;">Date limite</span><strong>${dlFmt}</strong></div>` : ''}
    </div>

    <a href="${inviteUrl}" style="display:block;background:linear-gradient(135deg,#0B1566,#1a2a8a);color:#fff;padding:16px 24px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;text-align:center;margin:24px 0 8px;">
      Rejoindre le groupe →
    </a>
    <div style="text-align:center;font-size:12px;color:#9CA3AF;margin-bottom:8px;">
      Ce lien est valide 30 jours.
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#F8FAFF;padding:20px 36px;border-top:1px solid #E8EDF5;text-align:center;">
    <p style="color:#9CA3AF;font-size:12px;margin:0;">
      © 2026 Epargn+ · L'épargne intelligente pour l'Afrique de l'Ouest &amp; la Chine<br>
      <a href="${APP_URL}" style="color:#9CA3AF;">${APP_URL}</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

/* ════ HANDLER ════ */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* ════ GET : résoudre un lien d'invitation ════ */
  if (req.method === 'GET') {
    try {
      const url    = new URL(req.url, 'http://localhost');
      const code   = url.searchParams.get('code')   || '';
      const token  = url.searchParams.get('token')  || '';

      if (!code && !token) {
        return res.status(400).json({ error: 'code ou token requis' });
      }

      /* Chercher le projet via invite_code ou invite_token */
      let project = null;
      if (code) {
        try {
          const rows = await supabaseRequest('GET',
            '/projects?invite_code=eq.' + encodeURIComponent(code) +
            '&select=id,name,goal,actuel,members_count,status,invite_active,invite_expires_at,user_id');
          if (Array.isArray(rows) && rows[0]) project = rows[0];
        } catch (e) {}
      }
      if (!project && token) {
        try {
          const rows = await supabaseRequest('GET',
            '/projects?invite_token=eq.' + encodeURIComponent(token) +
            '&select=id,name,goal,actuel,members_count,status,invite_active,invite_expires_at,user_id');
          if (Array.isArray(rows) && rows[0]) project = rows[0];
        } catch (e) {}
      }

      if (!project) return res.status(404).json({ error: 'Lien d\'invitation introuvable ou invalide' });
      if (!project.invite_active) return res.status(410).json({ error: 'Ce lien d\'invitation a été désactivé' });
      if (project.invite_expires_at && new Date(project.invite_expires_at) < new Date()) {
        return res.status(410).json({ error: 'Ce lien d\'invitation a expiré' });
      }
      if (project.status !== 'active') {
        return res.status(410).json({ error: 'Ce projet n\'est plus actif' });
      }

      /* Récupérer le nom du créateur */
      let creatorName = 'Un membre Epargn+';
      try {
        const uRows = await supabaseRequest('GET',
          '/users?id=eq.' + encodeURIComponent(project.user_id) + '&select=prenom,nom');
        if (Array.isArray(uRows) && uRows[0]) {
          creatorName = ((uRows[0].prenom || '') + ' ' + (uRows[0].nom || '')).trim();
        }
      } catch (e) {}

      return res.status(200).json({
        ok: true,
        project: {
          id:            project.id,
          name:          project.name,
          goal:          project.goal,
          actuel:        project.actuel,
          members_count: project.members_count || 1,
          status:        project.status,
        },
        creator_name: creatorName,
        invite_url:   APP_URL + '/join/' + (code || ''),
      });

    } catch (e) {
      return res.status(500).json({ error: 'Erreur résolution lien : ' + e.message });
    }
  }

  /* ════ POST : envoyer une invitation ou accepter une invitation via code ════ */
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET/POST uniquement' });

  /* Auth — vérifier JWT */
  const rawToken = extractToken(req);
  if (!rawToken) return res.status(401).json({ error: 'Non authentifié' });
  const jwtPayload = verifyJWT(rawToken);
  if (!jwtPayload) return res.status(401).json({ error: 'Session expirée — reconnectez-vous' });

  const body = await parseBody(req);
  const userId = jwtPayload.userId;

  /* ─── Traiter l'acceptation d'invitation via code ─── */
  if (body.code && !body.projectId) {
    const code = (body.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code requis' });

    try {
      /* Valider le code */
      let project = null;
      try {
        const rows = await supabaseRequest('GET',
          '/projects?invite_code=eq.' + encodeURIComponent(code) +
          '&select=id,name,goal,actuel,members_count,status,invite_active,invite_expires_at,user_id');
        if (Array.isArray(rows) && rows[0]) project = rows[0];
      } catch (e) {
        console.error('[invite/send POST accept] GET project:', e.message);
      }

      if (!project) return res.status(404).json({ error: 'Lien introuvable' });
      if (!project.invite_active) return res.status(410).json({ error: 'Invitations désactivées' });
      if (project.invite_expires_at && new Date(project.invite_expires_at) < new Date()) {
        return res.status(410).json({ error: 'Lien expiré' });
      }
      if (project.status !== 'active') return res.status(410).json({ error: 'Projet inactif' });

      /* Vérifier si déjà membre */
      let isMember = false;
      try {
        const members = await supabaseRequest('GET',
          '/project_members?project_id=eq.' + encodeURIComponent(project.id) +
          '&user_id=eq.' + encodeURIComponent(userId) +
          '&select=id');
        if (Array.isArray(members) && members[0]) isMember = true;
      } catch (e) {}

      if (isMember) {
        return res.status(400).json({ error: 'Vous êtes déjà membre de ce groupe' });
      }

      /* Créer/accepter l'invitation */
      try {
        const existingInv = await supabaseRequest('GET',
          '/project_invitations?project_id=eq.' + encodeURIComponent(project.id) +
          '&invitee_user_id=eq.' + encodeURIComponent(userId) +
          '&select=id');

        const now = new Date().toISOString();
        if (Array.isArray(existingInv) && existingInv[0]) {
          /* Accepter l'invitation existante */
          await supabaseRequest('PATCH',
            '/project_invitations?id=eq.' + encodeURIComponent(existingInv[0].id),
            { status: 'accepted', responded_at: now });
        } else {
          /* Créer et accepter une nouvelle invitation (token requis NOT NULL) */
          await supabaseRequest('POST', '/project_invitations', {
            project_id: project.id,
            inviter_id: project.user_id,
            invitee_user_id: userId,
            invitee_email: null,
            token: crypto.randomBytes(20).toString('hex'),
            status: 'accepted',
            created_at: now,
            responded_at: now,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      } catch (e) {
        console.error('[invite/send POST accept] invitation failed:', e.message);
        return res.status(500).json({ error: 'Erreur invitation' });
      }

      /* Ajouter à project_members */
      try {
        await supabaseRequest('POST', '/project_members', {
          project_id: project.id,
          user_id: userId,
          role: 'member',
          contribution: 0,
          status: 'active',
        });
      } catch (e) {
        console.error('[invite/send POST accept] member creation:', e.message);
        return res.status(500).json({ error: 'Erreur ajout membre' });
      }

      /* Mettre à jour members_count */
      try {
        const newCount = (project.members_count || 1) + 1;
        await supabaseRequest('PATCH',
          '/projects?id=eq.' + encodeURIComponent(project.id),
          { members_count: newCount });
      } catch (e) {
        console.warn('[invite/send POST accept] update count:', e.message);
      }

      /* Créer une notification pour l'invité */
      try {
        await supabaseRequest('POST', '/notifications', {
          user_id: userId,
          type: 'invitation',
          title: '🤝 Bienvenue dans ' + project.name,
          body: 'Vous avez rejoint le groupe d\'épargne collective « ' + project.name + ' »',
          read: false,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[invite/send POST accept] notification failed:', e.message);
      }

      return res.status(200).json({
        ok: true,
        project_id: project.id,
        project_name: project.name,
        message: 'Bienvenue dans le groupe !',
      });
    } catch (e) {
      console.error('[invite/send POST accept] error:', e.message);
      return res.status(500).json({ error: 'Erreur serveur: ' + e.message });
    }
  }

  /* ─── Traiter l'envoi d'invitation ─── */
  const {
    projectId, phone, email,
    tontineName, mise, freq, goal, deadline,
    creatorName,
  } = body;

  if (!projectId) return res.status(400).json({ error: 'projectId requis' });
  if (!phone && !email) return res.status(400).json({ error: 'phone ou email requis' });

  /* Récupérer le projet pour obtenir l'invite_code */
  let project = null;
  try {
    const pRows = await supabaseRequest('GET',
      '/projects?id=eq.' + encodeURIComponent(projectId) +
      '&select=id,name,invite_code,invite_token,invite_active,goal,user_id,status');
    if (Array.isArray(pRows) && pRows[0]) project = pRows[0];
  } catch (e) {}

  if (!project) return res.status(404).json({ error: 'Projet introuvable' });
  if (project.user_id !== jwtPayload.userId) {
    return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à inviter dans ce projet' });
  }
  if (project.status !== 'active') return res.status(400).json({ error: 'Ce projet n\'est plus actif' });

  const inviteCode = project.invite_code;
  const inviteUrl  = inviteCode ? (APP_URL + '/join/' + inviteCode) : (APP_URL + '/connexion');
  const nom        = tontineName || project.name || 'Épargne Collective';
  const creator    = creatorName || 'Un membre Epargn+';
  const fl         = freqLabel(freq || 'mensuelle');
  const mFmt       = fmt(mise || 0);

  /* Chercher les données de l'invité si connu */
  let inviteeEmail = email || null;
  let inviteeName  = null;
  let inviteeUserId = null;

  if (phone) {
    const phoneClean = phone.replace(/[\s\-]/g, '');
    try {
      const found = await supabaseRequest('GET',
        '/users?phone=eq.' + encodeURIComponent(phoneClean) +
        '&select=id,email,prenom,nom&limit=1');
      if (Array.isArray(found) && found[0]) {
        inviteeEmail  = inviteeEmail || found[0].email || null;
        inviteeName   = found[0].prenom || null;
        inviteeUserId = found[0].id     || null;
      }
    } catch (e) {}
  } else if (email) {
    try {
      const found = await supabaseRequest('GET',
        '/users?email=eq.' + encodeURIComponent(email) +
        '&select=id,prenom&limit=1');
      if (Array.isArray(found) && found[0]) {
        inviteeName   = found[0].prenom || null;
        inviteeUserId = found[0].id     || null;
      }
    } catch (e) {}
  }

  /* Vérifier doublon d'invitation */
  try {
    const checkQ = inviteeUserId
      ? '/project_invitations?project_id=eq.' + encodeURIComponent(projectId) +
        '&invitee_user_id=eq.' + encodeURIComponent(inviteeUserId) +
        '&status=eq.pending&select=id&limit=1'
      : null;
    if (checkQ) {
      const existing = await supabaseRequest('GET', checkQ);
      if (Array.isArray(existing) && existing.length > 0) {
        return res.status(409).json({ error: 'Une invitation est déjà en attente pour cet utilisateur' });
      }
    }
  } catch (e) {}

  /* Créer l'enregistrement d'invitation */
  const invToken   = crypto.randomBytes(20).toString('hex');
  const expiresAt  = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  let dbInvId = null;
  try {
    const invRows = await supabaseRequest('POST', '/project_invitations', {
      project_id:       projectId,
      inviter_id:       project.user_id,
      token:            invToken,
      status:           'pending',
      expires_at:       expiresAt,
      ...(inviteeEmail  ? { invitee_email:   inviteeEmail }   : {}),
      ...(phone         ? { invitee_phone:   phone }          : {}),
      ...(inviteeUserId ? { invitee_user_id: inviteeUserId }  : {}),
    });
    const created = Array.isArray(invRows) ? invRows[0] : invRows;
    if (created) dbInvId = created.id;
  } catch (e) {
    console.warn('[invite/send] create invitation:', e.message);
  }

  /* Notification in-app si destinataire connu */
  if (inviteeUserId) {
    try {
      await supabaseRequest('POST', '/notifications', {
        user_id: inviteeUserId,
        type:    'invitation',
        title:   '🤝 Invitation à rejoindre un groupe',
        body:    `${creator} vous invite à rejoindre "${nom}". Mise : ${mFmt} GNF ${fl}.`,
        data:    {
          project_id:    projectId,
          invitation_id: dbInvId,
          invite_url:    inviteUrl,
        },
        read: false,
      });
    } catch (e) {}
  }

  /* SMS */
  const greeting  = inviteeName ? `Bonjour ${inviteeName},\n` : '';
  const smsText   =
    `${greeting}${creator} vous invite dans le groupe d'épargne « ${nom} » sur Epargn+.\n` +
    `Mise : ${mFmt} GNF ${fl}.\n` +
    `Rejoindre : ${inviteUrl}`;

  let smsResult = { ok: false };
  if (phone) {
    const hasInfobip = INFOBIP_API_KEY && INFOBIP_BASE_URL;
    const hasAT      = AT_API_KEY && AT_USERNAME;
    if (hasInfobip) {
      smsResult = await infobipSend(phone, smsText);
      if (!smsResult.ok && hasAT) smsResult = await atSend(phone, smsText);
    } else if (hasAT) {
      smsResult = await atSend(phone, smsText);
    } else {
      console.log('[invite/send] DEMO SMS to=' + phone + ' msg=' + smsText);
      smsResult = { ok: true, provider: 'demo' };
    }
  }

  /* Email invitation via moteur v7 */
  let emailSent = false;
  if (inviteeEmail) {
    const { trigger: emailTrig } = require('../_lib/email');
    const result = await emailTrig('collective_invite', inviteeUserId || null, {
      prenom:      inviteeName || '',
      inviter:     creator,
      tontineName: nom,
      mise:        (mise || 0).toLocaleString('fr-FR') + ' GNF',
      freq:        freq || 'Mensuelle',
      inviteCode:  inviteCode || '',
    }, inviteeEmail);
    emailSent = result.ok;
  }

  console.log('[invite/send] project=' + projectId + ' phone=' + (phone||'—') +
    ' email=' + (inviteeEmail||'—') + ' sms=' + smsResult.ok + ' emailSent=' + emailSent);

  return res.status(200).json({
    ok:         true,
    smsSent:    smsResult.ok,
    emailSent,
    inviteUrl,
    inviteCode,
    invitationId: dbInvId,
    provider:   smsResult.provider || null,
  });
};
