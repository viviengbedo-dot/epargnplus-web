/*
 * native-bridge.js — cohérence App Store Guideline 4.
 * Actif UNIQUEMENT quand la page tourne DANS l'app native (Capacitor).
 * Empêche les liens d'ouvrir le navigateur externe (Safari), ce qui fait
 * "sortir" l'utilisateur de l'app — motif de rejet Apple.
 *
 * Règles :
 *  - Navigation même-site normale (epargnplus.com)  -> reste dans la webview.
 *  - Lien target="_blank" (même site OU web externe) -> ouvert IN-APP
 *    (SFSafariViewController via @capacitor/browser).
 *  - Liens qui ouvrent une AUTRE app (WhatsApp, Telegram, tel:, mailto:)
 *    -> laissés au système (comportement attendu, accepté par Apple).
 *
 * Sur le web classique (hors app), ce script ne fait RIEN.
 */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return;

  function inAppBrowser(url) {
    try {
      var B = Cap.Plugins && Cap.Plugins.Browser;
      if (B && B.open) { B.open({ url: url, presentationStyle: 'popover' }); return true; }
    } catch (e) {}
    return false;
  }

  // Hôtes web dont le but est d'ouvrir une autre app -> laisser le système gérer.
  var APP_LINK_HOSTS = /(^|\.)(wa\.me|api\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|chat\.whatsapp\.com)$/i;
  function isSameSite(host) { return /(^|\.)epargnplus\.com$/i.test(host || ''); }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var proto = a.protocol || '';
    // tel:, mailto:, whatsapp:, autres schémas d'app -> comportement par défaut
    if (proto !== 'http:' && proto !== 'https:') return;
    var host = a.hostname || '';
    if (APP_LINK_HOSTS.test(host)) return;            // WhatsApp/Telegram -> app externe (OK)
    var blank = (a.target === '_blank');
    if (isSameSite(host) && !blank) return;           // navigation normale -> webview
    // Reste : target=_blank (même site OU externe) ou web tiers -> in-app browser
    if (inAppBrowser(a.href)) e.preventDefault();
  }, true);

  // window.open(...) -> in-app browser (sinon Capacitor ouvre Safari externe)
  var _open = window.open;
  window.open = function (url) {
    if (url && /^https?:/i.test(String(url)) && !APP_LINK_HOSTS.test((function () {
      try { return new URL(url, location.href).hostname; } catch (e) { return ''; }
    })())) {
      if (inAppBrowser(new URL(url, location.href).href)) return null;
    }
    return _open.apply(window, arguments);
  };
})();
