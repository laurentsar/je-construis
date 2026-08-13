/* update-check.js — vérification de mise à jour applicative.
 * Ce dépôt héberge plusieurs apps ; chacune publie ses Releases avec un
 * préfixe de tag distinct (ex. "iptv-v1.0"), donc on liste les releases et on
 * filtre par préfixe plutôt que d'utiliser /releases/latest (qui donnerait la
 * dernière release du dépôt entier, toutes apps confondues).
 *
 * Config (dans index.html, avant ce script) :
 *   window.UPDATE_REPO = 'laurentsar/<repo>';   // obligatoire
 *   window.UPDATE_TAG_PREFIX = 'iptv-v';         // obligatoire
 *   window.APP_VERSION = '1.0';                  // obligatoire (version installée)
 *
 * Autonome : aucune dépendance, styles injectés. Anti-spam : 1 requête / 6 h,
 * mémorise la version ignorée. Échec réseau silencieux.
 */
(function () {
  'use strict';
  var REPO = window.UPDATE_REPO;
  var PREFIX = window.UPDATE_TAG_PREFIX || '';
  var CURRENT = window.APP_VERSION;
  if (!REPO || !CURRENT) return;

  var POLL_INTERVAL = 6 * 3600 * 1000; // 6 h
  var KEY_POLL = 'updPoll:' + REPO + ':' + PREFIX;
  var KEY_DISMISS = 'updDismiss:' + REPO + ':' + PREFIX;

  function ls(get, k, v) {
    try { return get ? localStorage.getItem(k) : localStorage.setItem(k, v); }
    catch (e) { return null; }
  }

  function cmp(va, vb) {
    var a = String(va).replace(/^v/, '').split('.');
    var b = String(vb).replace(/^v/, '').split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var d = (parseInt(a[i], 10) || 0) - (parseInt(b[i], 10) || 0);
      if (d) return d;
    }
    return 0;
  }

  var last = parseInt(ls(true, KEY_POLL), 10) || 0;
  if (Date.now() - last < POLL_INTERVAL) return;

  fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=20&_=' + Date.now(), {
    headers: { Accept: 'application/vnd.github+json' }
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (releases) {
      if (!Array.isArray(releases)) return;
      ls(false, KEY_POLL, Date.now());
      var rel = releases.filter(function (r) {
        return r.tag_name && r.tag_name.indexOf(PREFIX) === 0;
      })[0];
      if (!rel) return;
      var latest = rel.tag_name.slice(PREFIX.length);
      if (cmp(latest, CURRENT) <= 0) return;          // déjà à jour
      if (ls(true, KEY_DISMISS) === latest) return;    // version déjà ignorée
      var apk = (rel.assets || []).filter(function (a) {
        return /\.apk$/i.test(a.name);
      })[0];
      showBanner(latest, apk ? apk.browser_download_url : rel.html_url);
    })
    .catch(function () { /* hors-ligne : silencieux */ });

  function showBanner(version, url) {
    if (document.getElementById('update-banner')) return;
    var css = document.createElement('style');
    css.textContent =
      '#update-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;' +
      'display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;' +
      'background:#1f2937;color:#f9fafb;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
      'font:500 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'max-width:520px;margin:0 auto}' +
      '#update-banner .ub-txt{flex:1;min-width:0}' +
      '#update-banner b{color:#fff}' +
      '#update-banner a.ub-act,#update-banner button.ub-act{flex:none;background:#22c55e;' +
      'color:#06210f;text-decoration:none;border:0;font-weight:700;font-size:14px;' +
      'padding:8px 14px;border-radius:10px;cursor:pointer}' +
      '#update-banner button.ub-x{flex:none;background:transparent;border:0;color:#9ca3af;' +
      'font-size:18px;line-height:1;cursor:pointer;padding:4px}';
    document.head.appendChild(css);

    var b = document.createElement('div');
    b.id = 'update-banner';
    var txt = document.createElement('span');
    txt.className = 'ub-txt';
    txt.innerHTML = '🔄 Nouvelle version <b>v' + version + '</b> disponible';

    var canInstall = typeof window.installApkUpdate === 'function' &&
      window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UpdatePlugin;
    var act;
    if (canInstall) {
      act = document.createElement('button');
      act.className = 'ub-act';
      act.textContent = '⬇ Installer';
      act.onclick = function () {
        act.disabled = true; act.textContent = '⏳ Installation…';
        window.installApkUpdate(url, act, function () {
          act.disabled = false; act.textContent = '⬇ Installer';
        });
      };
    } else {
      act = document.createElement('a');
      act.className = 'ub-act';
      act.href = url; act.target = '_blank'; act.rel = 'noopener';
      act.textContent = 'Télécharger';
    }

    var x = document.createElement('button');
    x.className = 'ub-x';
    x.setAttribute('aria-label', 'Ignorer'); x.textContent = '✕';
    x.onclick = function () { ls(false, KEY_DISMISS, version); b.remove(); };
    b.appendChild(txt); b.appendChild(act); b.appendChild(x);
    (document.body || document.documentElement).appendChild(b);
  }
})();
