/*
 * calc.js — moteur de calcul du carport bois.
 *
 * Tout part de six mesures (longueur, largeur, deux hauteurs, entraxes) et
 * produit : sections conseillées, liste de matériaux, débit de coupe optimisé,
 * quincaillerie, béton, quantités de couverture et devis.
 *
 * ⚠️ CE QUE CE FICHIER N'EST PAS : un calcul réglementaire. Les tables de
 * sections viennent de la pratique courante de charpente (portées usuelles,
 * couverture légère, neige de plaine). Elles donnent une base saine pour
 * commander du bois, pas une note de calcul Eurocode 5. Au-delà des portées
 * couvertes ici, l'app le dit franchement plutôt que d'extrapoler.
 *
 * Toutes les longueurs sont en MÈTRES, les sections en MILLIMÈTRES.
 */
(function (global) {
  'use strict';

  // --------------------------------------------------------------------------
  // Barres commerciales disponibles par famille de bois (m). Le débit de coupe
  // ne propose que ces longueurs : c'est ce qu'on trouve en négoce.
  // --------------------------------------------------------------------------
  var LONGUEURS_STOCK = [3, 4, 5, 6];

  // Tables de sections conseillées (mm), par portée maximale (m).
  // `charge` décale d'un cran (neige abondante / couverture lourde).
  var TABLE_PANNES = [
    { portee: 2.0, section: [63, 175] },
    { portee: 2.5, section: [63, 200] },
    { portee: 3.0, section: [75, 225] },
    { portee: 3.5, section: [75, 250] },
    { portee: 4.0, section: [100, 250] }
  ];

  var TABLE_CHEVRONS = [
    { portee: 2.0, section: [50, 75] },
    { portee: 2.5, section: [50, 100] },
    { portee: 3.0, section: [63, 125] },
    { portee: 3.5, section: [63, 150] },
    { portee: 4.0, section: [75, 175] },
    { portee: 4.5, section: [75, 200] },
    { portee: 5.0, section: [75, 225] }
  ];

  // Couvertures : largeur utile d'un élément, pente minimale admissible,
  // masse au m² (pour dire au bois ce qu'il porte) et vis nécessaires.
  var COUVERTURES = {
    bac_acier: {
      nom: 'Bac acier',
      largeurUtile: 1.05,
      penteMini: 7,          // %
      poids: 6,              // kg/m²
      visParM2: 6,
      note: 'Le plus simple et le plus léger. Attention au bruit de la pluie.'
    },
    bac_isole: {
      nom: 'Panneau sandwich isolé',
      largeurUtile: 1.0,
      penteMini: 7,
      poids: 11,
      visParM2: 6,
      note: 'Plus cher, mais nettement plus silencieux et sans condensation.'
    },
    polycarbonate: {
      nom: 'Plaques polycarbonate',
      largeurUtile: 0.98,
      penteMini: 8,
      poids: 3,
      visParM2: 8,
      note: 'Laisse passer la lumière. Prévoir des vis à joint néoprène et des profils de jonction.'
    },
    tuiles: {
      nom: 'Tuiles (sur liteaux)',
      largeurUtile: null,     // se compte au m², pas en plaques
      penteMini: 30,
      poids: 45,
      visParM2: 0,
      note: 'Lourd : la charpente doit être dimensionnée en conséquence, et la pente est forte.'
    },
    shingle: {
      nom: 'Shingle sur OSB',
      largeurUtile: null,
      penteMini: 20,
      poids: 14,
      visParM2: 0,
      note: 'Demande un platelage continu (OSB 18 mm) posé sur les chevrons.'
    }
  };

  var PIEDS_POTEAU = {
    reglable: {
      nom: 'Pied réglable à tige filetée',
      hauteurSol: 0.10,
      chevillesParPied: 4,
      note: 'Deux platines et une tige filetée : on rattrape le niveau après coup, et le bois ne touche jamais le béton. Le plus tolérant quand les plots ne sont pas parfaitement alignés.',
      pour: ['Rattrape les défauts de niveau', 'Bois surélevé, donc pas de remontée d\'humidité', 'Démontable'],
      contre: ['Visible', 'Il faut percer le béton après coulage (chevilles à expansion)']
    },
    sabot_scelle: {
      nom: 'Sabot (U) à sceller dans le béton',
      hauteurSol: 0.08,
      chevillesParPied: 0,
      note: 'Le U est noyé dans le plot pendant la coulée. Très rigide, mais tout se joue au moment du coulage : un sabot mal placé ne se rattrape plus.',
      pour: ['Le plus rigide', 'Rien à percer ensuite', 'Peu visible'],
      contre: ['Aucune tolérance : implantation au cordeau obligatoire', 'Impossible à corriger après séchage']
    },
    sabot_visse: {
      nom: 'Sabot (U) sur platine à visser',
      hauteurSol: 0.06,
      chevillesParPied: 4,
      note: 'Le U est soudé sur une platine que l\'on cheville sur le plot déjà sec. Bon compromis entre rigidité et rattrapage.',
      pour: ['Se pose sur un plot déjà coulé', 'Bien plus rigide qu\'une simple platine', 'Le poteau est maintenu sur 4 faces'],
      contre: ['Le poteau doit être à la bonne section, au mm près', 'Peu de rattrapage latéral']
    },
    scellement_direct: {
      nom: 'Poteau scellé directement',
      hauteurSol: 0,
      chevillesParPied: 0,
      note: 'Le poteau descend dans le béton. À éviter : le bois enfermé dans le béton pourrit par le pied, même traité classe 4, et la réparation impose de tout démonter.',
      pour: ['Aucune quincaillerie', 'Très rigide au départ'],
      contre: ['Pourrissement du pied à moyen terme', 'Irréparable sans tout déposer', 'Déconseillé']
    }
  };

  var ESSENCES = {
    douglas: { nom: 'Douglas', densite: 540, classe: 'Classe 3 naturelle (purgé d\'aubier)', prixMultiplicateur: 1.15 },
    epicea_traite: { nom: 'Épicéa traité', densite: 470, classe: 'Classe 2 à 4 selon traitement', prixMultiplicateur: 1 },
    pin_autoclave: { nom: 'Pin autoclave', densite: 520, classe: 'Classe 4 (contact sol possible)', prixMultiplicateur: 1.1 },
    chene: { nom: 'Chêne', densite: 750, classe: 'Classe 4 naturelle', prixMultiplicateur: 2.2 },
    lamelle_colle: { nom: 'Lamellé-collé', densite: 500, classe: 'Classe 2 (abrité)', prixMultiplicateur: 1.6 }
  };

  // Prix indicatifs par défaut (€). Éditables dans l'app : ce sont des ordres
  // de grandeur 2026, pas des tarifs négociés.
  var PRIX_DEFAUT = {
    bois_m3: 650,             // € / m³ de bois de structure
    couverture_m2: 22,        // € / m² de couverture
    pied_poteau: 28,          // € / pièce
    beton_sac: 6.5,           // € / sac de 35 kg
    visserie_forfait: 90,     // € pour l'ensemble
    equerre: 3.5              // € / pièce
  };

  // --------------------------------------------------------------------------
  // Utilitaires
  // --------------------------------------------------------------------------
  function arrondi(x, n) {
    var p = Math.pow(10, n || 0);
    return Math.round(x * p) / p;
  }

  function sectionTexte(s) { return s[0] + ' × ' + s[1] + ' mm'; }

  // Choisit une section dans une table, avec `crans` de sécurité en plus.
  // Renvoie null si la portée sort de la table : mieux vaut le dire que
  // d'inventer une section.
  function choisirSection(table, portee, crans) {
    var i = 0;
    while (i < table.length && table[i].portee < portee - 0.001) i++;
    i += (crans || 0);
    if (i >= table.length) return null;
    return table[i].section;
  }

  // Barre commerciale la plus courte qui contient `longueur`.
  function barrePour(longueur) {
    for (var i = 0; i < LONGUEURS_STOCK.length; i++) {
      if (LONGUEURS_STOCK[i] >= longueur - 0.001) return LONGUEURS_STOCK[i];
    }
    return null;   // au-delà de 6 m : commande spéciale
  }

  // --------------------------------------------------------------------------
  // DÉBIT DE COUPE.
  //
  // Rangement de pièces dans des barres du commerce, première-décroissante
  // (first-fit decreasing) : on place la pièce la plus longue dans la première
  // barre où elle rentre, sinon on ouvre une barre. Ce n'est pas l'optimum
  // théorique, mais sur des débits de charpente (peu de pièces, longueurs
  // proches) il tombe presque toujours dessus, et il est lisible.
  //
  // `trait` = épaisseur du trait de scie perdu à chaque coupe (3 mm).
  // --------------------------------------------------------------------------
  function debiter(pieces, longueurBarre, trait) {
    trait = trait === undefined ? 0.003 : trait;
    var restantes = pieces.slice().sort(function (a, b) { return b - a; });
    var barres = [];
    restantes.forEach(function (p) {
      var pose = false;
      for (var i = 0; i < barres.length; i++) {
        var besoin = p + (barres[i].pieces.length ? trait : 0);
        if (barres[i].reste >= besoin - 0.0001) {
          barres[i].pieces.push(p);
          barres[i].reste -= besoin;
          pose = true;
          break;
        }
      }
      if (!pose) {
        barres.push({ pieces: [p], reste: longueurBarre - p });
      }
    });
    return barres;
  }

  // --------------------------------------------------------------------------
  // CALCUL PRINCIPAL
  // --------------------------------------------------------------------------
  function calculer(p) {
    var out = { alertes: [], conseils: [] };

    var longueur = +p.longueur, largeur = +p.largeur;
    var hHaut = +p.hautAvant, hBas = +p.hautArriere;
    var couv = COUVERTURES[p.couverture] || COUVERTURES.bac_acier;
    var pied = PIEDS_POTEAU[p.piedPoteau] || PIEDS_POTEAU.reglable;
    var essence = ESSENCES[p.essence] || ESSENCES.douglas;
    var crans = +p.chargeSup || 0;   // 0 = plaine, 1 = neige marquée, 2 = montagne

    // --- Géométrie de la pente ---------------------------------------------
    var deltaH = hHaut - hBas;
    var pentePct = largeur > 0 ? (deltaH / largeur) * 100 : 0;
    var angle = Math.atan2(deltaH, largeur) * 180 / Math.PI;
    var rampant = Math.sqrt(largeur * largeur + deltaH * deltaH);

    out.geometrie = {
      pentePct: arrondi(pentePct, 1),
      angle: arrondi(angle, 1),
      rampant: arrondi(rampant, 2),
      deltaH: arrondi(deltaH, 2)
    };

    if (deltaH <= 0) {
      out.alertes.push('Toit plat ou pente inversée : l\'eau ne s\'évacue pas. La hauteur avant doit être supérieure à la hauteur arrière.');
    } else if (pentePct < couv.penteMini) {
      out.alertes.push('Pente de ' + arrondi(pentePct, 1) + ' % : trop faible pour « ' + couv.nom +
        ' », qui demande au minimum ' + couv.penteMini + ' %. Sur cette largeur de ' + largeur +
        ' m, il faut au moins ' + arrondi(largeur * couv.penteMini / 100, 2) +
        ' m de différence entre les deux hauteurs (tu en as ' + arrondi(deltaH, 2) + ' m).');
    }

    // --- Poteaux -----------------------------------------------------------
    var nbParRangee = +p.poteauxParRangee;
    if (!nbParRangee || nbParRangee < 2) nbParRangee = Math.max(2, Math.ceil(longueur / 3) + 1);
    var entraxePoteaux = longueur / (nbParRangee - 1);
    var nbPoteaux = nbParRangee * 2;

    if (entraxePoteaux > 3.5) {
      out.alertes.push('Entraxe des poteaux de ' + arrondi(entraxePoteaux, 2) +
        ' m : c\'est beaucoup. Ajoute un poteau par rangée pour retomber sous 3 m.');
    }

    var sectionPoteau = (p.sectionPoteau || '150x150').split('x').map(Number);
    // LONGUEUR RÉELLE DU POTEAU.
    //
    // Les hauteurs saisies sont des hauteurs SOUS PANNE, mesurées depuis le sol
    // fini. Un pied métallique décolle le bois du plot : le poteau est donc plus
    // court d'autant. À l'inverse, un poteau scellé descend dans le béton et
    // doit être rallongé de la profondeur d'ancrage.
    var longPoteauHaut, longPoteauBas;
    if (p.piedPoteau === 'scellement_direct') {
      longPoteauHaut = hHaut + 0.5;
      longPoteauBas = hBas + 0.5;
    } else {
      longPoteauHaut = hHaut - pied.hauteurSol;
      longPoteauBas = hBas - pied.hauteurSol;
    }

    // --- Pannes porteuses (sens de la longueur) -----------------------------
    var sectionPanne = choisirSection(TABLE_PANNES, entraxePoteaux, crans);
    if (!sectionPanne) {
      out.alertes.push('Portée entre poteaux de ' + arrondi(entraxePoteaux, 2) +
        ' m : hors des portées courantes. Ajoute un poteau, ou fais dimensionner la poutre par un charpentier.');
      sectionPanne = TABLE_PANNES[TABLE_PANNES.length - 1].section;
    }
    var longPanne = longueur + 2 * (+p.debordCote || 0);

    // --- Chevrons (sens de la largeur, portée = largeur) --------------------
    var entraxeChevrons = +p.entraxeChevrons || 0.6;
    var cransChevron = crans + (entraxeChevrons > 0.7 ? 1 : 0);
    var sectionChevron = choisirSection(TABLE_CHEVRONS, largeur, cransChevron);
    if (!sectionChevron) {
      out.alertes.push('Portée des chevrons de ' + largeur +
        ' m : trop grande pour une section courante. Ajoute une panne intermédiaire (donc une rangée de poteaux au milieu).');
      sectionChevron = TABLE_CHEVRONS[TABLE_CHEVRONS.length - 1].section;
    }
    var nbChevrons = Math.floor(longPanne / entraxeChevrons) + 1;
    var longChevron = rampant + (+p.debordHaut || 0) + (+p.debordBas || 0);

    // --- Jambes de force (contreventement) ---------------------------------
    var nbJambes = p.jambesDeForce === false ? 0 : nbPoteaux;
    var longJambe = 0.9;                      // 60 cm de côté, coupée à 45°
    var sectionJambe = [Math.max(63, sectionPoteau[0] / 2), 150];

    // --- Couverture ---------------------------------------------------------
    var largeurCouverte = longPanne;                       // sens de la longueur
    var surfaceCouverture = largeurCouverte * longChevron; // sur le rampant
    var couvDetail = { type: couv.nom, surface: arrondi(surfaceCouverture, 1) };
    if (couv.largeurUtile) {
      couvDetail.plaques = Math.ceil(largeurCouverte / couv.largeurUtile);
      couvDetail.longueurPlaque = arrondi(longChevron, 2);
      couvDetail.vis = Math.ceil(surfaceCouverture * couv.visParM2);
      if (longChevron > 6) {
        out.conseils.push('Les plaques dépassent 6 m : prévois un recouvrement de 20 cm (donc deux longueurs) plutôt qu\'une commande sur mesure.');
      }
    } else if (p.couverture === 'tuiles') {
      couvDetail.tuiles = Math.ceil(surfaceCouverture * 10);
      couvDetail.liteaux = Math.ceil(surfaceCouverture / 0.33);   // ml de liteau
      out.conseils.push('Tuiles : ajoute un écran sous-toiture et un contre-lattage, et vérifie la pente minimale du modèle choisi.');
    } else if (p.couverture === 'shingle') {
      couvDetail.osb = Math.ceil(surfaceCouverture / (2.5 * 1.25));
      couvDetail.rouleaux = Math.ceil(surfaceCouverture / 3);
    }
    var poidsCouverture = surfaceCouverture * couv.poids;

    // --- Fondations ---------------------------------------------------------
    var plotCote = +p.plotCote || 0.5, plotProf = +p.plotProfondeur || 0.5;
    var volumePlot = plotCote * plotCote * plotProf;
    var volumeBeton = volumePlot * nbPoteaux;
    var sacsBeton = Math.ceil(volumeBeton / 0.0175);   // ~17,5 L de béton par sac de 35 kg

    // --- Volume et masse de bois -------------------------------------------
    function vol(section, longueur, nb) {
      return (section[0] / 1000) * (section[1] / 1000) * longueur * nb;
    }
    var volumeBois =
      vol(sectionPoteau, longPoteauHaut, nbParRangee) +
      vol(sectionPoteau, longPoteauBas, nbParRangee) +
      vol(sectionPanne, longPanne, 2) +
      vol(sectionChevron, longChevron, nbChevrons) +
      vol(sectionJambe, longJambe, nbJambes);
    var masseBois = volumeBois * essence.densite;

    // --- Liste des matériaux ------------------------------------------------
    var materiaux = [];

    function ligne(cat, designation, section, longueur, qte, unite, note) {
      materiaux.push({
        categorie: cat, designation: designation,
        section: section ? sectionTexte(section) : '',
        longueur: longueur ? arrondi(longueur, 2) + ' m' : '',
        qte: qte, unite: unite || 'u', note: note || ''
      });
    }

    ligne('Bois', 'Poteaux rangée haute', sectionPoteau, longPoteauHaut, nbParRangee, 'u',
      'Hauteur sous panne : ' + arrondi(hHaut, 2) + ' m');
    ligne('Bois', 'Poteaux rangée basse', sectionPoteau, longPoteauBas, nbParRangee, 'u',
      'Hauteur sous panne : ' + arrondi(hBas, 2) + ' m');
    ligne('Bois', 'Pannes porteuses (sens longueur)', sectionPanne, longPanne, 2, 'u',
      'Portée entre poteaux : ' + arrondi(entraxePoteaux, 2) + ' m');
    ligne('Bois', 'Chevrons (sens largeur)', sectionChevron, longChevron, nbChevrons, 'u',
      'Entraxe ' + arrondi(entraxeChevrons * 100, 0) + ' cm');
    if (nbJambes) {
      ligne('Bois', 'Jambes de force (contreventement)', sectionJambe, longJambe, nbJambes, 'u',
        'Coupées à 45°, une par poteau');
    }

    ligne('Quincaillerie', pied.nom, null, 0, nbPoteaux, 'u', pied.note);
    if (pied.chevillesParPied) {
      ligne('Quincaillerie', 'Chevilles à béton M10 (ou goujons)', null, 0,
        nbPoteaux * pied.chevillesParPied, 'u', 'Pour fixer les platines sur les plots secs');
    }
    ligne('Quincaillerie', 'Équerres de fixation panne / poteau', null, 0, nbPoteaux * 2, 'u',
      'Deux par tête de poteau, de part et d\'autre');
    ligne('Quincaillerie', 'Sabots ou équerres de chevron', null, 0, nbChevrons * 2, 'u',
      'Un à chaque appui du chevron sur une panne');
    ligne('Quincaillerie', 'Tirefonds 8 × 120 mm', null, 0, nbPoteaux * 4 + nbJambes * 4, 'u',
      'Assemblages poteaux / pannes / jambes de force');

    ligne('Couverture', couv.nom, null, 0,
      couvDetail.plaques || couvDetail.tuiles || couvDetail.osb || arrondi(surfaceCouverture, 1),
      couvDetail.plaques ? 'plaques' : (couvDetail.tuiles ? 'tuiles' : (couvDetail.osb ? 'panneaux' : 'm²')),
      couv.note);
    if (couvDetail.vis) {
      ligne('Couverture', 'Vis de couverture (à joint néoprène)', null, 0, couvDetail.vis, 'u',
        'Environ ' + couv.visParM2 + ' par m²');
    }
    if (couvDetail.liteaux) {
      ligne('Couverture', 'Liteaux 27 × 40 mm', null, 0, couvDetail.liteaux, 'ml', '');
    }

    ligne('Fondations', 'Béton pour plots ' + (plotCote * 100) + ' × ' + (plotCote * 100) +
      ' × ' + (plotProf * 100) + ' cm', null, 0, sacsBeton, 'sacs 35 kg',
      arrondi(volumeBeton, 2) + ' m³ au total, soit ' + arrondi(volumePlot, 3) + ' m³ par plot');
    ligne('Fondations', 'Gravier de fond de fouille', null, 0, Math.ceil(nbPoteaux * 0.03 * 10) / 10, 'm³',
      '5 cm de gravier compacté sous chaque plot');

    // --- Débit de coupe -----------------------------------------------------
    var debit = [];
    function ajouterDebit(nom, section, longueurPiece, nb) {
      var barre = barrePour(longueurPiece);
      if (!barre) {
        debit.push({ nom: nom, section: sectionTexte(section), surMesure: true,
          longueur: arrondi(longueurPiece, 2), nb: nb });
        var msg = nom + ' : ' + arrondi(longueurPiece, 2) +
          ' m dépasse les barres courantes (6 m max) — commande sur mesure, ou aboutage au-dessus d\'un poteau.';
        // Cas le plus fréquent : ce sont les débords qui font sortir la pièce du
        // stock. On dit alors quoi rogner, plutôt que de laisser chercher.
        if (nom.indexOf('Pannes') === 0 && longueur <= 6) {
          var margeCm = Math.floor((6 - longueur) / 2 * 100);
          msg += ' Ici, un débord en bout de ' + margeCm +
            ' cm au maximum (au lieu de ' + Math.round((+p.debordCote || 0) * 100) +
            ' cm) permettrait de rester sur des barres de 6 m.';
        }
        out.conseils.push(msg);
        return;
      }
      var pieces = [];
      for (var i = 0; i < nb; i++) pieces.push(longueurPiece);
      var barres = debiter(pieces, barre);
      var chute = barres.reduce(function (s, b) { return s + b.reste; }, 0);
      debit.push({
        nom: nom, section: sectionTexte(section), barre: barre,
        nbBarres: barres.length, detail: barres.map(function (b) {
          return { coupes: b.pieces.map(function (x) { return arrondi(x, 2); }), chute: arrondi(b.reste, 2) };
        }),
        chuteTotale: arrondi(chute, 2), nb: nb, longueur: arrondi(longueurPiece, 2)
      });
    }

    ajouterDebit('Poteaux rangée haute', sectionPoteau, longPoteauHaut, nbParRangee);
    ajouterDebit('Poteaux rangée basse', sectionPoteau, longPoteauBas, nbParRangee);
    ajouterDebit('Pannes porteuses', sectionPanne, longPanne, 2);
    ajouterDebit('Chevrons', sectionChevron, longChevron, nbChevrons);
    if (nbJambes) ajouterDebit('Jambes de force', sectionJambe, longJambe, nbJambes);

    // --- Devis --------------------------------------------------------------
    var prix = Object.assign({}, PRIX_DEFAUT, p.prix || {});
    var coutBois = volumeBois * prix.bois_m3 * essence.prixMultiplicateur;
    var coutCouverture = surfaceCouverture * prix.couverture_m2;
    var coutPieds = nbPoteaux * prix.pied_poteau;
    var coutBeton = sacsBeton * prix.beton_sac;
    var coutEquerres = (nbPoteaux * 2 + nbChevrons * 2) * prix.equerre;
    var coutVisserie = prix.visserie_forfait;
    var devis = [
      { poste: 'Bois de structure (' + arrondi(volumeBois, 2) + ' m³ de ' + essence.nom + ')', montant: coutBois },
      { poste: 'Couverture (' + arrondi(surfaceCouverture, 1) + ' m²)', montant: coutCouverture },
      { poste: 'Pieds de poteau (' + nbPoteaux + ')', montant: coutPieds },
      { poste: 'Béton des plots (' + sacsBeton + ' sacs)', montant: coutBeton },
      { poste: 'Équerres et sabots', montant: coutEquerres },
      { poste: 'Visserie et petit matériel', montant: coutVisserie }
    ];
    var total = devis.reduce(function (s, d) { return s + d.montant; }, 0);

    // --- Conseils contextuels ----------------------------------------------
    if (p.piedPoteau === 'scellement_direct') {
      out.alertes.push('Poteau scellé directement dans le béton : le pied finit par pourrir, même en classe 4. Un pied métallique qui décolle le bois de quelques centimètres coûte peu et change la durée de vie de l\'abri.');
    }
    if (surfaceCouverture > 20) {
      out.alertes.push('Emprise au sol supérieure à 20 m² : un permis de construire est en principe nécessaire (déclaration préalable en dessous). À vérifier auprès de ta mairie, et selon le PLU / la zone.');
    } else {
      out.conseils.push('Emprise inférieure à 20 m² : une déclaration préalable de travaux suffit en général. À confirmer en mairie (les règles changent en secteur protégé).');
    }
    if (largeur >= 4.5) {
      out.conseils.push('Au-delà de 4,5 m de largeur, une rangée de poteaux au milieu revient souvent moins cher que des chevrons de très forte section.');
    }
    out.conseils.push('Commande le bois 5 à 10 % plus long que le calcul quand c\'est possible : on recoupe toujours, on ne rallonge jamais.');

    // --- Résultat -----------------------------------------------------------
    out.parametres = p;
    out.structure = {
      nbPoteaux: nbPoteaux, nbParRangee: nbParRangee,
      entraxePoteaux: arrondi(entraxePoteaux, 2),
      sectionPoteau: sectionPoteau, sectionPanne: sectionPanne, sectionChevron: sectionChevron,
      sectionJambe: sectionJambe,
      nbChevrons: nbChevrons, entraxeChevrons: entraxeChevrons,
      longPanne: arrondi(longPanne, 2), longChevron: arrondi(longChevron, 2),
      longPoteauHaut: arrondi(longPoteauHaut, 2), longPoteauBas: arrondi(longPoteauBas, 2),
      nbJambes: nbJambes, longJambe: longJambe
    };
    out.couverture = couvDetail;
    out.charges = {
      poidsCouverture: Math.round(poidsCouverture),
      masseBois: Math.round(masseBois),
      volumeBois: arrondi(volumeBois, 3)
    };
    out.fondations = {
      volumeBeton: arrondi(volumeBeton, 2), sacs: sacsBeton,
      plotCote: plotCote, plotProfondeur: plotProf
    };
    out.materiaux = materiaux;
    out.debit = debit;
    out.devis = { lignes: devis, total: Math.round(total) };
    out.essence = essence;
    out.pied = pied;
    out.couvertureInfo = couv;
    return out;
  }

  global.Calc = {
    calculer: calculer,
    COUVERTURES: COUVERTURES,
    PIEDS_POTEAU: PIEDS_POTEAU,
    ESSENCES: ESSENCES,
    PRIX_DEFAUT: PRIX_DEFAUT,
    LONGUEURS_STOCK: LONGUEURS_STOCK,
    debiter: debiter,
    arrondi: arrondi,
    sectionTexte: sectionTexte
  };
})(window);
