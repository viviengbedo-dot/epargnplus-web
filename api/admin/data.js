/**
 * GET /api/admin/data — Epargn+ v5
 * Données réelles depuis Supabase pour le tableau de bord administrateur.
 *
 * Retourne :
 *   { users[], pendingTransactions[], allTransactions[], allProjects[],
 *     projectMembers[], pendingWithdrawals[], alipayDeposits[],
 *     notifications[], stats: {...} }
 */

const { supabaseRequest } = require('../_lib/supabase');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });

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
        '&select=id,user_id,amount,project_id,statut,label,note,created_at' +
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
          '/projects?select=id,user_id,name,goal,actuel,status,color,duree,created_at' +
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

    /* ── 5. Invitations (toutes) ── */
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

    /* Projets collectifs stats */
    const collectifProjects = allProjects.filter(p => p.name && p.name.startsWith('🤝'));
    const collectifActive   = collectifProjects.filter(p => p.status === 'active').length;
    const collectifClosed   = collectifProjects.filter(p => p.status === 'closed').length;
    const withdrawalsPending = pendingWithdrawals.length;

    /* Invitations stats */
    const inviteAccepted = allInvitations.filter(i => i.status === 'accepted').length;
    const invitePending  = allInvitations.filter(i => i.status === 'pending').length;
    const inviteRejected = allInvitations.filter(i => i.status === 'rejected').length;

    return res.status(200).json({
      users,
      pendingTransactions,
      pendingWithdrawals,
      alipayDeposits,
      allTransactions,
      allProjects,
      projectMembers,
      allInvitations,
      stats: {
        total, epargneTotal, kycPending, kycVerified, pendingCount, byCountry,
        alipay: { pending: alipayPending, confirmed: alipayConfirmed, total: alipayTotal },
        collectif: { active: collectifActive, closed: collectifClosed, withdrawalsPending },
        invitations: { accepted: inviteAccepted, pending: invitePending, rejected: inviteRejected },
      },
    });

  } catch (err) {
    console.error('[admin/data] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
