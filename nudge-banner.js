/* ═══════════════════════════════════════════════════════════════
   Epargn+ — nudge-banner.js
   Bannière de rappel dynamique basée sur les biais comportementaux.
   Choisit le message selon le projet, son % de progression,
   l'inactivité et le caractère collectif.
   Dépend des globaux du dashboard : PROJETS, TRANSACTIONS,
   openDepositForProject(), openDepositPicker(), openModal().
   Intégration : <div id="nudgeBannerSlot"></div> + renderNudgeBanner()
   après loadProjects() / loadTransactions().
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS_DISMISS = 'epargn_nudge_dismissed'; /* {date, key} */
  var LS_ROTATE  = 'epargn_nudge_rotation';  /* compteur pour varier les textes */

  function fmt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  /* PROJETS / TRANSACTIONS sont déclarés avec `let` dans dashboard.html :
     accessibles par nom global, mais pas via window.* */
  function getProjets()      { try { return typeof PROJETS      !== 'undefined' && Array.isArray(PROJETS)      ? PROJETS      : []; } catch (e) { return []; } }
  function getTransactions() { try { return typeof TRANSACTIONS !== 'undefined' && Array.isArray(TRANSACTIONS) ? TRANSACTIONS : []; } catch (e) { return []; } }

  /* Jours depuis le dernier dépôt (crédit) sur un projet */
  function daysSinceDeposit(projectId) {
    var txns = getTransactions().filter(function (t) {
      return t.isCredit && t.rawDate && (!projectId || t.projectId === projectId);
    });
    if (!txns.length) return null;
    var last = txns.reduce(function (a, b) {
      return new Date(a.rawDate) > new Date(b.rawDate) ? a : b;
    });
    return Math.floor((Date.now() - new Date(last.rawDate).getTime()) / 86400000);
  }

  /* ── Catalogue : chaque entrée = { bias, icon, title, sub } ──
     Toutes les données affichées sont réelles (progression, jours,
     membres). Pas de fausse urgence : la confiance avant tout.   */
  function buildCandidates(p, cur) {
    var pct     = p.cible > 0 ? Math.min(100, Math.round((p.actuel / p.cible) * 100)) : 0;
    var restant = Math.max(0, p.cible - p.actuel);
    var nom     = esc(p.nom);
    var days    = daysSinceDeposit(p.id);
    var coll    = (p.members_count || 1) > 1;
    var out     = [];

    /* Priorité 1 — inactivité */
    if (days !== null && days >= 30 && pct < 100) {
      out.push({ prio: 1, bias: 'fresh-start', icon: '🌱',
        title: 'On repart de bon pied ?',
        sub: '« ' + nom + ' » vous attend patiemment à ' + pct + '%. Le meilleur jour pour reprendre, c\'est aujourd\'hui.' });
    } else if (days !== null && days >= 14 && pct < 100) {
      out.push({ prio: 1, bias: 'loss-aversion', icon: '⏳',
        title: days + ' jours sans dépôt',
        sub: 'Vos ' + fmt(p.actuel) + ' ' + cur + ' sur « ' + nom + ' » sont en sécurité, mais votre élan s\'évapore. Reprenez avant que reprendre devienne difficile.' });
    } else if (days !== null && days >= 7 && pct < 100) {
      out.push({ prio: 2, bias: 'habitude', icon: '👋',
        title: '« ' + nom + ' » ne vous a pas vu depuis ' + days + ' jours',
        sub: 'Une habitude se garde en la pratiquant — même un petit dépôt suffit à la maintenir.' });
    }

    /* Priorité 2 — paliers de progression */
    if (pct >= 100) {
      out.push({ prio: 3, bias: 'peak-end', icon: '🏆',
        title: 'Objectif « ' + nom + ' » atteint !',
        sub: fmt(p.cible) + ' ' + cur + ' épargnés. Vous savez maintenant que vous en êtes capable — quel sera votre prochain défi ?',
        cta: 'Nouveau projet', action: 'new' });
    } else if (pct >= 75) {
      out.push({ prio: 2, bias: 'loss-aversion', icon: '🔥',
        title: nom + ' est à ' + pct + '% !',
        sub: 'Ne laissez pas ces ' + fmt(p.actuel) + ' ' + cur + ' d\'efforts inachevés. Plus que ' + fmt(restant) + ' ' + cur + ' — finissez en beauté.' });
      out.push({ prio: 2, bias: 'goal-gradient', icon: '🏁',
        title: 'Plus que ' + fmt(restant) + ' ' + cur + ' pour « ' + nom + ' »',
        sub: 'Vous y êtes presque. Imaginez la notification « Objectif atteint 🏆 » — un dépôt vous en rapproche.' });
    } else if (pct >= 50) {
      out.push({ prio: 3, bias: 'goal-gradient', icon: '⛰️',
        title: 'Le plus dur est derrière vous',
        sub: '« ' + nom + ' » est à ' + pct + '% : il reste moins à épargner que ce que vous avez déjà épargné. Accélérez !' });
    } else if (pct >= 25) {
      out.push({ prio: 3, bias: 'ancrage', icon: '📈',
        title: pct + '% déjà épargnés sur « ' + nom + ' »',
        sub: fmt(p.actuel) + ' ' + cur + ' mis de côté sans que votre vie ne change. La méthode fonctionne — répétez-la cette semaine.' });
    } else if (p.actuel > 0) {
      out.push({ prio: 3, bias: 'endowed-progress', icon: '💪',
        title: 'Vous n\'êtes plus à zéro !',
        sub: fmt(p.actuel) + ' ' + cur + ' déjà sur « ' + nom + ' ». Le plus dur est fait : vous avez commencé. Un dépôt cette semaine garde l\'élan.' });
    } else {
      out.push({ prio: 3, bias: 'demarrage', icon: '🚀',
        title: '« ' + nom + ' » attend son premier dépôt',
        sub: 'Un objectif avec un premier dépôt devient un plan. Peu importe le montant — le premier pas est le plus important.' });
    }

    /* Priorité 2 — collectif (preuve sociale honnête : nombre réel) */
    if (coll && pct < 100) {
      out.push({ prio: 2, bias: 'preuve-sociale', icon: '👥',
        title: (p.members_count) + ' personnes avancent ensemble sur « ' + nom + ' »',
        sub: 'L\'équipe est à ' + pct + '%. Chaque dépôt encourage les autres — soyez celui qui donne l\'exemple cette semaine.' });
    }

    /* Fresh start : 1er du mois ou lundi */
    var d = new Date();
    if ((d.getDate() === 1 || d.getDay() === 1) && pct < 100) {
      out.push({ prio: 3, bias: 'fresh-start', icon: '🌅',
        title: d.getDate() === 1 ? 'Nouveau mois, nouvelle page' : 'Nouvelle semaine, nouvel élan',
        sub: 'Le moment parfait pour le premier dépôt de la période sur « ' + nom + ' ».' });
    }

    return out.map(function (c) { c.project = p; c.pct = pct; return c; });
  }

  function pickNudge() {
    var projets = getProjets().filter(function (p) {
      return p.status === 'active' || p.status === 'completed';
    });
    if (!projets.length) return null;

    var cur = 'GNF';
    try {
      if (typeof _currentUser !== 'undefined' && _currentUser && typeof COUNTRY_LABELS !== 'undefined' && COUNTRY_LABELS[_currentUser.country]) {
        cur = COUNTRY_LABELS[_currentUser.country].currency;
      }
    } catch (e) {}

    var all = [];
    projets.forEach(function (p) { all = all.concat(buildCandidates(p, cur)); });
    if (!all.length) return null;

    all.sort(function (a, b) { return a.prio - b.prio; });
    var top = all.filter(function (c) { return c.prio === all[0].prio; });

    /* Rotation quotidienne pour varier les messages */
    var rot = 0;
    try { rot = parseInt(localStorage.getItem(LS_ROTATE) || '0', 10); } catch (e) {}
    var chosen = top[rot % top.length];
    try { localStorage.setItem(LS_ROTATE, String((rot + 1) % 997)); } catch (e) {}
    return chosen;
  }

  function dismissedToday(key) {
    try {
      var d = JSON.parse(localStorage.getItem(LS_DISMISS) || '{}');
      return d.date === today() && d.key === key;
    } catch (e) { return false; }
  }

  window.dismissNudgeBanner = function (key) {
    try { localStorage.setItem(LS_DISMISS, JSON.stringify({ date: today(), key: key })); } catch (e) {}
    var el = document.getElementById('nudgeBanner');
    if (el) { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 250); }
  };

  window.nudgeBannerCTA = function (projectId, nom, action) {
    if (action === 'new') {
      if (typeof openModal === 'function') openModal('newProject');
      return;
    }
    if (typeof openDepositForProject === 'function' && projectId) {
      openDepositForProject(projectId, nom);
    } else if (typeof openDepositPicker === 'function') {
      openDepositPicker();
    }
  };

  window.renderNudgeBanner = function () {
    var slot = document.getElementById('nudgeBannerSlot');
    if (!slot) return;
    var n = pickNudge();
    if (!n) { slot.innerHTML = ''; return; }

    var key = n.bias + ':' + (n.project.id || n.project.nom);
    if (dismissedToday(key)) { slot.innerHTML = ''; return; }

    var color = n.project.color || '#0B1566';
    var cta   = n.cta || '+ Déposer';
    var pct   = Math.min(100, n.pct);

    slot.innerHTML =
      '<div id="nudgeBanner" class="card mb-6" style="position:relative;overflow:hidden;padding:18px 20px;' +
        'background:linear-gradient(120deg,#0B1566 0%,' + color + ' 130%);color:#fff;transition:opacity .25s;">' +
        '<div style="position:absolute;right:-30px;top:-30px;width:130px;height:130px;border-radius:50%;background:rgba(200,224,0,.13);"></div>' +
        '<button onclick="dismissNudgeBanner(\'' + key.replace(/'/g, "\\'") + '\')" aria-label="Fermer"' +
          ' style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,.15);border:none;color:#fff;' +
          'width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;">✕</button>' +
        '<div style="display:flex;align-items:flex-start;gap:14px;position:relative;z-index:1;">' +
          '<div style="font-size:30px;line-height:1;">' + n.icon + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:15px;font-weight:800;margin-bottom:3px;">' + n.title + '</div>' +
            '<div style="font-size:12.5px;line-height:1.5;opacity:.85;">' + n.sub + '</div>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap;">' +
              '<button onclick="nudgeBannerCTA(\'' + (n.project.id || '') + '\',\'' + esc(n.project.nom).replace(/'/g, "\\'") + '\',\'' + (n.action || '') + '\')"' +
                ' class="btn btn-sm" style="background:#C8E000;color:#0B1566;font-weight:800;border:none;padding:9px 18px;border-radius:10px;cursor:pointer;font-size:13px;">' +
                cta + '</button>' +
              '<div style="flex:1;min-width:120px;display:flex;align-items:center;gap:8px;">' +
                '<div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden;">' +
                  '<div style="width:' + pct + '%;height:100%;border-radius:3px;background:#C8E000;"></div>' +
                '</div>' +
                '<span style="font-size:11px;font-weight:700;color:#C8E000;">' + pct + '%</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  };
})();
