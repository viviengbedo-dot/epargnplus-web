/**
 * POST /api/admin/update-balance — Epargn+ v5
 * Actions admin : approuver/rejeter dépôts, gérer projets, retraits collectifs, Alipay.
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
 */

const { supabaseRequest } = require('../_lib/supabase');
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
            label:      ref + ' · Retrait — Clôture ' + (project.name || 'Épargne Collective'),
            note:       'Clôture du projet collectif par l\'administrateur',
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
        { statut: 'completed', status: 'success', validated_by: 'admin', validated_at: now,
          ...(adminNote ? { note: adminNote } : {}) });

      /* Notification */
      await createNotification(
        txn.user_id,
        'withdrawal',
        '✅ Remboursement confirmé',
        `Votre remboursement de ${(txn.amount || 0).toLocaleString('fr-FR')} GNF a été envoyé avec succès.`,
        { txn_id: txnId, amount: txn.amount }
      );

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

      const netForServer = Math.floor(depositAmount * 0.98);
      const newEpargne   = (Number(user.epargne) || 0) + netForServer;
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { epargne: newEpargne, pending_deposit: null });

      /* Mettre à jour projects.actuel si le dépôt est lié à un projet */
      if (projectId) {
        try {
          const projRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(projectId) + '&select=id,actuel,goal');
          if (Array.isArray(projRows) && projRows[0]) {
            const newActuel = Math.min(
              (Number(projRows[0].actuel) || 0) + netForServer,
              Number(projRows[0].goal) || Infinity
            );
            await supabaseRequest('PATCH',
              '/projects?id=eq.' + encodeURIComponent(projectId),
              { actuel: newActuel, updated_at: now });
          }
        } catch (projErr) {
          console.warn('[approve] update project actuel:', projErr.message);
        }
      }

      await createNotification(userId, 'deposit', '✅ Dépôt confirmé',
        `Votre dépôt de ${depositAmount.toLocaleString('fr-FR')} GNF a été validé.`,
        { amount: depositAmount, projectId });

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
