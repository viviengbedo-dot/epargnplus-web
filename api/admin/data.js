/**
 * GET /api/admin/data — Epargn+ v5
 * Données réelles depuis Supabase pour le tableau de bord administrateur.
 *
 * Retourne :
 *   { users[], pendingTransactions[], allTransactions[], allProjects[],
 *     projectMembers[], pendingWithdrawals[], alipayDeposits[],
 *     notifications[], stats: {...} }
 */

const { supabaseRequest }   = require('../_lib/supabase');
const { runReminderCron }   = require('../_lib/email');
const { isProjectCollective } = require('../_lib/project');
const ADMIN_SECRET  = process.env.ADMIN_SECRET  || 'epargn-admin-dev-2026';
const CRON_SECRET   = process.env.CRON_SECRET   || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });

  /* ── Cron endpoint (protection par CRON_SECRET) ── */
  const cronParam = (req.query || {}).cron;
  if (cronParam) {
    const cronAuth = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!CRON_SECRET || cronAuth !== CRON_SECRET) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    try {
      const result = await runReminderCron();
      console.log('[cron/reminders]', result);
      return res.status(200).json({ ok: true, cron: 'reminders', result });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  try {
    /* ── 1. Utilisateurs ── */
    let users = [];
    try {
      users = await supabaseRequest('GET',
        '/users?select=id,phone,country,prenom,nom,operator,epargne,pending_deposit,' +
        'kyc_status,kyc_document_url,kyc_selfie_url,kyc_doc_number,kyc_doc_type,' +
        'kyc_submitted_at,aml_status,risk_score,role,alipay_id,currency,email,' +
        'updated_at,created_at&order=created_at.desc&limit=500');
    } catch (e) {
      try {
        users = await supabaseRequest('GET',
          '/users?select=id,phone,country,prenom,nom,operator,epargne,' +
          'pending_deposit,kyc_status,role,currency,email,updated_at,created_at' +
          '&order=created_at.desc&limit=500');
      } catch (e2) {
        users = await supabaseRequest('GET',
          '/users?select=id,phone,prenom,nom,epargne,kyc_status,role,created_at' +
          '&order=created_at.desc&limit=500');
      }
    }
    if (!Array.isArray(users)) users = [];

    /* ── 2. Transactions en attente (dépôts MM) ── */
    let pendingTransactions = [];
    try {
      pendingTransactions = await supabaseRequest('GET',
        '/transactions?statut=eq.pending&type=not.eq.retrait_projet_collectif' +
        '&type=not.eq.depot_alipay' +
        '&select=id,user_id,amount,operator,project_id,statut,status,label,type,currency,created_at' +
        '&order=created_at.desc&limit=200');
      if (!Array.isArray(pendingTransactions)) pendingTransactions = [];
    } catch (e) {
      /* Fallback sans filtres */
      try {
        pendingTransactions = await supabaseRequest('GET',
          '/transactions?statut=eq.pending&select=id,user_id,amount,operator,' +
          'project_id,statut,status,label,type,created_at&order=created_at.desc&limit=200');
        if (!Array.isArray(pendingTransactions)) pendingTransactions = [];
        /* Filtrer côté JS */
        pendingTransactions = pendingTransactions.filter(t =>
          t.type !== 'retrait_projet_collectif' && t.type !== 'depot_alipay');
      } catch (e2) {
        console.warn('[admin/data] pendingTransactions:', e2.message);
      }
    }

    /* ── 2b. Retraits collectifs en attente (Module 1) ── */
    let pendingWithdrawals = [];
    try {
      pendingWithdrawals = await supabaseRequest('GET',
        '/transactions?statut=eq.pending&type=eq.retrait_projet_collectif' +
        '&select=id,user_id,amount,project_id,statut,label,created_at' +
        '&order=created_at.desc&limit=200');
      if (!Array.isArray(pendingWithdrawals)) pendingWithdrawals = [];
    } catch (e) {
      console.warn('[admin/data] pendingWithdrawals:', e.message);
    }

    /* ── 2c. Dépôts Alipay en attente (Module 4) ── */
    let alipayDeposits = [];
    try {
      alipayDeposits = await supabaseRequest('GET',
        '/transactions?type=eq.depot_alipay' +
        '&select=id,user_id,amount,operator,statut,status,label,reference,' +
        'proof_url,currency,created_at,validated_by,validated_at' +
        '&order=created_at.desc&limit=200');
      if (!Array.isArray(alipayDeposits)) alipayDeposits = [];
    } catch (e) {
      console.warn('[admin/data] alipayDeposits:', e.message);
    }

    /* ── 2d. Toutes les transactions récentes ── */
    let allTransactions = [];
    try {
      allTransactions = await supabaseRequest('GET',
        '/transactions?select=id,user_id,type,amount,operator,project_id,' +
        'statut,status,label,currency,created_at&order=created_at.desc&limit=300');
      if (!Array.isArray(allTransactions)) allTransactions = [];
    } catch (e) {
      try {
        allTransactions = await supabaseRequest('GET',
          '/transactions?select=id,user_id,type,amount,operator,statut,status,' +
          'created_at&order=created_at.desc&limit=300');
        if (!Array.isArray(allTransactions)) allTransactions = [];
      } catch (e2) {
        console.warn('[admin/data] allTransactions:', e2.message);
      }
    }

    /* ── 3. Projets (tous statuts) ── */
    let allProjects = [];
    try {
      allProjects = await supabaseRequest('GET',
        '/projects?select=id,user_id,name,goal,actuel,status,color,duree,' +
        'invite_token,invite_code,invite_active,members_count,mise_mensuelle,freq,' +
        'created_at&order=created_at.desc&limit=500');
      if (!Array.isArray(allProjects)) allProjects = [];
    } catch (e) {
      try {
        allProjects = await supabaseRequest('GET',
          '/projects?select=id,user_id,name,goal,actuel,status,color,duree,' +
          'invite_code,members_count,created_at' +
          '&order=created_at.desc&limit=500');
        if (!Array.isArray(allProjects)) allProjects = [];
      } catch (e2) {
        console.warn('[admin/data] projects:', e2.message);
      }
    }

    /* ── 4. Membres des projets collectifs ── */
    let projectMembers = [];
    try {
      projectMembers = await supabaseRequest('GET',
        '/project_members?select=id,project_id,user_id,role,contribution,joined_at,status' +
        '&order=joined_at.desc&limit=500');
      if (!Array.isArray(projectMembers)) projectMembers = [];
    } catch (e) {
      console.warn('[admin/data] project_members:', e.message);
    }

    /* ── 5. Settings (merchant config) ── */
    let merchantConfig = null;
    try {
      const settingsRows = await supabaseRequest('GET', '/settings?key=eq.merchant_config&select=value');
      if (Array.isArray(settingsRows) && settingsRows.length > 0) {
        merchantConfig = settingsRows[0].value;
      }
    } catch (e) {
      console.warn('[admin/data] settings:', e.message);
    }

    /* ── 6. Invitations (toutes) ── */
    let allInvitations = [];
    try {
      allInvitations = await supabaseRequest('GET',
        '/project_invitations?select=id,project_id,inviter_id,invitee_email,' +
        'invitee_phone,invitee_user_id,token,status,expires_at,responded_at,created_at' +
        '&order=created_at.desc&limit=200');
      if (!Array.isArray(allInvitations)) allInvitations = [];
    } catch (e) {
      console.warn('[admin/data] invitations:', e.message);
    }

    /* ── 6a. Cohérence soldes — surplus users (calculé en code) ──
       L'ancienne vue v_balance_coherence utilisait SUM(goal - actuel) qui
       devient NÉGATIF quand un projet est sur-financé (actuel > goal), ce qui
       comptait le solde deux fois (ex : dépôt 25M → excédent affiché 47M).

       Formule correcte :
         capacité absorbable d'un projet = min(actuel, objectif effectif)
           où objectif effectif = goal × 1,01 (marge Epargn+ intégrée)
         excédent = solde − Σ min(actuel, objectif effectif)
                  = argent au-delà des objectifs des projets, à réattribuer. */
    let surplusUsers = [];
    try {
      const FEE = 1.01;
      const projByUser = {};
      (allProjects || []).forEach((p) => {
        if (!p || p.status !== 'active') return;
        (projByUser[p.user_id] = projByUser[p.user_id] || []).push(p);
      });

      surplusUsers = (users || []).map((u) => {
        const solde = Number(u.epargne) || 0;
        const projs = projByUser[u.id] || [];
        let allocated   = 0;   /* Σ min(actuel, objectif effectif) — dans les objectifs */
        let dansProjets = 0;   /* Σ actuel — argent réellement présent dans les projets */
        let objectifs   = 0;   /* Σ goal — total des objectifs des projets */
        let capacite    = 0;   /* Σ max(objectif effectif − actuel, 0) */
        projs.forEach((p) => {
          const actuel  = Number(p.actuel) || 0;
          const goal    = Number(p.goal) || 0;
          const target  = Math.round(goal * FEE);
          allocated   += Math.min(actuel, target);
          dansProjets += actuel;
          objectifs   += goal;
          capacite    += Math.max(target - actuel, 0);
        });
        /* Excédent = argent du solde NON placé dans un projet.
           L'argent déjà placé (même au-delà d'un objectif) n'est PAS un excédent. */
        const excedent = Math.max(0, solde - dansProjets);
        return {
          user_id:           u.id,
          phone:             u.phone,
          prenom:            u.prenom,
          solde_actuel:      solde,
          dans_projets:      dansProjets, /* Σ actuel — réellement dans les projets */
          objectifs_total:   objectifs,   /* Σ goal — total des objectifs */
          alloue:            allocated,   /* Σ min(actuel, objectif) — info */
          capacite_restante: capacite,    /* room restante (info) */
          excedent:          excedent,    /* = solde − dans les projets (argent hors projet) */
          nb_projets_actifs: projs.length,
        };
      })
      .filter((r) => r.excedent > 0)
      .sort((a, b) => b.excedent - a.excedent)
      .slice(0, 50);
    } catch (e) {
      console.warn('[admin/data] surplus calc:', e.message);
    }

    /* ── 6b. Support Tickets ── */
    let supportTickets = [];
    try {
      supportTickets = await supabaseRequest('GET',
        '/support_tickets?select=id,user_id,subject,message,status,priority,category,' +
        'admin_reply,resolved_at,created_at,updated_at&order=created_at.desc&limit=200');
      if (!Array.isArray(supportTickets)) supportTickets = [];
    } catch (e) {
      console.warn('[admin/data] support_tickets:', e.message);
    }

    /* ── 6c. Promo codes ── */
    let promoCodes = [];
    try {
      promoCodes = await supabaseRequest('GET',
        '/promo_codes?select=id,code,description,type,value,currency,max_uses,' +
        'uses_count,target_country,active,expires_at,created_at&order=created_at.desc&limit=100');
      if (!Array.isArray(promoCodes)) promoCodes = [];
    } catch (e) {
      console.warn('[admin/data] promo_codes:', e.message);
    }

    /* ── 6d. Broadcasts ── */
    let broadcasts = [];
    try {
      broadcasts = await supabaseRequest('GET',
        '/broadcasts?select=id,title,message,target,sent_count,created_by,created_at' +
        '&order=created_at.desc&limit=50');
      if (!Array.isArray(broadcasts)) broadcasts = [];
    } catch (e) {
      console.warn('[admin/data] broadcasts:', e.message);
    }

    /* ── 6. Statistiques ── */
    const total        = users.length;
    const epargneTotal = users.reduce((s, u) => s + (u.epargne || 0), 0);
    const kycPending   = users.filter(u => u.kyc_status === 'pending').length;
    const kycVerified  = users.filter(u => u.kyc_status === 'verified').length;
    const pendingCount = pendingTransactions.length ||
      users.filter(u => {
        try { const pd = JSON.parse(u.pending_deposit || 'null'); return pd && pd.amount > 0; }
        catch { return false; }
      }).length;

    /* Répartition par pays */
    const byCountry = { gn: 0, bj: 0, ci: 0, cn: 0, other: 0 };
    users.forEach(u => {
      const c = u.country || 'gn';
      if (byCountry[c] !== undefined) byCountry[c]++;
      else byCountry.other++;
    });

    /* Alipay stats */
    const alipayPending   = alipayDeposits.filter(t => t.statut === 'pending').length;
    const alipayConfirmed = alipayDeposits.filter(t => t.statut === 'completed').length;
    const alipayTotal     = alipayDeposits
      .filter(t => t.statut === 'completed')
      .reduce((s, t) => s + (t.amount || 0), 0);

    /* Projets collectifs stats — source de vérité unique */
    const collectifProjects = allProjects.filter(p => isProjectCollective(p));
    const collectifActive   = collectifProjects.filter(p => p.status === 'active').length;
    const collectifClosed   = collectifProjects.filter(p => p.status === 'closed').length;
    const withdrawalsPending = pendingWithdrawals.length;

    /* Invitations stats */
    const inviteAccepted = allInvitations.filter(i => i.status === 'accepted').length;
    const invitePending  = allInvitations.filter(i => i.status === 'pending').length;
    const inviteRejected = allInvitations.filter(i => i.status === 'rejected').length;

    /* ── 6e. Email templates + logs + campaigns ── */
    let emailTemplates = [], emailLogs = [], emailCampaigns = [];
    try {
      emailTemplates = await supabaseRequest('GET',
        '/email_templates?select=id,trigger,name,subject,language,active,updated_at&order=trigger.asc&limit=100');
      if (!Array.isArray(emailTemplates)) emailTemplates = [];
    } catch (e) { console.warn('[admin/data] email_templates:', e.message); }

    try {
      emailLogs = await supabaseRequest('GET',
        '/email_logs?select=id,user_id,trigger,to_email,subject,status,opened_at,created_at&order=created_at.desc&limit=200');
      if (!Array.isArray(emailLogs)) emailLogs = [];
    } catch (e) { console.warn('[admin/data] email_logs:', e.message); }

    try {
      emailCampaigns = await supabaseRequest('GET',
        '/email_campaigns?select=id,name,segment,status,scheduled_at,sent_count,open_count,click_count,created_at&order=created_at.desc&limit=50');
      if (!Array.isArray(emailCampaigns)) emailCampaigns = [];
    } catch (e) { console.warn('[admin/data] email_campaigns:', e.message); }

    /* Support stats */
    const ticketsOpen       = supportTickets.filter(t => t.status === 'open').length;
    const ticketsInProgress = supportTickets.filter(t => t.status === 'in_progress').length;
    const ticketsResolved   = supportTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const ticketsUrgent     = supportTickets.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

    /* Promo stats */
    const promoActive  = promoCodes.filter(p => p.active).length;
    const promoExpired = promoCodes.filter(p => p.expires_at && new Date(p.expires_at) < new Date()).length;

    return res.status(200).json({
      users,
      pendingTransactions,
      pendingWithdrawals,
      alipayDeposits,
      allTransactions,
      allProjects,
      projectMembers,
      allInvitations,
      merchantConfig,
      surplusUsers,
      supportTickets,
      promoCodes,
      broadcasts,
      emailTemplates,
      emailLogs,
      emailCampaigns,
      stats: {
        total, epargneTotal, kycPending, kycVerified, pendingCount, byCountry,
        alipay: { pending: alipayPending, confirmed: alipayConfirmed, total: alipayTotal },
        collectif: { active: collectifActive, closed: collectifClosed, withdrawalsPending },
        invitations: { accepted: inviteAccepted, pending: invitePending, rejected: inviteRejected },
        support: { open: ticketsOpen, inProgress: ticketsInProgress, resolved: ticketsResolved, urgent: ticketsUrgent },
        promos: { active: promoActive, expired: promoExpired, total: promoCodes.length },
        emails: {
          sent:      emailLogs.filter(l => l.status !== 'failed').length,
          failed:    emailLogs.filter(l => l.status === 'failed').length,
          opened:    emailLogs.filter(l => l.opened_at).length,
          openRate:  emailLogs.length > 0
            ? Math.round(emailLogs.filter(l => l.opened_at).length / emailLogs.length * 100)
            : 0,
          templates: emailTemplates.length,
          campaigns: emailCampaigns.length,
        },
      },
    });

  } catch (err) {
    console.error('[admin/data] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
