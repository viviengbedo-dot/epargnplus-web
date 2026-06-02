/**
 * POST /api/admin/update-balance — Epargn+ v6
 * Actions admin : approuver/rejeter dépôts, gérer projets, retraits collectifs, Alipay,
 *                 tickets support, codes promo, broadcasts.
 *
 * Actions supportées :
 *   approve            — valider un dépôt Mobile Money
 *   reject             — rejeter un dépôt
 *   set                — forcer un solde
 *   update-project     — changer le statut d'un projet
 *   close-collective   — clôturer un projet collectif + créer les transactions de retrait
 *   confirm-withdrawal — confirmer un retrait collectif (paiement MM effectué)
 *   reject-withdrawal  — rejeter un retrait collectif (recréditer le solde)
 *   confirm-alipay     — valider un dépôt Alipay
 *   reject-alipay      — rejeter un dépôt Alipay
 *   delete-account     — supprimer un compte utilisateur
 *   reply_ticket       — répondre à un ticket support
 *   update_ticket      — changer statut/priorité d'un ticket
 *   create_promo       — créer un code promo
 *   toggle_promo       — activer/désactiver un code promo
 *   delete_promo       — supprimer un code promo
 *   send_broadcast     — envoyer une notification à un segment d'utilisateurs
 */

const { supabaseRequest }    = require('../_lib/supabase');
const { trigger: emailTrig } = require('../_lib/email');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026';
if (!process.env.ADMIN_SECRET) {
  console.warn('[SECURITY] ADMIN_SECRET non défini — secret par défaut actif, DANGER en production !');
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* ── Créer une notification en base ── */
async function createNotification(userId, type, title, body_text, data) {
  try {
    await supabaseRequest('POST', '/notifications', {
      user_id: userId, type, title, body: body_text, data: data || null, read: false,
    });
  } catch (e) {
    console.warn('[update-balance] notification:', e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  const body   = await parseBody(req);
  const { action } = body;
  if (!action) return res.status(400).json({ error: 'action requise' });

  const now = new Date().toISOString();

  /* ════════════ UPDATE-PROJECT ════════════ */
  if (action === 'update-project') {
    const { projectId, status } = body;
    if (!projectId || !status) return res.status(400).json({ error: 'projectId et status requis' });
    const allowed = ['active','delete_rejected','closed','paused','pending_close'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'status invalide' });
    try {
      await supabaseRequest('PATCH',
        '/projects?id=eq.' + encodeURIComponent(projectId), { status });
      return res.status(200).json({ ok: true, action: 'update-project', projectId, status });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur mise à jour projet : ' + err.message });
    }
  }

  /* ════════════ CLOSE-COLLECTIVE (Module 1) ════════════
     Clôture un projet collectif et crée des transactions de retrait pour chaque membre.
  */
  if (action === 'close-collective') {
    const { projectId } = body;
    if (!projectId) return res.status(400).json({ error: 'projectId requis' });

    try {
      /* 1. Récupérer le projet */
      const projRows = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(projectId) +
        '&select=id,name,goal,actuel,user_id,status');
      if (!Array.isArray(projRows) || !projRows[0]) {
        return res.status(404).json({ error: 'Projet introuvable' });
      }
      const project = projRows[0];
      if (project.status === 'closed') {
        return res.status(400).json({ error: 'Ce projet est déjà clôturé' });
      }

      /* 2. Récupérer les membres */
      let members = [];
      try {
        members = await supabaseRequest('GET',
          '/project_members?project_id=eq.' + encodeURIComponent(projectId) +
          '&status=eq.active&select=id,user_id,contribution');
        if (!Array.isArray(members)) members = [];
      } catch (e) {
        console.warn('[close-collective] project_members:', e.message);
      }

      /* Si pas de membres dans la table, utiliser le créateur */
      if (members.length === 0 && project.user_id) {
        members = [{ user_id: project.user_id, contribution: project.actuel || 0 }];
      }

      const totalActuel = Number(project.actuel) || 0;
      const nbMembers   = members.length || 1;

      /* 3. Pour chaque membre : diminuer epargne + créer transaction pending */
      const withdrawalIds = [];
      for (const member of members) {
        /* Part proportionnelle : si contribution connue et > 0, l'utiliser */
        const memberShare = (member.contribution > 0)
          ? Number(member.contribution)
          : Math.floor(totalActuel / nbMembers);

        if (memberShare <= 0) continue;

        /* a) Diminuer epargne */
        try {
          const uRows = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(member.user_id) + '&select=id,epargne');
          if (Array.isArray(uRows) && uRows[0]) {
            const newEp = Math.max(0, (Number(uRows[0].epargne) || 0) - memberShare);
            await supabaseRequest('PATCH',
              '/users?id=eq.' + encodeURIComponent(member.user_id),
              { epargne: newEp, updated_at: now });
          }
        } catch (e) {
          console.warn('[close-collective] epargne deduction user=' + member.user_id, e.message);
        }

        /* b) Créer transaction retrait_projet_collectif (pending) */
        const ref = 'RPC-' + now.slice(0,10).replace(/-/g,'') + '-' +
          Math.random().toString(36).substr(2,5).toUpperCase();
        try {
          const txRows = await supabaseRequest('POST', '/transactions', {
            user_id:    member.user_id,
            type:       'retrait_projet_collectif',
            amount:     memberShare,
            operator:   'Mobile Money',
            is_credit:  false,
            label:      ref + ' · Retrait — Clôture ' + (project.name || 'Épargne Collective') + ' (admin)',
            project_id: projectId,
            statut:     'pending',
            status:     'pending',
          });
          const created = Array.isArray(txRows) ? txRows[0] : txRows;
          if (created && created.id) withdrawalIds.push(created.id);
        } catch (e) {
          console.warn('[close-collective] txn member=' + member.user_id, e.message);
        }

        /* c) Notification in-app */
        await createNotification(
          member.user_id,
          'withdrawal',
          '🤝 Projet collectif clôturé',
          `Le projet "${project.name || 'Épargne Collective'}" a été clôturé. ` +
          `Un retrait de ${memberShare.toLocaleString('fr-FR')} GNF est en cours de traitement.`,
          { project_id: projectId, amount: memberShare }
        );
      }

      /* 4. Marquer le projet comme closed */
      await supabaseRequest('PATCH',
        '/projects?id=eq.' + encodeURIComponent(projectId),
        { status: 'closed' });

      console.log('[close-collective] project=' + projectId + ' members=' + members.length +
        ' withdrawals=' + withdrawalIds.length);

      return res.status(200).json({
        ok: true, action: 'close-collective', projectId,
        membersAffected: members.length,
        withdrawalIds,
      });

    } catch (err) {
      console.error('[close-collective]', err.message);
      return res.status(500).json({ error: 'Erreur clôture : ' + err.message });
    }
  }

  /* ════════════ QUICK CLOSE + REFUND ════════════
     Suppression rapide d'un projet (collectif OU individuel) avec remboursement
     IMMÉDIAT des fonds épargnés (transactions 'completed', pas 'pending').
     Body: { projectId } */
  if (action === 'quick_close_refund') {
    const { projectId } = body;
    if (!projectId) return res.status(400).json({ error: 'projectId requis' });
    try {
      const projRows = await supabaseRequest('GET',
        '/projects?id=eq.' + encodeURIComponent(projectId) +
        '&select=id,name,goal,actuel,user_id,status');
      if (!Array.isArray(projRows) || !projRows[0]) return res.status(404).json({ error: 'Projet introuvable' });
      const project = projRows[0];
      if (project.status === 'closed') return res.status(400).json({ error: 'Projet déjà clôturé' });

      const totalActuel = Number(project.actuel) || 0;

      /* Membres (collectif) ou propriétaire (individuel) */
      let members = [];
      try {
        members = await supabaseRequest('GET',
          '/project_members?project_id=eq.' + encodeURIComponent(projectId) +
          '&status=eq.active&select=user_id');
        if (!Array.isArray(members)) members = [];
      } catch (e) {}
      if (members.length === 0 && project.user_id) members = [{ user_id: project.user_id }];

      /* Répartition réelle d'après les dépôts complétés de chaque membre */
      let deposits = [];
      try {
        deposits = await supabaseRequest('GET',
          '/transactions?project_id=eq.' + encodeURIComponent(projectId) +
          '&is_credit=eq.true&statut=eq.completed&select=user_id,amount&limit=500');
        if (!Array.isArray(deposits)) deposits = [];
      } catch (e) {}
      const byUser = {};
      deposits.forEach(t => { byUser[t.user_id] = (byUser[t.user_id] || 0) + (Number(t.amount) || 0); });
      const sumDeposits = Object.values(byUser).reduce((s, v) => s + v, 0);

      let refunded = 0;
      const refunds = [];
      for (const m of members) {
        /* Part = dépôts réels du membre ; sinon répartition égale du collecté */
        let share = byUser[m.user_id] != null ? byUser[m.user_id]
          : (sumDeposits === 0 ? Math.floor(totalActuel / members.length) : 0);
        share = Math.min(share, totalActuel); /* sécurité */
        if (share <= 0) continue;

        /* Réduire l'épargne du membre */
        try {
          const uRows = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(m.user_id) + '&select=epargne');
          const ep = (Array.isArray(uRows) && uRows[0]) ? (Number(uRows[0].epargne) || 0) : 0;
          await supabaseRequest('PATCH',
            '/users?id=eq.' + encodeURIComponent(m.user_id),
            { epargne: Math.max(0, ep - share), updated_at: now });
        } catch (e) {}

        /* Transaction de remboursement COMPLÉTÉE (versement effectué) */
        const ref = 'RB-' + now.slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
        try {
          await supabaseRequest('POST', '/transactions', {
            user_id: m.user_id, type: 'retrait_projet_collectif', amount: share,
            operator: 'Mobile Money', is_credit: false,
            label: ref + ' · Remboursement — Clôture ' + (project.name || 'Projet') + ' (admin)',
            project_id: projectId, statut: 'completed', status: 'success',
          });
        } catch (e) {}

        try {
          await createNotification(m.user_id, 'withdrawal', '💸 Remboursement effectué',
            share.toLocaleString('fr-FR') + ' GNF vous ont été remboursés (clôture du projet « ' + (project.name || '') + ' »).',
            { project_id: projectId, amount: share });
        } catch (e) {}

        refunded += share;
        refunds.push({ user_id: m.user_id, amount: share });
      }

      /* Clôturer le projet + remettre actuel à 0 */
      await supabaseRequest('PATCH',
        '/projects?id=eq.' + encodeURIComponent(projectId),
        { status: 'closed', actuel: 0, updated_at: now });

      console.log('[quick_close_refund] project=' + projectId + ' refunded=' + refunded + ' members=' + refunds.length);
      return res.status(200).json({ ok: true, action: 'quick_close_refund', projectId, refunded, refunds });
    } catch (err) {
      console.error('[quick_close_refund]', err.message);
      return res.status(500).json({ error: 'Erreur clôture + remboursement : ' + err.message });
    }
  }

  /* ════════════ CONFIRM-WITHDRAWAL (Module 1) ════════════
     Confirme qu'un retrait collectif a été envoyé via Mobile Money.
  */
  if (action === 'confirm-withdrawal') {
    const { txnId, adminNote } = body;
    if (!txnId) return res.status(400).json({ error: 'txnId requis' });

    try {
      /* Récupérer la transaction */
      const txRows = await supabaseRequest('GET',
        '/transactions?id=eq.' + encodeURIComponent(txnId) +
        '&select=id,user_id,amount,project_id,statut,type');
      if (!Array.isArray(txRows) || !txRows[0]) {
        return res.status(404).json({ error: 'Transaction introuvable' });
      }
      const txn = txRows[0];
      if (txn.type !== 'retrait_projet_collectif') {
        return res.status(400).json({ error: 'Cette transaction n\'est pas un retrait collectif' });
      }
      if (txn.statut === 'completed') {
        return res.status(400).json({ error: 'Cette transaction est déjà confirmée' });
      }

      /* Marquer la transaction comme complétée */
      await supabaseRequest('PATCH',
        '/transactions?id=eq.' + encodeURIComponent(txnId),
        { statut: 'completed', status: 'success', validated_by: 'admin', validated_at: now });

      /* Notification */
      await createNotification(
        txn.user_id,
        'withdrawal',
        '✅ Remboursement confirmé',
        `Votre remboursement de ${(txn.amount || 0).toLocaleString('fr-FR')} GNF a été envoyé avec succès.`,
        { txn_id: txnId, amount: txn.amount }
      );

      /* Email retrait confirmé */
      try {
        const uRows = await supabaseRequest('GET',
          '/users?id=eq.' + encodeURIComponent(txn.user_id) + '&select=email,prenom,epargne,currency&limit=1');
        const u = Array.isArray(uRows) && uRows[0];
        if (u && u.email) {
          const cur = u.currency || 'GNF';
          emailTrig('withdrawal_confirmed', txn.user_id, {
            prenom:       u.prenom || '',
            montant:      (txn.amount || 0).toLocaleString('fr-FR') + ' ' + cur,
            nouveauSolde: (u.epargne || 0).toLocaleString('fr-FR') + ' ' + cur,
          }, u.email).catch(() => {});
        }
      } catch {}

      console.log('[confirm-withdrawal] txn=' + txnId + ' user=' + txn.user_id);
      return res.status(200).json({ ok: true, action: 'confirm-withdrawal', txnId });

    } catch (err) {
      return res.status(500).json({ error: 'Erreur confirmation : ' + err.message });
    }
  }

  /* ════════════ REJECT-WITHDRAWAL (Module 1) ════════════
     Rejette un retrait collectif → recrédite le solde.
  */
  if (action === 'reject-withdrawal') {
    const { txnId, reason } = body;
    if (!txnId) return res.status(400).json({ error: 'txnId requis' });

    try {
      const txRows = await supabaseRequest('GET',
        '/transactions?id=eq.' + encodeURIComponent(txnId) +
        '&select=id,user_id,amount,statut,type');
      if (!Array.isArray(txRows) || !txRows[0]) {
        return res.status(404).json({ error: 'Transaction introuvable' });
      }
      const txn = txRows[0];
      if (txn.statut !== 'pending') {
        return res.status(400).json({ error: 'Cette transaction n\'est plus en attente' });
      }

      /* Marquer la transaction comme échouée */
      await supabaseRequest('PATCH',
        '/transactions?id=eq.' + encodeURIComponent(txnId),
        { statut: 'failed', status: 'failed', validated_by: 'admin', validated_at: now,
          rejection_reason: reason || 'Rejeté par l\'administrateur' });

      /* Recréditer le solde */
      const amount = Number(txn.amount) || 0;
      if (amount > 0) {
        try {
          const uRows = await supabaseRequest('GET',
            '/users?id=eq.' + encodeURIComponent(txn.user_id) + '&select=id,epargne');
          if (Array.isArray(uRows) && uRows[0]) {
            const newEp = (Number(uRows[0].epargne) || 0) + amount;
            await supabaseRequest('PATCH',
              '/users?id=eq.' + encodeURIComponent(txn.user_id),
              { epargne: newEp, updated_at: now });
          }
        } catch (e) {
          console.warn('[reject-withdrawal] recrédit:', e.message);
        }
      }

      /* Notification */
      await createNotification(
        txn.user_id,
        'withdrawal',
        '⚠️ Retrait non effectué',
        `Votre retrait de ${amount.toLocaleString('fr-FR')} GNF a été rejeté. ` +
        (reason ? `Motif : ${reason}. ` : '') +
        'Le montant a été recrédité sur votre solde.',
        { txn_id: txnId, amount }
      );

      console.log('[reject-withdrawal] txn=' + txnId + ' user=' + txn.user_id + ' recredited=' + amount);
      return res.status(200).json({ ok: true, action: 'reject-withdrawal', txnId, recredited: amount });

    } catch (err) {
      return res.status(500).json({ error: 'Erreur rejet : ' + err.message });
    }
  }

  /* ════════════ CONFIRM-ALIPAY (Module 4) ════════════ */
  if (action === 'confirm-alipay') {
    const { txnId, adminNote } = body;
    if (!txnId) return res.status(400).json({ error: 'txnId requis' });

    try {
      const txRows = await supabaseRequest('GET',
        '/transactions?id=eq.' + encodeURIComponent(txnId) +
        '&select=id,user_id,amount,statut,type,currency');
      if (!Array.isArray(txRows) || !txRows[0]) {
        return res.status(404).json({ error: 'Transaction introuvable' });
      }
      const txn = txRows[0];
      if (txn.type !== 'depot_alipay') {
        return res.status(400).json({ error: 'Cette transaction n\'est pas un dépôt Alipay' });
      }
      if (txn.statut === 'completed') {
        return res.status(400).json({ error: 'Ce dépôt est déjà confirmé' });
      }

      const amount = Number(txn.amount) || 0;

      /* Marquer la transaction */
      await supabaseRequest('PATCH',
        '/transactions?id=eq.' + encodeURIComponent(txnId),
        { statut: 'completed', status: 'success', validated_by: 'admin', validated_at: now });

      /* Créditer l'épargne (montant converti par admin — on crédite la valeur brute) */
      const uRows = await supabaseRequest('GET',
        '/users?id=eq.' + encodeURIComponent(txn.user_id) + '&select=id,epargne');
      if (Array.isArray(uRows) && uRows[0]) {
        const newEp = (Number(uRows[0].epargne) || 0) + amount;
        await supabaseRequest('PATCH',
          '/users?id=eq.' + encodeURIComponent(txn.user_id),
          { epargne: newEp, pending_deposit: null, updated_at: now });
      }

      /* Notification */
      await createNotification(
        txn.user_id,
        'deposit',
        '✅ Dépôt Alipay confirmé',
        `Votre dépôt Alipay de ${amount.toLocaleString('fr-FR')} ${txn.currency || 'CNY'} a été validé et crédité.`,
        { txn_id: txnId, amount }
      );

      console.log('[confirm-alipay] txn=' + txnId + ' user=' + txn.user_id + ' amount=' + amount);
      return res.status(200).json({ ok: true, action: 'confirm-alipay', txnId, amount });

    } catch (err) {
      return res.status(500).json({ error: 'Erreur confirmation Alipay : ' + err.message });
    }
  }

  /* ════════════ REJECT-ALIPAY (Module 4) ════════════ */
  if (action === 'reject-alipay') {
    const { txnId, reason } = body;
    if (!txnId) return res.status(400).json({ error: 'txnId requis' });

    try {
      const txRows = await supabaseRequest('GET',
        '/transactions?id=eq.' + encodeURIComponent(txnId) +
        '&select=id,user_id,amount,statut,type,currency');
      if (!Array.isArray(txRows) || !txRows[0]) {
        return res.status(404).json({ error: 'Transaction introuvable' });
      }
      const txn = txRows[0];
      if (txn.statut !== 'pending') {
        return res.status(400).json({ error: 'Ce dépôt n\'est plus en attente' });
      }

      await supabaseRequest('PATCH',
        '/transactions?id=eq.' + encodeURIComponent(txnId),
        { statut: 'failed', status: 'failed', validated_by: 'admin', validated_at: now,
          rejection_reason: reason || 'Rejeté par l\'administrateur' });

      /* Effacer le pending_deposit de l'utilisateur */
      try {
        await supabaseRequest('PATCH',
          '/users?id=eq.' + encodeURIComponent(txn.user_id),
          { pending_deposit: null });
      } catch (e) { console.warn('[reject-alipay] pending_deposit clear:', e.message); }

      /* Notification */
      await createNotification(
        txn.user_id,
        'deposit',
        '❌ Dépôt Alipay rejeté',
        `Votre dépôt Alipay de ${(txn.amount||0).toLocaleString('fr-FR')} ${txn.currency||'CNY'} a été rejeté. ` +
        (reason ? `Motif : ${reason}.` : 'Contactez le support pour plus d\'informations.'),
        { txn_id: txnId, amount: txn.amount }
      );

      console.log('[reject-alipay] txn=' + txnId);
      return res.status(200).json({ ok: true, action: 'reject-alipay', txnId });

    } catch (err) {
      return res.status(500).json({ error: 'Erreur rejet Alipay : ' + err.message });
    }
  }

  /* ════════════ UPDATE-SETTINGS ════════════ */
  if (action === 'update-settings') {
    const { merchant_config } = body;
    if (!merchant_config || typeof merchant_config !== 'object') {
      return res.status(400).json({ error: 'merchant_config requis' });
    }
    try {
      /* Upsert : PATCH si la ligne existe, POST sinon */
      const updated = await supabaseRequest('PATCH', '/settings?key=eq.merchant_config', {
        value: merchant_config,
        updated_at: new Date().toISOString(),
      });
      if (!Array.isArray(updated) || updated.length === 0) {
        await supabaseRequest('POST', '/settings', {
          key: 'merchant_config',
          value: merchant_config,
          updated_at: new Date().toISOString(),
        });
      }
      return res.status(200).json({ ok: true, action: 'update-settings' });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur sauvegarde paramètres : ' + err.message });
    }
  }

  /* ════════════ MIGRATE BALANCES ════════════
     Recalcule les actuel de tous les projets actifs depuis les transactions.
     Identifie les utilisateurs avec excédent.
  */
  if (action === 'migrate_balances') {
    try {
      const projects = await supabaseRequest('GET',
        '/projects?status=eq.active&select=id,user_id,goal,actuel&limit=1000');
      if (!Array.isArray(projects)) return res.status(500).json({ error: 'Impossible de charger les projets' });

      let recalculated = 0, errors = 0;
      for (const proj of projects) {
        try {
          const txns = await supabaseRequest('GET',
            '/transactions?project_id=eq.' + encodeURIComponent(proj.id) +
            '&statut=eq.completed&is_credit=eq.true&select=amount');
          const totalDeposited = Array.isArray(txns)
            ? txns.reduce((s, t) => s + (Number(t.amount) || 0), 0)
            : 0;
          /* Plafond = objectif × 1,01 (marge Epargn+ intégrée) */
          const maxActuel = proj.goal ? Math.round(proj.goal * 1.01) : Infinity;
          const cappedActuel = Math.min(totalDeposited, maxActuel);
          if (Math.abs(cappedActuel - (proj.actuel || 0)) > 1) {
            await supabaseRequest('PATCH',
              '/projects?id=eq.' + encodeURIComponent(proj.id),
              { actuel: cappedActuel, has_funds: cappedActuel > 0 });
          }
          recalculated++;
        } catch { errors++; }
      }

      /* Identifier les utilisateurs en excédent — même logique que /api/admin/data :
         alloué = Σ min(actuel, objectif × 1,01) ; excédent = solde − alloué. */
      const users = await supabaseRequest('GET',
        '/users?select=id,phone,prenom,epargne&limit=1000');
      const surplusUsers = [];
      if (Array.isArray(users)) {
        for (const u of users) {
          try {
            const userProjs = await supabaseRequest('GET',
              '/projects?user_id=eq.' + encodeURIComponent(u.id) +
              '&status=eq.active&select=goal,actuel');
            let allocated = 0, capacite = 0, dansProjets = 0;
            (Array.isArray(userProjs) ? userProjs : []).forEach((p) => {
              const actuel = Number(p.actuel) || 0;
              const target = Math.round((Number(p.goal) || 0) * 1.01);
              allocated   += Math.min(actuel, target);
              capacite    += Math.max(target - actuel, 0);
              dansProjets += actuel;
            });
            let solde = Number(u.epargne) || 0;

            /* ── Réconciliation : le solde ne peut JAMAIS être inférieur à ce
               qui est placé dans les projets. Sinon on le relève (corrige les
               cas où un dépôt a crédité actuel mais pas epargne → solde affiché
               qui oscille). On ne BAISSE jamais le solde (préserve l'argent libre). */
            if (solde < dansProjets) {
              try {
                await supabaseRequest('PATCH',
                  '/users?id=eq.' + encodeURIComponent(u.id),
                  { epargne: dansProjets, updated_at: now });
                solde = dansProjets;
              } catch (e) {}
            }

            /* Excédent = argent hors projet (solde − Σ actuel) */
            const excedent = Math.max(0, solde - dansProjets);
            if (excedent > 100) surplusUsers.push({
              user_id: u.id, phone: u.phone, prenom: u.prenom || '',
              solde_actuel: solde, dans_projets: dansProjets, alloue: allocated,
              capacite_restante: capacite, excedent,
              nb_projets_actifs: (Array.isArray(userProjs) ? userProjs.length : 0),
            });
          } catch {}
        }
      }
      surplusUsers.sort((a, b) => b.excedent - a.excedent);

      console.log('[migrate_balances] recalculated=' + recalculated + ' errors=' + errors +
        ' surplusUsers=' + surplusUsers.length);
      return res.status(200).json({
        ok: true, action: 'migrate_balances', recalculated, errors,
        surplusUsers: surplusUsers.slice(0, 50),
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur migration : ' + err.message });
    }
  }

  /* ════════════ REATTRIBUTE SURPLUS ════════════
     Réattribue manuellement le surplus d'un utilisateur vers un projet.
  */
  if (action === 'reattribute_surplus') {
    const { targetUserId: surplusUserId, projectId: targetProjectId } = body;
    if (!surplusUserId || !targetProjectId) {
      return res.status(400).json({ error: 'targetUserId et projectId requis' });
    }
    try {
      const [uRows, projRows] = await Promise.all([
        supabaseRequest('GET', '/users?id=eq.' + encodeURIComponent(surplusUserId) + '&select=id,epargne'),
        supabaseRequest('GET', '/projects?id=eq.' + encodeURIComponent(targetProjectId) + '&select=id,goal,actuel,status'),
      ]);
      const u    = Array.isArray(uRows)    && uRows[0];
      const proj = Array.isArray(projRows) && projRows[0];
      if (!u || !proj) return res.status(404).json({ error: 'Utilisateur ou projet introuvable' });
      if (proj.status !== 'active') return res.status(400).json({ error: 'Projet non actif' });

      /* Plafond = objectif × 1,01 (marge Epargn+) − déjà déposé */
      const effTarget = Math.round((Number(proj.goal) || 0) * 1.01);
      const remaining = Math.max(0, effTarget - (Number(proj.actuel) || 0));
      const injection = Math.min(Number(u.epargne) || 0, remaining);

      if (injection <= 0) return res.status(400).json({ error: 'Aucun excédent à réattribuer ou projet plein' });

      /* Mettre à jour le projet */
      await supabaseRequest('PATCH',
        '/projects?id=eq.' + encodeURIComponent(targetProjectId),
        { actuel: (proj.actuel || 0) + injection, has_funds: true, updated_at: now });

      /* Créer transaction */
      const ref = 'SURPLUS-' + now.slice(0,10).replace(/-/g,'') +
        '-' + Math.random().toString(36).substr(2,5).toUpperCase();
      await supabaseRequest('POST', '/transactions', {
        user_id:   surplusUserId, type: 'deposit', amount: injection,
        is_credit: true, project_id: targetProjectId,
        statut: 'completed', status: 'success',
        label: ref + ' · Réattribution excédent (admin)',
      });

      /* Log */
      try {
        await supabaseRequest('POST', '/surplus_log', {
          user_id: surplusUserId, project_id: targetProjectId,
          surplus_amount: u.epargne, injected_amount: injection,
          remaining: (u.epargne || 0) - injection, status: 'manual',
        });
      } catch {}

      /* Notification */
      await createNotification(surplusUserId, 'deposit',
        '💰 Solde réattribué',
        `${injection.toLocaleString('fr-FR')} GNF de votre solde non affecté ont été injectés dans votre projet.`,
        { project_id: targetProjectId, amount: injection });

      return res.status(200).json({ ok: true, action: 'reattribute_surplus', injection, remaining });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur réattribution : ' + err.message });
    }
  }

  /* ════════════ AUTO-REATTRIBUTE — remplir les projets avec l'excédent ════════════
     Répartit l'excédent LIBRE de l'utilisateur (solde − Σ actuel) dans ses
     projets actifs encore incomplets, en comblant d'abord ceux les plus
     proches de leur objectif (× 1,01). N'utilise QUE l'argent hors projet. */
  if (action === 'reattribute_auto') {
    const surplusUserId = body.targetUserId;
    if (!surplusUserId) return res.status(400).json({ error: 'targetUserId requis' });
    try {
      const uRows = await supabaseRequest('GET',
        '/users?id=eq.' + encodeURIComponent(surplusUserId) + '&select=id,epargne');
      const u = Array.isArray(uRows) && uRows[0];
      if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

      const projs = await supabaseRequest('GET',
        '/projects?user_id=eq.' + encodeURIComponent(surplusUserId) +
        '&status=eq.active&select=id,name,goal,actuel');
      const list = Array.isArray(projs) ? projs : [];

      const solde       = Number(u.epargne) || 0;
      const dansProjets = list.reduce((s, p) => s + (Number(p.actuel) || 0), 0);
      let freeBalance   = Math.max(0, solde - dansProjets);

      if (freeBalance <= 0) {
        return res.status(400).json({ error: 'Aucun excédent libre : tout le solde est déjà placé.' });
      }

      /* Projets incomplets, comblés du plus proche de l'objectif au plus loin */
      const targets = list.map((p) => {
        const goal      = Number(p.goal) || 0;
        const actuel    = Number(p.actuel) || 0;
        const effTarget = Math.round(goal * 1.01);
        return { id: p.id, name: p.name, actuel, room: Math.max(0, effTarget - actuel) };
      }).filter((t) => t.room > 0).sort((a, b) => a.room - b.room);

      let totalInjected = 0;
      const filled = [];
      for (const t of targets) {
        if (freeBalance <= 0) break;
        const inject = Math.min(freeBalance, t.room);
        if (inject <= 0) continue;
        const newActuel = t.actuel + inject;
        await supabaseRequest('PATCH',
          '/projects?id=eq.' + encodeURIComponent(t.id),
          { actuel: newActuel, has_funds: true, updated_at: now });
        const ref = 'SURPLUS-' + now.slice(0, 10).replace(/-/g, '') +
          '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
        await supabaseRequest('POST', '/transactions', {
          user_id: surplusUserId, type: 'deposit', amount: inject,
          is_credit: true, project_id: t.id, statut: 'completed', status: 'success',
          label: ref + ' · Auto-remplissage excédent (admin)',
        });
        freeBalance   -= inject;
        totalInjected += inject;
        filled.push({ name: t.name, amount: inject });
      }

      if (totalInjected <= 0) {
        return res.status(400).json({ error: 'Aucun projet en cours à remplir (tous déjà pleins).' });
      }

      try {
        await createNotification(surplusUserId, 'deposit', '💰 Excédent réparti',
          totalInjected.toLocaleString('fr-FR') + ' GNF de votre solde ont été répartis dans vos projets en cours.',
          { amount: totalInjected });
      } catch {}

      return res.status(200).json({
        ok: true, action: 'reattribute_auto',
        injected: totalInjected, remaining: freeBalance, filled,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur auto-réattribution : ' + err.message });
    }
  }

  /* ════════════ AUTO-REATTRIBUTE ALL — tous les utilisateurs en excédent ════════════
     Pour CHAQUE utilisateur ayant un excédent libre (solde − Σ actuel),
     répartit cet excédent dans ses projets actifs incomplets (les plus
     proches de l'objectif × 1,01 d'abord). Opération en lot. */
  if (action === 'reattribute_all') {
    try {
      const allUsers = await supabaseRequest('GET',
        '/users?select=id,phone,epargne&limit=1000');
      const allProjs = await supabaseRequest('GET',
        '/projects?status=eq.active&select=id,user_id,name,goal,actuel&limit=2000');

      const byUser = {};
      (Array.isArray(allProjs) ? allProjs : []).forEach((p) => {
        (byUser[p.user_id] = byUser[p.user_id] || []).push(p);
      });

      let usersProcessed = 0, totalInjected = 0, projectsFilled = 0;

      for (const u of (Array.isArray(allUsers) ? allUsers : [])) {
        const projs = byUser[u.id] || [];
        if (!projs.length) continue;
        const solde       = Number(u.epargne) || 0;
        const dansProjets = projs.reduce((s, p) => s + (Number(p.actuel) || 0), 0);
        let freeBalance   = Math.max(0, solde - dansProjets);
        if (freeBalance <= 0) continue;

        const targets = projs.map((p) => {
          const goal      = Number(p.goal) || 0;
          const actuel    = Number(p.actuel) || 0;
          const effTarget = Math.round(goal * 1.01);
          return { id: p.id, actuel, room: Math.max(0, effTarget - actuel) };
        }).filter((t) => t.room > 0).sort((a, b) => a.room - b.room);

        let userInjected = 0;
        for (const t of targets) {
          if (freeBalance <= 0) break;
          const inject = Math.min(freeBalance, t.room);
          if (inject <= 0) continue;
          await supabaseRequest('PATCH',
            '/projects?id=eq.' + encodeURIComponent(t.id),
            { actuel: t.actuel + inject, has_funds: true, updated_at: now });
          const ref = 'SURPLUS-' + now.slice(0, 10).replace(/-/g, '') +
            '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
          await supabaseRequest('POST', '/transactions', {
            user_id: u.id, type: 'deposit', amount: inject,
            is_credit: true, project_id: t.id, statut: 'completed', status: 'success',
            label: ref + ' · Auto-remplissage excédent (lot)',
          });
          freeBalance   -= inject;
          userInjected  += inject;
          totalInjected += inject;
          projectsFilled++;
        }
        if (userInjected > 0) {
          usersProcessed++;
          try {
            await createNotification(u.id, 'deposit', '💰 Excédent réparti',
              userInjected.toLocaleString('fr-FR') + ' GNF de votre solde ont été répartis dans vos projets en cours.',
              { amount: userInjected });
          } catch {}
        }
      }

      console.log('[reattribute_all] users=' + usersProcessed +
        ' injected=' + totalInjected + ' projects=' + projectsFilled);
      return res.status(200).json({
        ok: true, action: 'reattribute_all',
        usersProcessed, projectsFilled, totalInjected,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur réattribution globale : ' + err.message });
    }
  }

  /* ════════════ EMAIL TEMPLATE MANAGEMENT ════════════ */

  if (action === 'update_email_template') {
    const { templateId, subject, body_html, body_text, active } = body;
    if (!templateId) return res.status(400).json({ error: 'templateId requis' });
    try {
      const patch = { updated_at: now };
      if (subject !== undefined)   patch.subject   = subject;
      if (body_html !== undefined) patch.body_html  = body_html;
      if (body_text !== undefined) patch.body_text  = body_text;
      if (active !== undefined)    patch.active     = Boolean(active);
      await supabaseRequest('PATCH',
        '/email_templates?id=eq.' + encodeURIComponent(templateId), patch);
      return res.status(200).json({ ok: true, action: 'update_email_template' });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur template: ' + err.message });
    }
  }

  if (action === 'send_test_email') {
    const { trigger: trigName, toEmail, vars: templateVars } = body;
    if (!trigName || !toEmail) return res.status(400).json({ error: 'trigger et toEmail requis' });
    try {
      const { trigger: emailTrigFn } = require('../_lib/email');
      const result = await emailTrigFn(trigName, null, templateVars || {
        prenom: 'Test Admin', montant: '100 000 GNF', nouveauSolde: '500 000 GNF',
        reference: 'TEST-001', operateur: 'Orange Money',
        date: new Date().toLocaleDateString('fr-FR'),
        motif: 'Test motif', projet: 'Mon projet test', progression: '65',
        tontineName: 'Groupe Test', inviter: 'Admin', mise: '50 000 GNF',
        sujet: 'Conseil test', conseil: 'Épargnez régulièrement pour atteindre vos objectifs.',
        jours: 7,
      }, toEmail);
      return res.status(200).json({ ok: result.ok, emailId: result.id, error: result.error });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur envoi test: ' + err.message });
    }
  }

  if (action === 'create_email_campaign') {
    const { name: campName, template_id, segment, scheduled_at } = body;
    if (!campName) return res.status(400).json({ error: 'name requis' });
    try {
      const created = await supabaseRequest('POST', '/email_campaigns', {
        name: campName, template_id: template_id || null,
        segment: segment || 'all', status: 'draft',
        scheduled_at: scheduled_at || null,
      });
      return res.status(200).json({ ok: true, action: 'create_email_campaign', campaign: Array.isArray(created) ? created[0] : created });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur campagne: ' + err.message });
    }
  }

  if (action === 'run_email_campaign') {
    const { campaignId } = body;
    if (!campaignId) return res.status(400).json({ error: 'campaignId requis' });
    try {
      await supabaseRequest('PATCH',
        '/email_campaigns?id=eq.' + encodeURIComponent(campaignId),
        { status: 'running' });
      const { runCampaign } = require('../_lib/email');
      runCampaign(campaignId).catch(e => console.error('[run_campaign]', e.message));
      return res.status(200).json({ ok: true, action: 'run_email_campaign', campaignId, status: 'running' });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur lancement campagne: ' + err.message });
    }
  }

  /* ════════════ REPLY_TICKET ════════════ */
  if (action === 'reply_ticket') {
    const { ticketId, message: replyMsg, newStatus } = body;
    if (!ticketId || !replyMsg) return res.status(400).json({ error: 'ticketId et message requis' });
    try {
      /* Insérer la réponse */
      await supabaseRequest('POST', '/ticket_replies', {
        ticket_id: ticketId, author_id: null, message: replyMsg, is_admin: true,
      });
      /* Mettre à jour le ticket */
      const patch = { admin_reply: replyMsg, updated_at: now };
      if (newStatus) patch.status = newStatus;
      if (newStatus === 'resolved') patch.resolved_at = now;
      await supabaseRequest('PATCH', '/support_tickets?id=eq.' + encodeURIComponent(ticketId), patch);
      /* Récupérer le ticket pour notifier le client */
      try {
        const tRows = await supabaseRequest('GET',
          '/support_tickets?id=eq.' + encodeURIComponent(ticketId) + '&select=user_id,subject');
        if (Array.isArray(tRows) && tRows[0]) {
          await createNotification(
            tRows[0].user_id, 'support',
            '💬 Réponse à votre demande',
            `Votre demande "${tRows[0].subject}" a reçu une réponse de l'équipe Epargn+.`,
            { ticket_id: ticketId }
          );
        }
      } catch (ne) { console.warn('[reply_ticket] notification:', ne.message); }
      console.log('[reply_ticket] ticket=' + ticketId + (newStatus ? ' status→' + newStatus : ''));
      return res.status(200).json({ ok: true, action: 'reply_ticket', ticketId });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur réponse ticket : ' + err.message });
    }
  }

  /* ════════════ UPDATE_TICKET ════════════ */
  if (action === 'update_ticket') {
    const { ticketId, status: tStatus, priority: tPriority } = body;
    if (!ticketId) return res.status(400).json({ error: 'ticketId requis' });
    const allowed = ['open','in_progress','resolved','closed'];
    const allowedP = ['low','normal','high','urgent'];
    if (tStatus && !allowed.includes(tStatus)) return res.status(400).json({ error: 'status invalide' });
    if (tPriority && !allowedP.includes(tPriority)) return res.status(400).json({ error: 'priority invalide' });
    try {
      const patch = { updated_at: now };
      if (tStatus)   patch.status   = tStatus;
      if (tPriority) patch.priority = tPriority;
      if (tStatus === 'resolved') patch.resolved_at = now;
      await supabaseRequest('PATCH', '/support_tickets?id=eq.' + encodeURIComponent(ticketId), patch);
      return res.status(200).json({ ok: true, action: 'update_ticket', ticketId, status: tStatus, priority: tPriority });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur mise à jour ticket : ' + err.message });
    }
  }

  /* ════════════ CREATE_PROMO ════════════ */
  if (action === 'create_promo') {
    const { code, description: promoDesc, type: promoType, value: promoVal,
            currency: promoCur, max_uses, target_country, expires_at } = body;
    if (!code || !promoType || promoVal === undefined) {
      return res.status(400).json({ error: 'code, type et value requis' });
    }
    const validTypes = ['bonus_deposit','fee_free','cashback'];
    if (!validTypes.includes(promoType)) return res.status(400).json({ error: 'type invalide' });
    try {
      const row = {
        code: code.toUpperCase().trim(),
        description: promoDesc || '',
        type: promoType,
        value: Number(promoVal),
        currency: promoCur || 'GNF',
        active: true,
        uses_count: 0,
      };
      if (max_uses)        row.max_uses        = parseInt(max_uses, 10);
      if (target_country)  row.target_country  = target_country;
      if (expires_at)      row.expires_at      = expires_at;
      const created = await supabaseRequest('POST', '/promo_codes', row);
      const result = Array.isArray(created) ? created[0] : created;
      console.log('[create_promo] code=' + row.code);
      return res.status(200).json({ ok: true, action: 'create_promo', promo: result });
    } catch (err) {
      if (err.message && err.message.includes('unique')) {
        return res.status(409).json({ error: 'Ce code promo existe déjà.' });
      }
      return res.status(500).json({ error: 'Erreur création promo : ' + err.message });
    }
  }

  /* ════════════ TOGGLE_PROMO ════════════ */
  if (action === 'toggle_promo') {
    const { promoId, active: promoActive } = body;
    if (!promoId || promoActive === undefined) return res.status(400).json({ error: 'promoId et active requis' });
    try {
      await supabaseRequest('PATCH', '/promo_codes?id=eq.' + encodeURIComponent(promoId), {
        active: Boolean(promoActive),
      });
      return res.status(200).json({ ok: true, action: 'toggle_promo', promoId, active: promoActive });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur toggle promo : ' + err.message });
    }
  }

  /* ════════════ DELETE_PROMO ════════════ */
  if (action === 'delete_promo') {
    const { promoId } = body;
    if (!promoId) return res.status(400).json({ error: 'promoId requis' });
    try {
      try { await supabaseRequest('DELETE', '/promo_uses?promo_id=eq.' + encodeURIComponent(promoId)); } catch {}
      await supabaseRequest('DELETE', '/promo_codes?id=eq.' + encodeURIComponent(promoId));
      return res.status(200).json({ ok: true, action: 'delete_promo', promoId });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur suppression promo : ' + err.message });
    }
  }

  /* ════════════ SEND_BROADCAST ════════════ */
  if (action === 'send_broadcast') {
    const { title: bTitle, message: bMsg, target: bTarget } = body;
    if (!bTitle || !bMsg) return res.status(400).json({ error: 'title et message requis' });
    const validTargets = ['all','gn','bj','ci','cn'];
    const target = validTargets.includes(bTarget) ? bTarget : 'all';
    try {
      /* Récupérer les utilisateurs ciblés */
      let usersQuery = '/users?select=id&limit=1000';
      if (target !== 'all') usersQuery += '&country=eq.' + target;
      const targetUsers = await supabaseRequest('GET', usersQuery);
      const userList = Array.isArray(targetUsers) ? targetUsers : [];

      /* Créer une notification pour chaque utilisateur */
      let sentCount = 0;
      for (const u of userList) {
        try {
          await createNotification(u.id, 'broadcast', bTitle, bMsg, { broadcast: true });
          sentCount++;
        } catch (e) { /* continuer */ }
      }

      /* Enregistrer le broadcast */
      try {
        await supabaseRequest('POST', '/broadcasts', {
          title: bTitle, message: bMsg, target, sent_count: sentCount, created_by: 'admin',
        });
      } catch (e) { console.warn('[send_broadcast] save broadcast:', e.message); }

      console.log('[send_broadcast] target=' + target + ' sent=' + sentCount);
      return res.status(200).json({ ok: true, action: 'send_broadcast', sentCount, target });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur broadcast : ' + err.message });
    }
  }

  /* ════════════ DELETE-ACCOUNT ════════════ */
  if (action === 'delete-account') {
    const { targetUserId, reason } = body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId requis' });
    try {
      try { await supabaseRequest('DELETE', '/notifications?user_id=eq.' + encodeURIComponent(targetUserId)); } catch {}
      try { await supabaseRequest('DELETE', '/project_members?user_id=eq.' + encodeURIComponent(targetUserId)); } catch {}
      try { await supabaseRequest('DELETE', '/transactions?user_id=eq.' + encodeURIComponent(targetUserId)); } catch {}
      try { await supabaseRequest('DELETE', '/projects?user_id=eq.' + encodeURIComponent(targetUserId)); } catch {}
      await supabaseRequest('DELETE', '/users?id=eq.' + encodeURIComponent(targetUserId));
      console.log('[delete-account] user=' + targetUserId + ' reason=' + (reason || '—'));
      return res.status(200).json({ ok: true, action: 'delete-account', targetUserId });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur suppression compte : ' + err.message });
    }
  }

  /* ════════════ Requiert userId ════════════ */
  const { userId, txnId } = body;
  if (!userId || !action) return res.status(400).json({ error: 'userId et action requis' });

  try {
    const userRows = await supabaseRequest('GET',
      '/users?id=eq.' + encodeURIComponent(userId) +
      '&select=id,epargne,pending_deposit,operator');
    if (!Array.isArray(userRows) || userRows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    const user = userRows[0];

    /* ════════════ APPROVE ════════════ */
    if (action === 'approve') {
      let depositAmount = parseInt(body.amount, 10) || 0;
      let projectId     = body.projectId || null;

      if (txnId) {
        try {
          const txRows = await supabaseRequest('GET',
            '/transactions?id=eq.' + encodeURIComponent(txnId) + '&select=amount,project_id,statut');
          if (Array.isArray(txRows) && txRows[0]) {
            /* Idempotence : refuser si déjà validé */
            if (txRows[0].statut === 'completed') {
              return res.status(409).json({ error: 'Ce dépôt est déjà approuvé — opération ignorée pour éviter un double crédit.' });
            }
            if (!depositAmount) depositAmount = Number(txRows[0].amount) || 0;
            if (!projectId)     projectId     = txRows[0].project_id   || null;
          }
        } catch (e) {}
      }

      if (user.pending_deposit) {
        try {
          const pd = JSON.parse(user.pending_deposit);
          if (!depositAmount) depositAmount = Number(pd.amount) || 0;
          if (!projectId && pd.projectId) projectId = pd.projectId;
        } catch {}
      }

      if (!depositAmount || depositAmount < 1) {
        return res.status(400).json({ error: 'Montant invalide' });
      }

      if (txnId) {
        try {
          await supabaseRequest('PATCH',
            '/transactions?id=eq.' + encodeURIComponent(txnId),
            { statut: 'completed', status: 'success', validated_by: 'admin', validated_at: now });
        } catch (e) {}
      } else {
        try {
          const ref = 'DEP-' + now.slice(0,10).replace(/-/g,'') + '-' +
            Math.random().toString(36).substr(2,6).toUpperCase();
          await supabaseRequest('POST', '/transactions', {
            user_id: userId, type: 'deposit', amount: depositAmount, is_credit: true,
            statut: 'completed', status: 'success',
            label: ref + ' · Dépôt validé admin', project_id: projectId,
            operator: user.operator || 'Mobile Money',
          });
        } catch (e) {}
      }

      /* Crédit intégral du dépôt — aucun frais (la marge Epargn+ de 1% est
         intégrée silencieusement au seuil des 100%, pas prélevée sur le dépôt). */
      const netForServer = depositAmount;
      const newEpargne   = (Number(user.epargne) || 0) + netForServer;
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { epargne: newEpargne, pending_deposit: null });

      /* ── Mettre à jour projects.actuel (avec cap strict sur goal) ── */
      if (projectId) {
        try {
          const projRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(projectId) + '&select=id,actuel,goal,status');
          if (Array.isArray(projRows) && projRows[0]) {
            const proj = projRows[0];
            /* Plafond = objectif × 1,01 (marge Epargn+) − déjà déposé */
            const effTarget  = Math.round((Number(proj.goal) || 0) * 1.01);
            const maxAllowed = Math.max(0, effTarget - (Number(proj.actuel) || 0));

            /* Vérification admin : bloquer si dépasse le plafond */
            if (netForServer > maxAllowed && maxAllowed >= 0) {
              console.warn('[approve] montant dépasse le plafond projet: net=' + netForServer +
                ' remaining=' + maxAllowed + ' projectId=' + projectId);
              /* On plafonne automatiquement au maximum autorisé */
              const cappedNet = maxAllowed;
              if (cappedNet > 0) {
                const newActuel = (Number(proj.actuel) || 0) + cappedNet;
                await supabaseRequest('PATCH',
                  '/projects?id=eq.' + encodeURIComponent(projectId),
                  { actuel: newActuel, has_funds: true, updated_at: now,
                    ...(newActuel >= effTarget ? { status: 'completed' } : {}) });
              }
            } else if (netForServer > 0) {
              const newActuel = Math.min(
                (Number(proj.actuel) || 0) + netForServer,
                effTarget || Infinity
              );
              await supabaseRequest('PATCH',
                '/projects?id=eq.' + encodeURIComponent(projectId),
                { actuel: newActuel, has_funds: true, updated_at: now,
                  ...(newActuel >= (effTarget || Infinity) ? { status: 'completed' } : {}) });
            }
          }
        } catch (projErr) {
          console.warn('[approve] update project actuel:', projErr.message);
        }
      }

      await createNotification(userId, 'deposit', '✅ Dépôt confirmé',
        `Votre dépôt de ${depositAmount.toLocaleString('fr-FR')} GNF a été validé.`,
        { amount: depositAmount, projectId });

      /* Email dépôt validé */
      try {
        const uRows = await supabaseRequest('GET',
          '/users?id=eq.' + encodeURIComponent(userId) + '&select=email,prenom,country,currency&limit=1');
        const u = Array.isArray(uRows) && uRows[0];
        if (u && u.email) {
          const cur = u.currency || 'GNF';
          let projName = null, progression = null;
          if (projectId) {
            try {
              const pr = await supabaseRequest('GET',
                '/projects?id=eq.' + encodeURIComponent(projectId) + '&select=name,goal,actuel&limit=1');
              if (Array.isArray(pr) && pr[0]) {
                projName = pr[0].name;
                progression = pr[0].goal > 0 ? Math.round((pr[0].actuel || 0) / pr[0].goal * 100) : 0;
              }
            } catch {}
          }
          emailTrig('deposit_approved', userId, {
            prenom:       u.prenom || '',
            montant:      depositAmount.toLocaleString('fr-FR') + ' ' + cur,
            nouveauSolde: newEpargne.toLocaleString('fr-FR') + ' ' + cur,
            projet:       projName || '',
            progression:  progression !== null ? String(progression) : '',
          }, u.email).catch(() => {});
        }
      } catch {}

      console.log('[approve] user=' + userId + ' deposit=' + depositAmount + ' epargne=' + newEpargne);
      return res.status(200).json({
        ok: true, action: 'approved', epargne: newEpargne, depositAmount, projectId: projectId || null,
      });

    /* ════════════ REJECT ════════════ */
    } else if (action === 'reject') {
      if (txnId) {
        try {
          await supabaseRequest('PATCH',
            '/transactions?id=eq.' + encodeURIComponent(txnId),
            { statut: 'failed', status: 'failed' });
        } catch (e) {}
      }
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { pending_deposit: null });

      await createNotification(userId, 'deposit', '❌ Dépôt rejeté',
        'Votre demande de dépôt a été rejetée. Contactez le support.',
        { txnId });

      /* Email dépôt rejeté */
      try {
        const uRows = await supabaseRequest('GET',
          '/users?id=eq.' + encodeURIComponent(userId) + '&select=email,prenom,currency&limit=1');
        const u = Array.isArray(uRows) && uRows[0];
        if (u && u.email) {
          emailTrig('deposit_rejected', userId, {
            prenom:  u.prenom || '',
            montant: (body.amount || 0).toLocaleString('fr-FR') + ' ' + (u.currency || 'GNF'),
          }, u.email).catch(() => {});
        }
      } catch {}

      return res.status(200).json({ ok: true, action: 'rejected' });

    /* ════════════ SET ════════════ */
    } else if (action === 'set') {
      const setAmount = parseInt(body.amount, 10);
      if (isNaN(setAmount) || setAmount < 0) return res.status(400).json({ error: 'Montant invalide' });
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { epargne: setAmount, pending_deposit: null });
      return res.status(200).json({ ok: true, action: 'set', epargne: setAmount });

    } else {
      return res.status(400).json({ error: 'Action non reconnue : ' + action });
    }

  } catch (err) {
    console.error('[update-balance]', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
