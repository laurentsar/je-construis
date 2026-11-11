/*
 * update-check.js — vérification de mise à jour applicative (générique).
 * Interroge la dernière Release GitHub, compare au numéro embarqué et affiche
 * une carte « Mise à jour disponible » avec le changelog si une version plus
 * récente est publiée.
 *
 * Config (dans index.html, avant ce script) :
 *   window.UPDATE_REPO = 'laurentsar/<repo>';   // obligatoire
 *   window.APP_VERSION = '1.2';                  // obligatoire (version installée)
 *
 * Autonome : aucune dépendance, styles injectés. Anti-spam : 1 requête / 6 h,
 * mémorise la version ignorée. Échec réseau silencieux.
 */
(function () {
  'use strict';
  var REPO = window.UPDATE_REPO;
  var CURRENT = window.APP_VERSION;
  if (!REPO || !CURRENT) return;

  var POLL_INTERVAL = 6 * 3600 * 1000; // 6 h
  var KEY_POLL = 'updPoll:' + REPO;
  var KEY_DISMISS = 'updDismiss:' + REPO;

  function ls(get, k, v) {
    try { return get ? localStorage.getItem(k) : localStorage.setItem(k, v); }
    catch (e) { return null; }
  }

  // Compare deux versions "a.b.c" → >0 si va plus récente que vb.
  function cmp(va, vb) {
    var a = String(va).replace(/^v/, '').split('.');
    var b = String(vb).replace(/^v/, '').split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var d = (parseInt(a[i], 10) || 0) - (parseInt(b[i], 10) || 0);
      if (d) return d;
    }
    return 0;
  }

  // Ne garde que les lignes à puces ("- xxx" / "* xxx") des notes de
  // version : le reste (titres, phrases libres) n'est pas du changelog
  // exploitable pour un affichage en liste.
  function extraireNotes(body) {
    if (!body) return [];
    return String(body).split('\n')
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return /^[-*]\s+\S/.test(l); })
      .map(function (l) { return l.replace(/^[-*]\s+/, ''); })
      .slice(0, 6);
  }

  var last = parseInt(ls(true, KEY_POLL), 10) || 0;
  if (Date.now() - last < POLL_INTERVAL) return;

  // Cache-buster (_) : évite qu'un service worker "cache-first" serve une
  // réponse d'API périmée. GitHub ignore les paramètres inconnus.
  fetch('https://api.github.com/repos/' + REPO + '/releases/latest?_=' + Date.now(), {
    headers: { Accept: 'application/vnd.github+json' }
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rel) {
      if (!rel || !rel.tag_name) return;
      ls(false, KEY_POLL, Date.now());
      var latest = String(rel.tag_name).replace(/^v/, '');
      if (cmp(latest, CURRENT) <= 0) return;          // déjà à jour
      if (ls(true, KEY_DISMISS) === latest) return;    // version déjà ignorée
      var apk = (rel.assets || []).filter(function (a) {
        return /\.apk$/i.test(a.name);
      })[0];
      showCard(latest, apk ? apk.browser_download_url : rel.html_url, extraireNotes(rel.body));
    })
    .catch(function () { /* hors-ligne : silencieux */ });

  function showCard(version, url, notes) {
    if (document.getElementById('update-card')) return;
    var css = document.createElement('style');
    css.textContent =
      '#update-card{position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;' +
      'background:#131f2b;color:#e6edf6;border:1px solid #24384a;border-radius:16px;' +
      'box-shadow:0 10px 32px rgba(0,0,0,.45);font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'max-width:480px;margin:0 auto;padding:16px}' +
      '#update-card .uc-head{display:flex;align-items:center;gap:10px}' +
      '#update-card .uc-ico{flex:none;font-size:22px}' +
      '#update-card .uc-title{font-weight:700;font-size:16px;color:#fff}' +
      '#update-card .uc-sub{color:#93a5ba;font-size:13px;margin-top:2px}' +
      '#update-card ul.uc-notes{margin:12px 0 2px;padding:0 0 0 18px;color:#c3cedb}' +
      '#update-card ul.uc-notes li{margin-bottom:4px}' +
      '#update-card .uc-row{display:flex;gap:10px;margin-top:14px}' +
      '#update-card a.uc-install,#update-card button.uc-install{flex:1;background:#4ec98a;' +
      'color:#06210f;text-decoration:none;text-align:center;border:0;font-weight:700;font-size:14px;' +
      'padding:10px 14px;border-radius:10px;cursor:pointer}' +
      '#update-card button.uc-later{flex:none;background:transparent;border:1px solid #24384a;' +
      'color:#93a5ba;font-size:14px;font-weight:600;padding:10px 14px;border-radius:10px;cursor:pointer}';
    document.head.appendChild(css);

    var card = document.createElement('div');
    card.id = 'update-card';

    var head = document.createElement('div');
    head.className = 'uc-head';
    head.innerHTML = '<span class="uc-ico">🏗️</span>' +
      '<span><span class="uc-title">Mise à jour disponible</span>' +
      '<div class="uc-sub">Version ' + version + ' prête · installée : ' + CURRENT + '</div></span>';
    card.appendChild(head);

    if (notes.length) {
      var ul = document.createElement('ul');
      ul.className = 'uc-notes';
      notes.forEach(function (n) {
        var li = document.createElement('li');
        li.textContent = n;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    var row = document.createElement('div');
    row.className = 'uc-row';

    // Si le plugin natif est présent (APK) : bouton qui télécharge + INSTALLE
    // directement. Sinon lien de téléchargement navigateur (PWA).
    var canInstall = typeof window.installApkUpdate === 'function' &&
      window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UpdatePlugin;
    var act;
    if (canInstall) {
      act = document.createElement('button');
      act.className = 'uc-install';
      act.textContent = '⬇ Installer v' + version;
      act.onclick = function () {
        act.disabled = true; act.textContent = '⏳ Installation…';
        window.installApkUpdate(url, act, function () {
          act.disabled = false; act.textContent = '⬇ Installer v' + version;
        });
      };
    } else {
      act = document.createElement('a');
      act.className = 'uc-install';
      act.href = url; act.target = '_blank'; act.rel = 'noopener';
      act.textContent = '⬇ Installer v' + version;
    }

    var later = document.createElement('button');
    later.className = 'uc-later';
    later.textContent = 'Plus tard';
    later.onclick = function () { ls(false, KEY_DISMISS, version); card.remove(); };

    row.appendChild(act); row.appendChild(later);
    card.appendChild(row);
    (document.body || document.documentElement).appendChild(card);
  }
})();
