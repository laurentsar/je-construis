/*
 * plans.js — dessine les plans cotés du carport en SVG, à partir du résultat
 * de Calc.calculer().
 *
 * Quatre vues, comme sur une fiche de charpentier : perspective, face (dans le
 * sens de la pente), côté (dans le sens de la longueur) et dessus (structure).
 *
 * Tout est vectoriel et calculé : changer une cote redessine les plans, il n'y
 * a aucune image à maintenir. Les vues sont volontairement en fil de fer épais
 * plutôt qu'en rendu réaliste — sur un chantier, ce qu'on lit, ce sont les
 * cotes et les positions, pas les ombres.
 */
(function (global) {
  'use strict';

  var BOIS = '#d9a05b', BOIS_SOMBRE = '#a9743a', BOIS_CLAIR = '#e8bd83';
  var SOL = '#2c3e50', COTE = '#8fa3bd', TEXTE = '#dbe4f0';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function n(x) { return Math.round(x * 10) / 10; }

  // --- primitives -----------------------------------------------------------
  function rect(x, y, w, h, fill, stroke) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) +
      '" fill="' + fill + '" stroke="' + (stroke || BOIS_SOMBRE) + '" stroke-width="1.2"/>';
  }

  function poly(pts, fill, stroke) {
    return '<polygon points="' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' ') +
      '" fill="' + fill + '" stroke="' + (stroke || BOIS_SOMBRE) + '" stroke-width="1.2"/>';
  }

  function line(x1, y1, x2, y2, col, w, dash) {
    return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) +
      '" stroke="' + (col || COTE) + '" stroke-width="' + (w || 1) + '"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }

  function texte(x, y, s, opts) {
    opts = opts || {};
    return '<text x="' + n(x) + '" y="' + n(y) + '" fill="' + (opts.fill || TEXTE) +
      '" font-size="' + (opts.size || 11) + '" font-family="system-ui, sans-serif"' +
      ' text-anchor="' + (opts.anchor || 'middle') + '"' +
      (opts.weight ? ' font-weight="' + opts.weight + '"' : '') + '>' + esc(s) + '</text>';
  }

  // Cotation horizontale : trait à flèches + valeur au-dessus.
  function cotaH(x1, x2, y, label) {
    var t = 4;
    return line(x1, y, x2, y, COTE, 1) +
      line(x1, y - t, x1, y + t, COTE, 1) +
      line(x2, y - t, x2, y + t, COTE, 1) +
      texte((x1 + x2) / 2, y - 6, label, { fill: COTE, size: 11 });
  }

  // Cotation verticale.
  function cotaV(x, y1, y2, label) {
    var t = 4;
    return line(x, y1, x, y2, COTE, 1) +
      line(x - t, y1, x + t, y1, COTE, 1) +
      line(x - t, y2, x + t, y2, COTE, 1) +
      '<text x="' + n(x - 6) + '" y="' + n((y1 + y2) / 2) + '" fill="' + COTE +
      '" font-size="11" font-family="system-ui, sans-serif" text-anchor="end"' +
      ' dominant-baseline="middle">' + esc(label) + '</text>';
  }

  function svg(w, h, body, titre) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" ' +
      'preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(titre) + '">' +
      '<rect width="' + w + '" height="' + h + '" fill="#101a24" rx="10"/>' +
      texte(w / 2, 18, titre, { size: 12, weight: '700', fill: '#f0a83e' }) +
      body + '</svg>';
  }

  // --------------------------------------------------------------------------
  // VUE DE FACE — on regarde le carport dans le sens de la longueur, donc on
  // voit la largeur et la pente. C'est la vue qui montre le mieux le monopente.
  // --------------------------------------------------------------------------
  function vueFace(r) {
    var p = r.parametres, s = r.structure;
    var W = 460, H = 260, mx = 70, my = 48, sol = H - 42;
    var largeur = +p.largeur, hHaut = +p.hautAvant, hBas = +p.hautArriere;
    var k = Math.min((W - 2 * mx) / largeur, (sol - my) / (hHaut * 1.25));

    var x0 = mx, x1 = mx + largeur * k;
    var yHaut = sol - hHaut * k, yBas = sol - hBas * k;
    var ep = Math.max(6, (s.sectionPoteau[0] / 1000) * k);
    var epPanne = Math.max(7, (s.sectionPanne[1] / 1000) * k);
    var epChevron = Math.max(4, (s.sectionChevron[1] / 1000) * k);
    var debHaut = (+p.debordHaut || 0) * k, debBas = (+p.debordBas || 0) * k;

    var b = '';
    b += line(0, sol, W, sol, SOL, 3);                       // sol

    // Chevron (il court d'un bord à l'autre, en pente) + couverture au-dessus.
    var xa = x0 - debHaut, xb = x1 + debBas;
    var ya = yHaut - (yBas - yHaut) * (debHaut / (largeur * k));
    var yb = yBas + (yBas - yHaut) * (debBas / (largeur * k));
    b += poly([[xa, ya - epChevron], [xb, yb - epChevron], [xb, yb], [xa, ya]], BOIS, BOIS_SOMBRE);
    b += line(xa, ya - epChevron - 3, xb, yb - epChevron - 3, '#9fb4cc', 3);   // couverture

    // Pannes vues en bout (un rectangle sous le chevron, à chaque extrémité).
    b += rect(x0 - ep / 2, yHaut, ep * 1.6, epPanne, BOIS_CLAIR);
    b += rect(x1 - ep * 1.1, yBas, ep * 1.6, epPanne, BOIS_CLAIR);

    // Poteaux.
    b += rect(x0 - ep / 2, yHaut + epPanne, ep, sol - yHaut - epPanne, BOIS_SOMBRE, '#7a5326');
    b += rect(x1 - ep / 2, yBas + epPanne, ep, sol - yBas - epPanne, BOIS_SOMBRE, '#7a5326');

    // Jambes de force.
    if (s.nbJambes) {
      var j = 0.6 * k;
      b += poly([[x0 + ep / 2, yHaut + epPanne + j], [x0 + ep / 2 + j, yHaut + epPanne],
        [x0 + ep / 2 + j, yHaut + epPanne + 8], [x0 + ep / 2 + 8, yHaut + epPanne + j]], BOIS, BOIS_SOMBRE);
      b += poly([[x1 - ep / 2, yBas + epPanne + j], [x1 - ep / 2 - j, yBas + epPanne],
        [x1 - ep / 2 - j, yBas + epPanne + 8], [x1 - ep / 2 - 8, yBas + epPanne + j]], BOIS, BOIS_SOMBRE);
    }

    // Cotes.
    b += cotaH(x0, x1, sol + 26, largeur.toFixed(2) + ' m');
    b += cotaV(x0 - 26, sol, yHaut, hHaut.toFixed(2) + ' m');
    b += cotaV(x1 + 46, sol, yBas, hBas.toFixed(2) + ' m');
    b += line(x1, yBas, x1 + 40, yBas, COTE, 1, '3 3');
    b += line(x0, sol, x0 - 22, sol, COTE, 1, '3 3');
    b += texte(W / 2, sol + 46, 'pente ' + r.geometrie.pentePct + ' %  ·  ' + r.geometrie.angle + '°',
      { fill: '#f0a83e', size: 11 });

    return svg(W, H, b, 'VUE DE FACE (dans le sens de la pente)');
  }

  // --------------------------------------------------------------------------
  // VUE DE CÔTÉ — dans le sens de la longueur : on voit la file de poteaux et
  // la panne qui les relie.
  // --------------------------------------------------------------------------
  function vueCote(r) {
    var p = r.parametres, s = r.structure;
    var W = 460, H = 240, mx = 60, my = 46, sol = H - 40;
    var longueur = +p.longueur, h = +p.hautAvant;
    var k = Math.min((W - 2 * mx) / (longueur + 2 * (+p.debordCote || 0)), (sol - my) / (h * 1.2));

    var deb = (+p.debordCote || 0) * k;
    var x0 = mx + deb, x1 = x0 + longueur * k;
    var y = sol - h * k;
    var ep = Math.max(6, (s.sectionPoteau[0] / 1000) * k);
    var epPanne = Math.max(8, (s.sectionPanne[1] / 1000) * k);

    var b = '';
    b += line(0, sol, W, sol, SOL, 3);
    b += rect(x0 - deb, y, longueur * k + 2 * deb, epPanne, BOIS, BOIS_SOMBRE);   // panne
    b += line(x0 - deb, y - 4, x1 + deb, y - 4, '#9fb4cc', 3);                    // couverture

    var pas = (x1 - x0) / (s.nbParRangee - 1);
    for (var i = 0; i < s.nbParRangee; i++) {
      var x = x0 + i * pas;
      b += rect(x - ep / 2, y + epPanne, ep, sol - y - epPanne, BOIS_SOMBRE, '#7a5326');
      if (s.nbJambes) {
        var j = 0.6 * k;
        b += poly([[x - ep / 2, y + epPanne + j], [x - ep / 2 - j, y + epPanne],
          [x - ep / 2 - j, y + epPanne + 7], [x - ep / 2 - 7, y + epPanne + j]], BOIS, BOIS_SOMBRE);
        b += poly([[x + ep / 2, y + epPanne + j], [x + ep / 2 + j, y + epPanne],
          [x + ep / 2 + j, y + epPanne + 7], [x + ep / 2 + 7, y + epPanne + j]], BOIS, BOIS_SOMBRE);
      }
      if (i < s.nbParRangee - 1) {
        b += cotaH(x, x + pas, sol + 22, s.entraxePoteaux.toFixed(2) + ' m');
      }
    }

    b += cotaH(x0, x1, sol + 44, longueur.toFixed(2) + ' m');
    b += cotaV(x0 - 26, sol, y, h.toFixed(2) + ' m');
    b += texte(W / 2, 34, s.nbParRangee + ' poteaux par file  ·  ' + s.nbPoteaux + ' au total',
      { fill: '#8fa3bd', size: 10 });

    return svg(W, H, b, 'VUE DE CÔTÉ (dans le sens de la longueur)');
  }

  // --------------------------------------------------------------------------
  // VUE DE DESSUS — la structure seule : les deux pannes, les chevrons, et les
  // poteaux en pointillés (ils sont dessous).
  // --------------------------------------------------------------------------
  function vueDessus(r) {
    var p = r.parametres, s = r.structure;
    var W = 460, H = 250, mx = 56, my = 46;
    var L = +p.longueur, l = +p.largeur;
    var k = Math.min((W - 2 * mx) / L, (H - my - 56) / l);

    var x0 = mx, y0 = my + 6;
    var x1 = x0 + L * k, y1 = y0 + l * k;
    var epPanne = Math.max(5, (s.sectionPanne[0] / 1000) * k * 3);
    var epChev = Math.max(3, (s.sectionChevron[0] / 1000) * k * 3);

    var b = '';
    // Chevrons (perpendiculaires aux pannes).
    var pasChev = (x1 - x0) / (s.nbChevrons - 1);
    for (var i = 0; i < s.nbChevrons; i++) {
      var x = x0 + i * pasChev;
      b += rect(x - epChev / 2, y0, epChev, y1 - y0, BOIS, BOIS_SOMBRE);
    }
    // Pannes.
    b += rect(x0, y0, x1 - x0, epPanne, BOIS_CLAIR);
    b += rect(x0, y1 - epPanne, x1 - x0, epPanne, BOIS_CLAIR);
    // Poteaux dessous.
    var pas = (x1 - x0) / (s.nbParRangee - 1);
    for (var j = 0; j < s.nbParRangee; j++) {
      var px = x0 + j * pas, r2 = Math.max(3, (s.sectionPoteau[0] / 1000) * k / 2);
      b += '<rect x="' + n(px - r2) + '" y="' + n(y0 - r2 + epPanne / 2) + '" width="' + n(r2 * 2) +
        '" height="' + n(r2 * 2) + '" fill="none" stroke="#f0a83e" stroke-width="1.2" stroke-dasharray="3 2"/>';
      b += '<rect x="' + n(px - r2) + '" y="' + n(y1 - r2 - epPanne / 2) + '" width="' + n(r2 * 2) +
        '" height="' + n(r2 * 2) + '" fill="none" stroke="#f0a83e" stroke-width="1.2" stroke-dasharray="3 2"/>';
    }

    b += cotaH(x0, x1, y1 + 30, L.toFixed(2) + ' m');
    b += cotaV(x0 - 22, y0, y1, l.toFixed(2) + ' m');
    b += texte(W / 2, H - 12, s.nbChevrons + ' chevrons ' + Calc.sectionTexte(s.sectionChevron) +
      ' · entraxe ' + Math.round(s.entraxeChevrons * 100) + ' cm', { fill: '#8fa3bd', size: 10 });

    return svg(W, H, b, 'VUE DE DESSUS (structure)');
  }

  // --------------------------------------------------------------------------
  // PERSPECTIVE — projection isométrique simple. Elle ne sert pas à mesurer,
  // seulement à comprendre d'un coup d'œil ce qu'on va monter.
  // --------------------------------------------------------------------------
  function vueIso(r) {
    var p = r.parametres, s = r.structure;
    var W = 460, H = 300;
    var L = +p.longueur, l = +p.largeur, hA = +p.hautAvant, hB = +p.hautArriere;

    var k = Math.min(320 / (L + l), 150 / Math.max(hA, 1));
    var cx = W / 2, cy = H - 60;
    var COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);

    function P(x, y, z) {   // x = longueur, y = largeur, z = hauteur
      return [cx + (x - y) * COS * k, cy + (x + y) * SIN * k - z * k];
    }

    var b = '';
    // Dalle.
    b += poly([P(0, 0, 0), P(L, 0, 0), P(L, l, 0), P(0, l, 0)], '#243343', '#33475c');

    // Hauteur au droit d'une largeur donnée (interpolation de la pente).
    function hauteurA(y) { return hA + (hB - hA) * (y / l); }

    // Poteaux.
    var pas = L / (s.nbParRangee - 1);
    for (var i = 0; i < s.nbParRangee; i++) {
      var x = i * pas;
      [0, l].forEach(function (y) {
        var h = hauteurA(y);
        var a = P(x, y, 0), c = P(x, y, h);
        b += line(a[0], a[1], c[0], c[1], BOIS_SOMBRE, 6);
      });
    }

    // Pannes (le long de la longueur, à chaque bord).
    [0, l].forEach(function (y) {
      var h = hauteurA(y);
      var a = P(0, y, h), c = P(L, y, h);
      b += line(a[0], a[1], c[0], c[1], BOIS_CLAIR, 5);
    });

    // Chevrons (traversent la largeur, en pente).
    var pasC = L / (s.nbChevrons - 1);
    for (var j = 0; j < s.nbChevrons; j++) {
      var xc = j * pasC;
      var a2 = P(xc, 0, hA + 0.05), c2 = P(xc, l, hB + 0.05);
      b += line(a2[0], a2[1], c2[0], c2[1], BOIS, 2.5);
    }

    // Arête de couverture, pour lire le plan du toit.
    var t1 = P(0, 0, hA + 0.08), t2 = P(L, 0, hA + 0.08),
        t3 = P(L, l, hB + 0.08), t4 = P(0, l, hB + 0.08);
    b += poly([t1, t2, t3, t4], 'rgba(159,180,204,0.18)', '#9fb4cc');

    b += texte(W / 2, H - 14, L.toFixed(2) + ' m × ' + l.toFixed(2) + ' m  ·  ' +
      Calc.arrondi(L * l, 1) + ' m² d\'emprise au sol', { fill: '#8fa3bd', size: 11 });

    return svg(W, H, b, 'PERSPECTIVE');
  }

  global.Plans = {
    face: vueFace, cote: vueCote, dessus: vueDessus, iso: vueIso,
    toutes: function (r) {
      return [vueIso(r), vueFace(r), vueCote(r), vueDessus(r)];
    }
  };
})(window);
