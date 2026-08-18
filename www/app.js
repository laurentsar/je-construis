/*
 * app.js — interface de Je Construis.
 *
 * Un seul état (`P`, les paramètres du projet) alimente tout : dès qu'un champ
 * change, on recalcule et on redessine les six onglets. Il n'y a donc jamais
 * deux vérités à l'écran — la liste de matériaux, les plans et la marche à
 * suivre viennent tous du même calcul.
 *
 * Persistance : localStorage. Le projet courant est enregistré à chaque
 * modification (on ne perd rien en fermant l'app), les projets nommés sont
 * gardés à part, et les cases cochées de la marche à suivre sont retenues par
 * projet — un chantier dure des semaines.
 */
(function () {
  'use strict';

  var K_COURANT = 'jc:courant';
  var K_PROJETS = 'jc:projets';
  var K_PRIX = 'jc:prix';
  var K_COCHES = 'jc:coches';
  var K_ACTIF = 'jc:actif';

  var DEFAUT = {
    nom: 'Mon carport',
    // Terrain : c'est lui qui commande les dimensions quand `autoAjuster` est
    // vrai (le cas par défaut — on part toujours de la place qu'on a).
    terrainLongueur: 7, terrainLargeur: 5, recul: 0, autoAjuster: true,
    longueur: 6, largeur: 4,
    hautAvant: 2.8, hautArriere: 2.5,
    poteauxParRangee: 0,
    sectionPoteau: '150x150',
    entraxeChevrons: 0.6,
    debordHaut: 0.2, debordBas: 0.2, debordCote: 0.1,
    couverture: 'bac_acier',
    piedPoteau: 'reglable',
    essence: 'douglas',
    chargeSup: 0,
    plotCote: 0.5, plotProfondeur: 0.5,
    jambesDeForce: true,
    // Options : elles ne coûtent rien tant qu'elles sont décochées.
    solaire: false, panneau: 'p430', ensoleillement: 'centre', azimut: 'sud',
    onduleur: 'micro', maxPanneaux: 0, tauxAutoconso: 60, prixKwh: 0.25, prixRevente: 0.076,
    elec: false, distanceTableau: 20, nbPrises: 2, nbLampes: 2,
    borneVE: 'aucune', passageVehicule: true,
    prix: {}
  };

  var P = charger(K_COURANT) || Object.assign({}, DEFAUT);
  P.prix = charger(K_PRIX) || P.prix || {};
  var R = null;                 // dernier résultat de calcul
  var coches = charger(K_COCHES) || {};
  // Projet actif : quel guide les six onglets affichent en ce moment.
  // 'carport' (formulaire + calculs), 'gemma' ou 'flash' (guides fixes).
  var projetActif = charger(K_ACTIF) || 'carport';

  // ------------------------------------------------------------------ outils
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function charger(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
  }
  function sauver(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function euros(x) {
    return Math.round(x).toLocaleString('fr-FR') + ' €';
  }

  // ------------------------------------------------------------ formulaire
  // Champs saisis en centimètres mais stockés en mètres : sur un chantier on
  // parle en centimètres pour les débords et les plots, en mètres pour le reste.
  var CHAMPS_CM = ['entraxeChevrons', 'debordHaut', 'debordBas', 'debordCote', 'plotCote', 'plotProfondeur'];

  function remplirSelects() {
    var sc = $('f_couverture');
    Object.keys(Calc.COUVERTURES).forEach(function (k) {
      sc.appendChild(new Option(Calc.COUVERTURES[k].nom, k));
    });
    var sp = $('f_piedPoteau');
    Object.keys(Calc.PIEDS_POTEAU).forEach(function (k) {
      sp.appendChild(new Option(Calc.PIEDS_POTEAU[k].nom, k));
    });
    var se = $('f_essence');
    Object.keys(Calc.ESSENCES).forEach(function (k) {
      se.appendChild(new Option(Calc.ESSENCES[k].nom, k));
    });
    [['f_panneau', Calc.PANNEAUX], ['f_ensoleillement', Calc.ENSOLEILLEMENT],
     ['f_azimut', Calc.AZIMUTS], ['f_borneVE', Calc.BORNES_VE]].forEach(function (paire) {
      var sel = $(paire[0]), dict = paire[1];
      Object.keys(dict).forEach(function (k) { sel.appendChild(new Option(dict[k].nom, k)); });
    });
  }

  function formVersEtat() {
    P.nom = $('f_nom').value || 'Mon carport';
    ['longueur', 'largeur', 'hautAvant', 'hautArriere',
     'terrainLongueur', 'terrainLargeur', 'recul'].forEach(function (k) {
      P[k] = parseFloat($('f_' + k).value) || 0;
    });
    P.autoAjuster = $('f_autoAjuster').checked;
    CHAMPS_CM.forEach(function (k) {
      P[k] = (parseFloat($('f_' + k).value) || 0) / 100;
    });
    P.poteauxParRangee = parseInt($('f_poteauxParRangee').value, 10) || 0;
    P.sectionPoteau = $('f_sectionPoteau').value;
    P.couverture = $('f_couverture').value;
    P.piedPoteau = $('f_piedPoteau').value;
    P.essence = $('f_essence').value;
    P.chargeSup = parseInt($('f_chargeSup').value, 10) || 0;
    P.jambesDeForce = $('f_jambesDeForce').checked;

    P.solaire = $('f_solaire').checked;
    P.panneau = $('f_panneau').value;
    P.ensoleillement = $('f_ensoleillement').value;
    P.azimut = $('f_azimut').value;
    P.onduleur = $('f_onduleur').value;
    ['maxPanneaux', 'tauxAutoconso', 'prixKwh', 'prixRevente',
     'distanceTableau', 'nbPrises', 'nbLampes'].forEach(function (k) {
      P[k] = parseFloat($('f_' + k).value) || 0;
    });
    P.elec = $('f_elec').checked;
    P.borneVE = $('f_borneVE').value;
    P.passageVehicule = $('f_passageVehicule').checked;
  }

  function etatVersForm() {
    $('f_nom').value = P.nom || '';
    ['longueur', 'largeur', 'hautAvant', 'hautArriere',
     'terrainLongueur', 'terrainLargeur', 'recul'].forEach(function (k) {
      $('f_' + k).value = P[k];
    });
    $('f_autoAjuster').checked = P.autoAjuster !== false;
    CHAMPS_CM.forEach(function (k) {
      $('f_' + k).value = Math.round((P[k] || 0) * 100);
    });
    $('f_poteauxParRangee').value = P.poteauxParRangee || 0;
    $('f_sectionPoteau').value = P.sectionPoteau;
    $('f_couverture').value = P.couverture;
    $('f_piedPoteau').value = P.piedPoteau;
    $('f_essence').value = P.essence;
    $('f_chargeSup').value = P.chargeSup || 0;
    $('f_jambesDeForce').checked = P.jambesDeForce !== false;

    $('f_solaire').checked = P.solaire === true;
    $('f_panneau').value = P.panneau || 'p430';
    $('f_ensoleillement').value = P.ensoleillement || 'centre';
    $('f_azimut').value = P.azimut || 'sud';
    $('f_onduleur').value = P.onduleur || 'micro';
    ['maxPanneaux', 'tauxAutoconso', 'prixKwh', 'prixRevente',
     'distanceTableau', 'nbPrises', 'nbLampes'].forEach(function (k) {
      $('f_' + k).value = P[k];
    });
    $('f_elec').checked = P.elec === true;
    $('f_borneVE').value = P.borneVE || 'aucune';
    $('f_passageVehicule').checked = P.passageVehicule !== false;
  }

  // ------------------------------------------------------------------ rendu
  // Quand le terrain commande, les deux champs de dimensions ne se saisissent
  // plus : ils AFFICHENT ce que le terrain permet. Un champ qu'on peut taper
  // mais qui est réécrit à la frappe suivante, c'est le meilleur moyen de faire
  // croire à un bug.
  function rendreTerrain() {
    var t = R.terrain, auto = t.auto;
    ['f_longueur', 'f_largeur'].forEach(function (id) {
      $(id).disabled = !!auto;
      $(id).style.opacity = auto ? 0.65 : 1;
    });
    if (auto) {
      $('f_longueur').value = R.parametres.longueur;
      $('f_largeur').value = R.parametres.largeur;
    }
    $('dimHint').innerHTML = auto
      ? '<strong>Dimensions calculées depuis ton terrain.</strong> Décoche « Adapter le carport au terrain » pour les saisir toi-même.'
      : 'La pente va du côté haut vers le côté bas, dans le sens de la largeur — comme sur un vrai monopente.';

    if (!t.actif) {
      $('terrainBilan').innerHTML = '<p class="hint">Renseigne les dimensions du terrain pour que l\'app cale l\'abri dedans.</p>';
      return;
    }
    $('terrainBilan').innerHTML = '<div class="resume-grid" style="margin-top:10px">' +
      '<div class="stat"><b>' + t.dispoL + ' × ' + t.dispoW + ' m</b><span>place utile après recul</span></div>' +
      '<div class="stat"><b>' + t.empriseToitureL + ' × ' + t.empriseToitureW + ' m</b><span>toiture (débords compris)</span></div>' +
      '<div class="stat"><b>' + t.empriseToitureM2 + ' m²</b><span>emprise réelle</span></div>' +
      '<div class="stat"><b>' + t.voitures + '</b><span>voiture(s) dessous</span></div>' +
      '</div>' +
      (t.margeL !== undefined
        ? '<p class="hint">Il reste ' + t.margeL + ' m dans la longueur et ' + t.margeW +
          ' m dans la largeur, toiture comprise.</p>'
        : '');
  }

  // Les réglages d'une option décochée n'ont rien à faire à l'écran : ils
  // donnent l'impression que l'option est active.
  function rendreOptions() {
    $('solaireForm').style.display = P.solaire ? '' : 'none';
    $('elecForm').style.display = P.elec ? '' : 'none';

    var sol = R.solaire;
    $('solaireBilan').innerHTML = (!sol || !sol.nb)
      ? (P.solaire ? '<p class="hint">Aucun panneau ne tient sur cette toiture.</p>' : '')
      : '<div class="resume-grid" style="margin-top:10px">' +
        '<div class="stat"><b>' + sol.nb + '</b><span>panneaux (' + sol.parRangee + ' × ' + sol.rangees +
          ', ' + sol.sens + ')</span></div>' +
        '<div class="stat"><b>' + sol.kwc + ' kWc</b><span>' + sol.surface + ' m² de panneaux</span></div>' +
        '<div class="stat"><b>' + sol.production.toLocaleString('fr-FR') + ' kWh</b><span>par an (facteur ' +
          sol.facteur + ')</span></div>' +
        '<div class="stat"><b>' + euros(sol.economie) + '</b><span>par an, estimé</span></div>' +
        '<div class="stat"><b>' + sol.poids + ' kg</b><span>ajoutés sur la charpente</span></div>' +
        '</div>' +
        '<p class="hint">Production indicative : ' + sol.ensoleillement.kwhParKwc + ' kWh/kWc en ' +
        esc(sol.ensoleillement.nom) + ', corrigés de l\'inclinaison (' + R.geometrie.angle +
        '°) et de l\'orientation (' + esc(sol.azimut.nom) + ').</p>';

    var e = R.elec;
    if (!e) { $('elecBilan').innerHTML = ''; return; }
    function circuit(nom, c) {
      if (!c) return '';
      return '<div class="stat"><b>' + c.section + ' mm²</b><span>' + nom + ' — chute ' +
        c.chutePct + ' %' + (c.disjoncteur ? ' · ' + c.disjoncteur + ' A' : '') + '</span></div>';
    }
    $('elecBilan').innerHTML = '<div class="resume-grid" style="margin-top:10px">' +
      circuit('prises', e.circuitPrises) + circuit('éclairage', e.circuitLumiere) +
      circuit('borne ' + (e.borne.kw || '') + (e.borne.kw ? ' kW' : ''), e.circuitBorne) +
      '<div class="stat"><b>' + e.longueurTranchee + ' m</b><span>de tranchée à ' +
        Math.round(e.profondeurTranchee * 100) + ' cm</span></div>' +
      '</div>' +
      '<p class="hint">Sections calculées sur le courant admissible ET la chute de tension ' +
      '(5 % maxi, 3 % pour l\'éclairage). Le raccordement au tableau reste l\'affaire d\'un électricien.</p>';
  }

  function rendreResume() {
    var g = R.geometrie, s = R.structure;
    // R.parametres, et non P : en mode terrain, ce sont les dimensions RETENUES
    // par le calcul qu'il faut afficher, pas celles saisies avant ajustement.
    var pr = R.parametres;
    var html = '<div class="resume-grid">' +
      stat(pr.longueur + ' × ' + pr.largeur + ' m', 'abri (entre poteaux)') +
      stat(Calc.arrondi(pr.longueur * pr.largeur, 1) + ' m²', 'emprise au sol') +
      stat(g.pentePct + ' %', 'pente (' + g.angle + '°)') +
      stat(s.nbPoteaux, 'poteaux') +
      stat(s.nbChevrons, 'chevrons') +
      stat(R.charges.volumeBois + ' m³', 'de bois (' + Math.round(R.charges.masseBois) + ' kg)') +
      stat(euros(R.devis.total), 'budget estimé') +
      (R.solaire && R.solaire.nb
        ? stat(R.solaire.kwc + ' kWc', R.solaire.production.toLocaleString('fr-FR') + ' kWh/an')
        : '') +
      (R.elec && R.elec.borne.kw
        ? stat(R.elec.borne.kw + ' kW', 'borne de recharge')
        : '') +
      '</div>';
    $('resume').innerHTML = html;

    function stat(v, s2) {
      return '<div class="stat"><b>' + esc(v) + '</b><span>' + esc(s2) + '</span></div>';
    }
  }

  function rendreAlertes() {
    var box = $('alertes');
    box.innerHTML = '';
    if (!R.alertes.length && !R.conseils.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    R.alertes.forEach(function (a) {
      box.appendChild(el('div', 'alerte', '<span class="ico">⚠️</span><span>' + esc(a) + '</span>'));
    });
    R.conseils.forEach(function (c) {
      box.appendChild(el('div', 'conseil', '<span class="ico">💡</span><span>' + esc(c) + '</span>'));
    });
  }

  function rendreMateriaux() {
    var cats = {};
    R.materiaux.forEach(function (m) {
      (cats[m.categorie] = cats[m.categorie] || []).push(m);
    });
    var html = '';
    Object.keys(cats).forEach(function (cat) {
      html += '<div class="cat-title">' + esc(cat) + '</div>';
      html += '<table class="tbl"><tbody>';
      cats[cat].forEach(function (m) {
        html += '<tr><td><strong>' + esc(m.designation) + '</strong>' +
          (m.section ? '<div class="note">' + esc(m.section) + (m.longueur ? ' · ' + esc(m.longueur) : '') + '</div>' : '') +
          (m.note ? '<div class="note">' + esc(m.note) + '</div>' : '') +
          '</td><td class="qte">' + esc(m.qte) + '<div class="note">' + esc(m.unite) + '</div></td></tr>';
      });
      html += '</tbody></table>';
    });
    $('materiaux').innerHTML = html;
  }

  function rendrePrix() {
    var box = $('prixForm');
    if (box.dataset.built) return;      // les champs gardent le focus pendant la saisie
    box.dataset.built = '1';
    var libelles = {
      bois_m3: 'Bois (€ / m³)',
      couverture_m2: 'Couverture (€ / m²)',
      pied_poteau: 'Pied de poteau (€)',
      beton_sac: 'Sac de béton 35 kg (€)',
      equerre: 'Équerre / sabot (€)',
      visserie_forfait: 'Visserie (forfait €)'
    };
    Object.keys(libelles).forEach(function (k) {
      var lab = el('label', null, libelles[k]);
      var inp = el('input');
      inp.type = 'number';
      inp.step = '0.5';
      inp.value = (P.prix && P.prix[k] !== undefined) ? P.prix[k] : Calc.PRIX_DEFAUT[k];
      inp.addEventListener('input', function () {
        P.prix[k] = parseFloat(inp.value) || 0;
        sauver(K_PRIX, P.prix);
        recalculer(true);
      });
      lab.appendChild(inp);
      box.appendChild(lab);
    });
  }

  function rendreDevis() {
    var html = '';
    R.devis.lignes.forEach(function (d) {
      html += '<div class="devis-ligne"><span>' + esc(d.poste) + '</span><span>' + euros(d.montant) + '</span></div>';
    });
    html += '<div class="devis-total"><span>Total estimé</span><span>' + euros(R.devis.total) + '</span></div>';
    html += '<p class="hint">Hors outillage, location d\'engin et évacuation des déblais.</p>';
    $('devis').innerHTML = html;
  }

  function rendreDebit() {
    var html = '';
    R.debit.forEach(function (d) {
      html += '<div class="cat-title">' + esc(d.nom) + ' — ' + esc(d.section) + '</div>';
      if (d.surMesure) {
        html += '<div class="alerte"><span class="ico">⚠️</span><span>' + d.nb + ' pièce(s) de ' +
          d.longueur + ' m : au-delà des barres de 6 m, il faut commander sur mesure ou abouter au-dessus d\'un poteau.</span></div>';
        return;
      }
      html += '<p class="hint">' + d.nb + ' pièce(s) de ' + d.longueur + ' m → <strong>' + d.nbBarres +
        ' barre(s) de ' + d.barre + ' m</strong>, chute totale ' + d.chuteTotale + ' m.</p>';
      d.detail.forEach(function (b) {
        var total = d.barre;
        html += '<div class="barre">';
        b.coupes.forEach(function (c) {
          html += '<div class="piece" style="width:' + (c / total * 100) + '%">' + c + ' m</div>';
        });
        if (b.chute > 0.02) {
          html += '<div class="chute" style="width:' + (b.chute / total * 100) + '%">' +
            (b.chute >= 0.3 ? b.chute + ' m' : '') + '</div>';
        }
        html += '</div>';
      });
    });
    $('debit').innerHTML = html;
  }

  function rendrePlans() {
    $('plans').innerHTML = Plans.toutes(R).join('');
  }

  // Les trois projets partagent le même onglet Étapes : seule la source des
  // étapes change selon le projet actif (calculée depuis R pour le carport,
  // fixe pour Gemma et la passerelle Zigbee), chacune avec ses cases cochées
  // gardées sous une clé dédiée.
  function rendreEtapesActif() {
    var etapes, cle, finMsg, enCoursMsg;
    if (projetActif === 'gemma') {
      if (!global_GemmaSteps()) return;
      etapes = window.GemmaSteps.construire();
      cle = '__gemma__';
      finMsg = ' — appareil monté, bravo !';
      enCoursMsg = ' — coche au fur et à mesure du montage.';
    } else if (projetActif === 'flash') {
      if (!global_FlashSteps()) return;
      etapes = window.FlashSteps.construire();
      cle = '__flash__';
      finMsg = ' — passerelle flashée, bravo !';
      enCoursMsg = ' — coche au fur et à mesure du flash.';
    } else {
      etapes = Steps.construire(R);
      cle = P.nom || 'projet';
      finMsg = ' — terminé, bravo !';
      enCoursMsg = ' — coche au fur et à mesure du chantier.';
    }

    var fait = coches[cle] || {};
    var box = $('etapes');
    box.innerHTML = '';

    etapes.forEach(function (e, i) {
      var done = !!fait[e.id];
      var card = el('div', 'etape' + (done ? ' done' : ''));

      var head = el('div', 'etape-head');
      head.innerHTML = '<div class="etape-num">' + (done ? '✓' : (i + 1)) + '</div>' +
        '<div class="etape-titre">' + esc(e.titre) + '<div class="etape-duree">⏱ ' + esc(e.duree) + '</div></div>' +
        '<div style="font-size:18px">' + (done ? '☑' : '☐') + '</div>';
      head.addEventListener('click', function (ev) {
        // Un clic sur la case coche, un clic ailleurs déplie : deux gestes, un
        // seul bandeau, sans bouton minuscule à viser.
        if (ev.target === head.lastElementChild) {
          fait[e.id] = !fait[e.id];
          coches[cle] = fait;
          sauver(K_COCHES, coches);
          rendreEtapesActif();
        } else {
          card.classList.toggle('open');
        }
      });

      var body = el('div', 'etape-body');
      var html = '';
      if (e.outils && e.outils.length) {
        html += '<div class="outils">🧰 ' + e.outils.map(esc).join(' · ') + '</div>';
      }
      html += '<ul>' + e.details.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>';
      if (e.attention) html += '<div class="encart attention">⚠️ ' + esc(e.attention) + '</div>';
      if (e.astuce) html += '<div class="encart astuce">💡 ' + esc(e.astuce) + '</div>';
      body.innerHTML = html;

      card.appendChild(head);
      card.appendChild(body);
      box.appendChild(card);
    });

    var nb = etapes.filter(function (e) { return fait[e.id]; }).length;
    $('progressBar').style.width = (nb / etapes.length * 100) + '%';
    $('progressText').textContent = nb + ' étape(s) sur ' + etapes.length +
      (nb === etapes.length ? finMsg : enCoursMsg);
  }

  function global_GemmaSteps() {
    return window.GemmaSteps && typeof window.GemmaSteps.construire === 'function';
  }

  function global_FlashSteps() {
    return window.FlashSteps && typeof window.FlashSteps.construire === 'function';
  }

  // Bascule les six onglets partagés (Projet/Matériaux/Débit/Plans/Étapes/
  // Infos) sur le contenu du projet actif : chaque onglet garde son rôle,
  // mais le carport, le Traducteur Gemma et la passerelle Zigbee n'y montrent
  // pas la même chose (le carport seul a des cotes, un débit et des plans).
  function appliquerProjetActif() {
    var c = projetActif === 'carport';
    var g = projetActif === 'gemma';

    $('projetCarportBody').style.display = c ? '' : 'none';
    $('projetGemmaBody').style.display = g ? '' : 'none';
    $('projetFlashBody').style.display = (!c && !g) ? '' : 'none';

    $('materiauxCarportBody').style.display = c ? '' : 'none';
    $('materiauxGemmaBody').style.display = g ? '' : 'none';
    $('materiauxFlashBody').style.display = (!c && !g) ? '' : 'none';

    $('debitCarportBody').style.display = c ? '' : 'none';
    $('debitNonApplicable').style.display = c ? 'none' : '';
    $('plansCarportBody').style.display = c ? '' : 'none';
    $('plansNonApplicable').style.display = c ? 'none' : '';
    if (!c) {
      var texteDebit = g
        ? 'Le Traducteur Gemma n\'a pas de débit de coupe : ce n\'est pas un ouvrage en bois, mais un appareil électronique à assembler.'
        : 'La passerelle Zigbee n\'a pas de débit de coupe : il n\'y a pas de bois à débiter, seulement un appareil à flasher.';
      var textePlans = g
        ? 'Le Traducteur Gemma n\'a pas de plans cotés : les fichiers du boîtier (STL) sont fournis directement par le dépôt gemma-translator.'
        : 'La passerelle Zigbee n\'a pas de plans cotés : c\'est un flash logiciel sur du matériel existant, pas une structure à dimensionner.';
      $('debitNonApplicableTexte').textContent = texteDebit;
      $('plansNonApplicableTexte').textContent = textePlans;
    }

    $('etapesTitre').textContent = c ? 'Marche à suivre' : (g ? 'Marche à suivre du montage' : 'Marche à suivre du flash');

    $('infosCarportBody').style.display = c ? '' : 'none';
    $('infosGemmaBody').style.display = g ? '' : 'none';
    $('infosFlashBody').style.display = (!c && !g) ? '' : 'none';

    rendreEtapesActif();
  }

  function choisirProjet(nom) {
    projetActif = nom;
    sauver(K_ACTIF, nom);
    appliquerProjetActif();
  }

  function rendrePied() {
    var pied = Calc.PIEDS_POTEAU[P.piedPoteau];
    $('piedDetail').innerHTML =
      '<p class="hint">' + esc(pied.note) + '</p>' +
      '<div class="pc">' +
      '<div><b style="color:var(--ok)">Pour</b><ul>' +
        pied.pour.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div><b style="color:var(--bad)">Contre</b><ul>' +
        pied.contre.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '</div>';
    $('couvHint').textContent = Calc.COUVERTURES[P.couverture].note +
      ' Pente minimale : ' + Calc.COUVERTURES[P.couverture].penteMini + ' %.';
  }

  function rendreProjets() {
    var liste = charger(K_PROJETS) || [];
    var box = $('projets');
    box.innerHTML = '';

    // Projet permanent : le Traducteur Gemma. Ce n'est pas un carport (il n'a
    // pas de cotes), on l'épingle donc en tête de la liste et son ouverture
    // mène au guide de montage, pas au formulaire dimensions.
    var gem = el('div', 'projet');
    gem.innerHTML = '<div style="flex:1"><div class="p-nom">🌍 Traducteur Gemma</div>' +
      '<div class="p-sub">Traducteur vocal hors ligne · guide de montage</div></div>';
    var gemOpen = el('button', null, '📂');
    gemOpen.title = 'Ouvrir le guide de montage';
    gemOpen.addEventListener('click', function () {
      choisirProjet('gemma');
      montrerOnglet('projet');
    });
    gem.appendChild(gemOpen);
    box.appendChild(gem);

    // Idem pour la passerelle Zigbee : ce n'est pas un carport non plus, on
    // l'épingle juste après le Traducteur Gemma.
    var fla = el('div', 'projet');
    fla.innerHTML = '<div style="flex:1"><div class="p-nom">📡 Passerelle Zigbee</div>' +
      '<div class="p-sub">Flash firmware open source · guide pas à pas</div></div>';
    var flaOpen = el('button', null, '📂');
    flaOpen.title = 'Ouvrir le guide de flash';
    flaOpen.addEventListener('click', function () {
      choisirProjet('flash');
      montrerOnglet('projet');
    });
    fla.appendChild(flaOpen);
    box.appendChild(fla);

    if (!liste.length) {
      box.appendChild(el('p', 'hint',
        'Aucun carport enregistré pour l\'instant. Le carport en cours est gardé automatiquement.'));
      return;
    }
    liste.forEach(function (pr, i) {
      var d = el('div', 'projet');
      d.innerHTML = '<div style="flex:1"><div class="p-nom">' + esc(pr.nom) + '</div>' +
        '<div class="p-sub">' + pr.longueur + ' × ' + pr.largeur + ' m · ' +
        esc((Calc.COUVERTURES[pr.couverture] || {}).nom || '') + '</div></div>';
      var open = el('button', null, '📂');
      open.title = 'Ouvrir';
      open.addEventListener('click', function () {
        P = Object.assign({}, DEFAUT, pr);
        etatVersForm();
        choisirProjet('carport');
        recalculer();
        montrerOnglet('projet');
        toast('Projet « ' + pr.nom + ' » chargé.');
      });
      var del = el('button', null, '🗑');
      del.title = 'Supprimer';
      del.addEventListener('click', function () {
        liste.splice(i, 1);
        sauver(K_PROJETS, liste);
        rendreProjets();
        toast('Projet supprimé.');
      });
      d.appendChild(open);
      d.appendChild(del);
      box.appendChild(d);
    });
  }

  // ------------------------------------------------------------- orchestration
  function recalculer(silencieux) {
    R = Calc.calculer(P);
    rendreTerrain();
    rendreOptions();
    rendreResume();
    rendreAlertes();
    rendreMateriaux();
    rendrePrix();
    rendreDevis();
    rendreDebit();
    rendrePlans();
    rendreEtapesActif();
    rendrePied();
    sauver(K_COURANT, P);
    if (!silencieux && R.alertes.length) {
      // Rien de bloquant : l'onglet Matériaux affiche le détail.
    }
  }

  function montrerOnglet(nom) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === nom);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + nom);
    });
    window.scrollTo(0, 0);
  }

  function texteMateriaux() {
    var pr = R.parametres;
    var l = ['JE CONSTRUIS — ' + (pr.nom || 'Carport'),
      pr.longueur + ' m × ' + pr.largeur + ' m · hauteurs ' + pr.hautAvant + ' / ' + pr.hautArriere + ' m',
      'Pente ' + R.geometrie.pentePct + ' % · toiture ' + R.terrain.empriseToitureL + ' × ' +
        R.terrain.empriseToitureW + ' m (' + R.terrain.empriseToitureM2 + ' m²)',
      ''];
    var cat = '';
    R.materiaux.forEach(function (m) {
      if (m.categorie !== cat) { cat = m.categorie; l.push('— ' + cat.toUpperCase() + ' —'); }
      l.push('• ' + m.qte + ' ' + m.unite + '  ' + m.designation +
        (m.section ? '  (' + m.section + (m.longueur ? ', ' + m.longueur : '') + ')' : ''));
    });
    l.push('', 'Budget estimé : ' + euros(R.devis.total) + ' (indicatif)');
    return l.join('\n');
  }

  // ------------------------------------------------------------------ départ
  function init() {
    remplirSelects();
    etatVersForm();

    // Toute modification recalcule : pas de bouton « valider » à oublier.
    document.querySelectorAll('input, select').forEach(function (input) {
      if (input.closest('#prixForm')) return;
      input.addEventListener('input', function () {
        formVersEtat();
        recalculer();
      });
      input.addEventListener('change', function () {
        formVersEtat();
        recalculer();
      });
    });

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { montrerOnglet(t.dataset.tab); });
    });

    $('btnSave').addEventListener('click', function () {
      var liste = charger(K_PROJETS) || [];
      var copie = JSON.parse(JSON.stringify(P));
      var i = liste.findIndex(function (x) { return x.nom === copie.nom; });
      if (i >= 0) liste[i] = copie; else liste.push(copie);
      sauver(K_PROJETS, liste);
      rendreProjets();
      toast('Projet « ' + copie.nom + ' » enregistré.');
    });

    $('btnNew').addEventListener('click', function () {
      P = Object.assign({}, DEFAUT, { prix: P.prix });
      P.nom = 'Carport ' + new Date().toLocaleDateString('fr-FR');
      etatVersForm();
      choisirProjet('carport');
      recalculer();
      toast('Nouveau projet.');
    });

    $('btnProjets').addEventListener('click', function () {
      montrerOnglet('infos');
      rendreProjets();
    });

    $('homeCarport').addEventListener('click', function () {
      choisirProjet('carport');
      montrerOnglet('projet');
    });

    $('homeGemma').addEventListener('click', function () {
      choisirProjet('gemma');
      montrerOnglet('projet');
    });

    $('homeFlash').addEventListener('click', function () {
      choisirProjet('flash');
      montrerOnglet('projet');
    });

    $('btnCopyMat').addEventListener('click', function () {
      var txt = texteMateriaux();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(function () { toast('Liste copiée.'); },
          function () { toast('Copie impossible.'); });
      } else {
        toast('Copie non disponible ici.');
      }
    });

    $('btnPrint').addEventListener('click', function () { window.print(); });

    $('verChip').textContent = 'v' + (window.APP_VERSION || '');
    $('verText').textContent = window.APP_VERSION || '';

    recalculer();
    appliquerProjetActif();
    rendreProjets();

    if (window.AutoBackup && AutoBackup.mount) {
      try { AutoBackup.mount($('backupPanel')); } catch (e) {}
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
