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
    equerre: 3.5,             // € / pièce
    solaire_wc: 0.85,         // € / Wc posé soi-même (matériel seul)
    cable_ml: 4.5,            // € / ml de câble R2V
    borne_ve: 750             // € / borne de recharge
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
  // OPTION SOLAIRE.
  //
  // Un carport est un très bon support photovoltaïque : la surface est propre,
  // dégagée, et la structure existe déjà. Deux réserves honnêtes, que l'app
  // rappelle plutôt que de les taire :
  //   - une pente de carport est FAIBLE (5 à 10 %), donc le rendement est un
  //     peu en dessous d'une toiture inclinée, et surtout la pluie ne lave plus
  //     les panneaux : il faut les nettoyer ;
  //   - les panneaux et leurs rails ajoutent une charge permanente, qui se
  //     cumule à la neige. Le calcul monte donc d'un cran les sections de bois.
  // --------------------------------------------------------------------------
  var PANNEAUX = {
    p430: { nom: 'Panneau 430 Wc (1,72 × 1,13 m)', L: 1.722, l: 1.134, wc: 430, poids: 21 },
    p500: { nom: 'Panneau 500 Wc (1,95 × 1,13 m)', L: 1.95, l: 1.134, wc: 500, poids: 24 },
    p590: { nom: 'Panneau 590 Wc (2,28 × 1,13 m)', L: 2.278, l: 1.134, wc: 590, poids: 28 }
  };

  // Productible indicatif, en kWh par kWc et par an, pour une pose optimale.
  var ENSOLEILLEMENT = {
    nord: { nom: 'Nord / Nord-Est', kwhParKwc: 950 },
    centre: { nom: 'Centre / Ouest', kwhParKwc: 1100 },
    sudouest: { nom: 'Sud-Ouest', kwhParKwc: 1250 },
    mediterranee: { nom: 'Méditerranée', kwhParKwc: 1400 }
  };

  var AZIMUTS = {
    sud: { nom: 'Sud', facteur: 1 },
    sudest: { nom: 'Sud-Est', facteur: 0.96 },
    sudouest: { nom: 'Sud-Ouest', facteur: 0.96 },
    est: { nom: 'Est', facteur: 0.85 },
    ouest: { nom: 'Ouest', facteur: 0.85 },
    nord: { nom: 'Nord', facteur: 0.62 }
  };

  // Rendement selon l'inclinaison réelle du toit (référence : 30°).
  function facteurInclinaison(angle) {
    var table = [[0, 0.87], [10, 0.93], [20, 0.98], [30, 1.0], [45, 0.96], [60, 0.86]];
    if (angle <= table[0][0]) return table[0][1];
    for (var i = 1; i < table.length; i++) {
      if (angle <= table[i][0]) {
        var a = table[i - 1], b = table[i];
        return a[1] + (b[1] - a[1]) * (angle - a[0]) / (b[0] - a[0]);
      }
    }
    return 0.8;
  }

  function calculerSolaire(p, geo, longPanne, longChevron, out) {
    if (!p.solaire) return null;
    var pan = PANNEAUX[p.panneau] || PANNEAUX.p430;
    var ens = ENSOLEILLEMENT[p.ensoleillement] || ENSOLEILLEMENT.centre;
    var az = AZIMUTS[p.azimut] || AZIMUTS.sud;

    // Champ posable : la toiture, moins 30 cm de marge sur tout le pourtour
    // (rives, circulation pour la pose et l'entretien).
    var marge = 0.3;
    var champL = Math.max(0, longPanne - 2 * marge);        // sens de la longueur
    var champW = Math.max(0, longChevron - 2 * marge);      // sens du rampant

    // Deux orientations de pose possibles : on garde celle qui loge le plus de
    // panneaux, avec 2 cm de jeu entre panneaux.
    function combien(largeurPanneau, hauteurPanneau) {
      var jeu = 0.02;
      var nx = Math.floor((champL + jeu) / (largeurPanneau + jeu));
      var ny = Math.floor((champW + jeu) / (hauteurPanneau + jeu));
      return { nx: Math.max(0, nx), ny: Math.max(0, ny), total: Math.max(0, nx) * Math.max(0, ny) };
    }
    var portrait = combien(pan.l, pan.L);
    var paysage = combien(pan.L, pan.l);
    var pose = portrait.total >= paysage.total ? portrait : paysage;
    var sens = portrait.total >= paysage.total ? 'portrait' : 'paysage';

    var nb = pose.total;
    if (p.maxPanneaux && +p.maxPanneaux > 0) nb = Math.min(nb, Math.floor(+p.maxPanneaux));

    var kwc = nb * pan.wc / 1000;
    var facteur = facteurInclinaison(geo.angle) * az.facteur;
    var production = Math.round(kwc * ens.kwhParKwc * facteur);
    var surface = nb * pan.L * pan.l;
    var poids = nb * pan.poids + surface * 3;    // + rails d'aluminium

    // Onduleur : micro-onduleurs (un par panneau) ou onduleur central.
    var micro = p.onduleur !== 'central';

    var autoconso = Math.min(1, Math.max(0, (+p.tauxAutoconso || 60) / 100));
    var prixKwh = +p.prixKwh || 0.25;
    var prixRevente = +p.prixRevente || 0.076;
    var economie = Math.round(production * autoconso * prixKwh +
      production * (1 - autoconso) * prixRevente);

    if (nb === 0) {
      out.alertes.push('Aucun panneau ne tient sur cette toiture : il faut au moins ' +
        arrondi(pan.l + 0.6, 2) + ' m dans un sens et ' + arrondi(pan.L + 0.6, 2) + ' m dans l\'autre.');
    }
    if (geo.angle < 10 && nb > 0) {
      out.alertes.push('Inclinaison de ' + geo.angle + '° : la pluie ne lave plus les panneaux et les ' +
        'salissures s\'accumulent en bas de champ. Prévois un nettoyage annuel, ou relève les panneaux ' +
        'sur des triangles support (10 à 15° suffisent à retrouver l\'auto-nettoyage).');
    }
    if (nb > 0) {
      out.conseils.push('Solaire : déclaration préalable de travaux, convention d\'autoconsommation ' +
        'auprès d\'Enedis et attestation CONSUEL sont nécessaires avant la mise en service. ' +
        'Compte 2 à 3 mois de démarches.');
      out.conseils.push('Charge ajoutée par le solaire : environ ' + Math.round(poids) +
        ' kg au total, soit ' + arrondi(poids / (longPanne * longChevron), 1) +
        ' kg/m². Les sections de bois ont été montées d\'un cran en conséquence.');
    }

    return {
      panneau: pan, nb: nb, sens: sens, rangees: pose.ny, parRangee: pose.nx,
      kwc: arrondi(kwc, 2), surface: arrondi(surface, 1), poids: Math.round(poids),
      production: production, ensoleillement: ens, azimut: az,
      facteur: arrondi(facteur, 2), economie: economie,
      micro: micro,
      rails: Math.ceil(surface / 2 * 1.2),        // ml de rail alu
      pinces: nb * 4,
      cableSolaire: Math.ceil(nb * 3 + longPanne * 2)
    };
  }

  // --------------------------------------------------------------------------
  // OPTION ÉLECTRICITÉ : prises, éclairage et borne de recharge.
  //
  // Le calcul qui compte ici, c'est la SECTION DU CÂBLE d'alimentation : un
  // carport est loin du tableau, et c'est la longueur qui décide, pas
  // l'intensité seule. On retient la première section normalisée qui tient à la
  // fois le courant et la chute de tension (5 % maxi, 3 % si c'est de
  // l'éclairage seul, comme le demande la NF C 15-100).
  // --------------------------------------------------------------------------
  var SECTIONS_CABLE = [
    { s: 1.5, iz: 16 }, { s: 2.5, iz: 21 }, { s: 4, iz: 27 }, { s: 6, iz: 35 },
    { s: 10, iz: 48 }, { s: 16, iz: 64 }, { s: 25, iz: 84 }, { s: 35, iz: 104 }
  ];
  var RHO_CUIVRE = 0.023;      // Ω·mm²/m

  // `sectionMini` : plancher imposé par l'usage, indépendamment du calcul. La
  // chute de tension autoriserait souvent plus fin, mais la NF C 15-100 fixe des
  // minimums par type de circuit — et sur une ligne ENTERRÉE vers un bâtiment
  // annexe, on ne descend pas en dessous de 2,5 mm² pour des prises.
  function sectionCable(courant, longueur, triphase, chuteMaxPct, sectionMini) {
    var u = triphase ? 400 : 230;
    var chuteMax = (chuteMaxPct || 5) / 100 * u;
    var mini = sectionMini || 0;
    for (var i = 0; i < SECTIONS_CABLE.length; i++) {
      var c = SECTIONS_CABLE[i];
      if (c.s < mini) continue;
      if (c.iz < courant) continue;
      var chute = triphase
        ? Math.sqrt(3) * RHO_CUIVRE * longueur * courant / c.s
        : 2 * RHO_CUIVRE * longueur * courant / c.s;
      if (chute <= chuteMax) {
        return { section: c.s, chute: arrondi(chute, 1), chutePct: arrondi(chute / u * 100, 2), iz: c.iz };
      }
    }
    return null;
  }

  var BORNES_VE = {
    aucune: { nom: 'Aucune', kw: 0, courant: 0, triphase: false },
    b3_7: { nom: 'Borne 3,7 kW (16 A mono)', kw: 3.7, courant: 16, triphase: false },
    b7_4: { nom: 'Borne 7,4 kW (32 A mono)', kw: 7.4, courant: 32, triphase: false },
    b11: { nom: 'Borne 11 kW (16 A triphasé)', kw: 11, courant: 16, triphase: true },
    b22: { nom: 'Borne 22 kW (32 A triphasé)', kw: 22, courant: 32, triphase: true }
  };

  function calculerElec(p, out) {
    if (!p.elec) return null;
    var longueur = +p.distanceTableau || 20;
    var nbPrises = +p.nbPrises || 0;
    var nbLampes = +p.nbLampes || 0;
    var borne = BORNES_VE[p.borneVE] || BORNES_VE.aucune;

    // Circuit prises + éclairage : 16 A suffit très largement pour un abri.
    // Minimums d'usage : 2,5 mm² pour des prises (1,5 mm² n'est admis que
    // jusqu'à 5 prises, et jamais sur une ligne enterrée d'annexe), 1,5 mm²
    // pour l'éclairage, 2,5 mm² pour une borne, qui exige en plus un circuit
    // dédié.
    var circuitPrises = nbPrises > 0 ? sectionCable(16, longueur, false, 5, 2.5) : null;
    var circuitLumiere = nbLampes > 0 ? sectionCable(10, longueur, false, 3, 1.5) : null;
    var circuitBorne = borne.kw > 0
      ? sectionCable(borne.courant * 1.25, longueur, borne.triphase, 5, 2.5) : null;

    // Calibre du disjoncteur : celui du circuit, borné par le courant admissible
    // de la section retenue — protéger un câble au-dessus de son Iz n'a pas de sens.
    function calibre(circuit, souhaite) {
      if (!circuit) return null;
      var calibres = [10, 16, 20, 25, 32, 40, 50, 63];
      for (var i = calibres.length - 1; i >= 0; i--) {
        if (calibres[i] <= circuit.iz && calibres[i] >= souhaite) return calibres[i];
      }
      return Math.min(souhaite, circuit.iz);
    }
    if (circuitPrises) circuitPrises.disjoncteur = calibre(circuitPrises, 16);
    if (circuitLumiere) circuitLumiere.disjoncteur = calibre(circuitLumiere, 10);
    if (circuitBorne) circuitBorne.disjoncteur = calibre(circuitBorne, borne.courant);

    if (borne.kw > 0 && !circuitBorne) {
      out.alertes.push('Borne ' + borne.nom + ' à ' + longueur +
        ' m du tableau : aucune section courante ne tient la chute de tension. ' +
        'Rapproche le point d\'alimentation, ou fais étudier la ligne par un électricien.');
    }
    if (borne.kw >= 7.4) {
      out.conseils.push('Une borne de ' + borne.kw + ' kW impose de vérifier la puissance souscrite ' +
        'de ton abonnement (et souvent de passer en 12 kVA ou en triphasé).');
    }

    // Tranchée : 85 cm sous un passage de véhicule, 60 cm ailleurs.
    var profondeur = p.passageVehicule ? 0.85 : 0.6;

    out.conseils.push('Électricité : ces sections sont calculées (courant admissible + chute de ' +
      'tension), mais le raccordement au tableau et la mise à la terre doivent être faits ou ' +
      'vérifiés par un électricien — c\'est aussi ce que demandera l\'assurance en cas de sinistre.');

    return {
      distance: longueur, nbPrises: nbPrises, nbLampes: nbLampes, borne: borne,
      circuitPrises: circuitPrises, circuitLumiere: circuitLumiere, circuitBorne: circuitBorne,
      profondeurTranchee: profondeur,
      longueurTranchee: Math.ceil(longueur),
      gaine: Math.ceil(longueur * 1.1),
      grillage: Math.ceil(longueur),
      cableTotal: Math.ceil(longueur * 1.15)
    };
  }

  // --------------------------------------------------------------------------
  // CALCUL PRINCIPAL
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // ADAPTATION AU TERRAIN RÉEL.
  //
  // On ne construit pas dans le vide : ce qui compte, c'est la place
  // disponible. Et la place prise par l'abri, ce n'est PAS le rectangle des
  // poteaux — c'est le rectangle de la TOITURE, débords compris. C'est lui qui
  // doit tenir dans le terrain, et c'est lui que l'urbanisme regarde pour la
  // distance aux limites.
  //
  //   place utile = terrain − 2 × recul (de chaque côté)
  //   entraxe des poteaux = place utile − débords correspondants
  //
  // Renvoie les dimensions à retenir, arrondies au 5 cm inférieur (on ne
  // commande pas du bois au millimètre) et jamais négatives.
  // --------------------------------------------------------------------------
  function adapterAuTerrain(p) {
    var recul = +p.recul || 0;
    var dispoL = (+p.terrainLongueur || 0) - 2 * recul;
    var dispoW = (+p.terrainLargeur || 0) - 2 * recul;
    if (dispoL <= 0 || dispoW <= 0) return null;

    var maxLongueur = dispoL - 2 * (+p.debordCote || 0);
    var maxLargeur = dispoW - (+p.debordHaut || 0) - (+p.debordBas || 0);

    function plancher5cm(x) { return Math.max(0, Math.floor(x * 20) / 20); }

    return {
      dispoL: arrondi(dispoL, 2),
      dispoW: arrondi(dispoW, 2),
      longueur: plancher5cm(maxLongueur),
      largeur: plancher5cm(maxLargeur)
    };
  }

  // Combien de voitures tiennent dessous ? Une place confortable fait 2,50 m de
  // large sur 5,00 m de long — en dessous, on ouvre les portières contre un
  // poteau. On teste les deux orientations et on garde la meilleure.
  function capaciteVoitures(longueur, largeur) {
    var L_PLACE = 5.0, W_PLACE = 2.5;
    var a = (largeur >= L_PLACE) ? Math.floor(longueur / W_PLACE) : 0;
    var b = (longueur >= L_PLACE) ? Math.floor(largeur / W_PLACE) : 0;
    return {
      nb: Math.max(a, b),
      sens: a >= b ? 'voitures rangées côte à côte dans la longueur' : 'voitures rangées côte à côte dans la largeur'
    };
  }

  function calculer(p) {
    var out = { alertes: [], conseils: [] };

    // Le terrain commande : si l'ajustement automatique est actif, ce sont ses
    // dimensions qui déterminent celles de l'abri, pas l'inverse.
    var terrain = adapterAuTerrain(p);
    if (terrain && p.autoAjuster !== false) {
      if (terrain.longueur < 2 || terrain.largeur < 2) {
        out.alertes.push('Terrain trop petit : après ' + (+p.recul || 0) +
          ' m de recul et les débords de toiture, il ne reste que ' +
          terrain.longueur + ' × ' + terrain.largeur +
          ' m entre poteaux. Réduis le recul ou les débords.');
      }
      p = Object.assign({}, p, {
        longueur: Math.max(2, terrain.longueur),
        largeur: Math.max(2, terrain.largeur)
      });
    }

    var longueur = +p.longueur, largeur = +p.largeur;
    var hHaut = +p.hautAvant, hBas = +p.hautArriere;
    var couv = COUVERTURES[p.couverture] || COUVERTURES.bac_acier;
    var pied = PIEDS_POTEAU[p.piedPoteau] || PIEDS_POTEAU.reglable;
    var essence = ESSENCES[p.essence] || ESSENCES.douglas;
    var crans = +p.chargeSup || 0;   // 0 = plaine, 1 = neige marquée, 2 = montagne
    // Les panneaux et leurs rails pèsent en permanence sur la charpente, et
    // cette charge s'ajoute à la neige : on monte d'un cran, comme pour une
    // couverture lourde.
    if (p.solaire) crans += 1;

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

    // --- Options : solaire et électricité -----------------------------------
    var solaire = calculerSolaire(p, out.geometrie, longPanne, longChevron, out);
    var elec = calculerElec(p, out);

    if (solaire && solaire.nb > 0) {
      ligne('Solaire', solaire.panneau.nom, null, 0, solaire.nb, 'u',
        solaire.parRangee + ' par rangée × ' + solaire.rangees + ' rangée(s), en ' + solaire.sens +
        ' — ' + solaire.kwc + ' kWc');
      ligne('Solaire', 'Rail aluminium de fixation', null, 0, solaire.rails, 'ml',
        'Posé perpendiculairement aux panneaux, vissé dans les chevrons');
      ligne('Solaire', 'Pinces de fixation (milieu + extrémité)', null, 0, solaire.pinces, 'u', '');
      ligne('Solaire', 'Crochets ou pattes de fixation sur bac acier', null, 0, solaire.rails * 2, 'u',
        'Un point de fixation tous les 50 cm environ');
      ligne('Solaire', solaire.micro ? 'Micro-onduleurs' : 'Onduleur central',
        null, 0, solaire.micro ? solaire.nb : 1, 'u',
        solaire.micro
          ? 'Un par panneau : une ombre sur un panneau ne pénalise plus les autres'
          : 'Moins cher, mais tout le champ suit le panneau le plus ombragé');
      ligne('Solaire', 'Câble solaire 6 mm² + connecteurs MC4', null, 0, solaire.cableSolaire, 'ml', '');
      ligne('Solaire', 'Coffret de protection AC/DC + parafoudre', null, 0, 1, 'u',
        'Obligatoire pour le CONSUEL');
    }

    if (elec) {
      if (elec.circuitPrises) {
        ligne('Électricité', 'Câble U-1000 R2V 3G' + elec.circuitPrises.section + ' (prises)',
          null, 0, elec.cableTotal, 'ml',
          'Chute de tension ' + elec.circuitPrises.chutePct + ' % sur ' + elec.distance +
          ' m · disjoncteur ' + elec.circuitPrises.disjoncteur + ' A');
        ligne('Électricité', 'Prises étanches IP55', null, 0, elec.nbPrises, 'u',
          'Sous l\'abri, à 1 m du sol minimum');
      }
      if (elec.circuitLumiere) {
        ligne('Électricité', 'Câble U-1000 R2V 3G' + elec.circuitLumiere.section + ' (éclairage)',
          null, 0, elec.cableTotal, 'ml',
          'Chute limitée à 3 % (' + elec.circuitLumiere.chutePct + ' % ici) · disjoncteur ' +
          elec.circuitLumiere.disjoncteur + ' A');
        ligne('Électricité', 'Réglettes LED étanches IP65', null, 0, elec.nbLampes, 'u',
          'Fixées sous les chevrons, entre deux pannes');
        ligne('Électricité', 'Détecteur de mouvement extérieur', null, 0, 1, 'u',
          'Évite de laisser la lumière allumée toute la nuit');
      }
      if (elec.circuitBorne) {
        ligne('Électricité', 'Câble U-1000 R2V ' + (elec.borne.triphase ? '5G' : '3G') +
          elec.circuitBorne.section + ' (borne)', null, 0, elec.cableTotal, 'ml',
          'Chute de tension ' + elec.circuitBorne.chutePct + ' % — calculée pour ' +
          elec.borne.courant + ' A (majorés de 25 % en charge continue) sur ' + elec.distance +
          ' m · disjoncteur dédié ' + elec.circuitBorne.disjoncteur + ' A');
        ligne('Électricité', elec.borne.nom, null, 0, 1, 'u',
          'Sur pied ou fixée au poteau, à 90 – 120 cm du sol');
        ligne('Électricité', 'Différentiel 30 mA type A-EV (ou type B)', null, 0, 1, 'u',
          'Exigé pour une borne de recharge : un différentiel classique ne détecte pas le courant continu de défaut');
      }
      ligne('Électricité', 'Gaine TPC rouge Ø63 mm', null, 0, elec.gaine, 'ml',
        'Enterrée à ' + Math.round(elec.profondeurTranchee * 100) + ' cm' +
        (elec.profondeurTranchee > 0.7 ? ' (passage de véhicule)' : ''));
      ligne('Électricité', 'Grillage avertisseur rouge', null, 0, elec.grillage, 'ml',
        'À 20 cm au-dessus de la gaine : c\'est lui qui évite le coup de pelle dans dix ans');
      ligne('Électricité', 'Coffret étanche IP65 + disjoncteurs', null, 0, 1, 'u', '');
      ligne('Électricité', 'Piquet de terre + liaison équipotentielle', null, 0, 1, 'u',
        'Indispensable sur un ouvrage extérieur avec des masses métalliques');
    }

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
    if (solaire && solaire.nb > 0) {
      var prixWc = +prix.solaire_wc || PRIX_DEFAUT.solaire_wc;
      devis.push({ poste: 'Kit solaire ' + solaire.kwc + ' kWc (panneaux, rails, onduleurs, coffret)',
        montant: solaire.kwc * 1000 * prixWc });
    }
    if (elec) {
      var coutElec = (elec.cableTotal * (+prix.cable_ml || PRIX_DEFAUT.cable_ml)) +
        (elec.gaine * 3) + (elec.nbPrises * 22) + (elec.nbLampes * 35) +
        (elec.borne.kw > 0 ? (+prix.borne_ve || PRIX_DEFAUT.borne_ve) : 0) + 180;
      devis.push({ poste: 'Électricité (câbles, tranchée, prises, éclairage' +
        (elec.borne.kw > 0 ? ', borne ' + elec.borne.kw + ' kW' : '') + ')', montant: coutElec });
    }
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
    // --- Bilan terrain ------------------------------------------------------
    var empriseToitL = longPanne;                       // toiture, débords compris
    var empriseToitW = largeur + (+p.debordHaut || 0) + (+p.debordBas || 0);
    var voitures = capaciteVoitures(longueur, largeur);
    out.terrain = {
      actif: !!terrain,
      auto: terrain && p.autoAjuster !== false,
      terrainLongueur: +p.terrainLongueur || 0,
      terrainLargeur: +p.terrainLargeur || 0,
      recul: +p.recul || 0,
      dispoL: terrain ? terrain.dispoL : 0,
      dispoW: terrain ? terrain.dispoW : 0,
      empriseToitureL: arrondi(empriseToitL, 2),
      empriseToitureW: arrondi(empriseToitW, 2),
      empriseToitureM2: arrondi(empriseToitL * empriseToitW, 1),
      voitures: voitures.nb,
      voituresSens: voitures.sens
    };

    if (terrain) {
      var resteL = (+p.terrainLongueur || 0) - empriseToitL;
      var resteW = (+p.terrainLargeur || 0) - empriseToitW;
      out.terrain.margeL = arrondi(resteL, 2);
      out.terrain.margeW = arrondi(resteW, 2);
      if (resteL < 0 || resteW < 0) {
        out.alertes.push('La TOITURE dépasse du terrain : ' + arrondi(empriseToitL, 2) + ' × ' +
          arrondi(empriseToitW, 2) + ' m de toit pour un terrain de ' + p.terrainLongueur + ' × ' +
          p.terrainLargeur + ' m. Ce sont les débords qui débordent — réduis-les, ou réduis l\'abri.');
      } else if ((+p.recul || 0) > 0 && (resteL / 2 < (+p.recul || 0) - 0.01 || resteW / 2 < (+p.recul || 0) - 0.01)) {
        out.alertes.push('Le recul de ' + (+p.recul) +
          ' m n\'est pas tenu partout une fois les débords comptés : il reste ' +
          arrondi(Math.min(resteL, resteW) / 2, 2) + ' m du côté le plus juste. En France, c\'est bien' +
          ' le bord de toiture qui compte pour la distance aux limites, pas le poteau.');
      }
      if (voitures.nb === 0) {
        out.conseils.push('Aucune place de voiture complète ne tient dessous (il faut environ 2,50 m × 5,00 m par voiture). L\'abri reste utile pour du bois, un atelier ou des vélos.');
      } else {
        out.conseils.push(voitures.nb + ' voiture(s) peuvent tenir dessous — ' + voitures.sens + '.');
      }
    }

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
    out.solaire = solaire;
    out.elec = elec;
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
    adapterAuTerrain: adapterAuTerrain,
    capaciteVoitures: capaciteVoitures,
    COUVERTURES: COUVERTURES,
    PIEDS_POTEAU: PIEDS_POTEAU,
    ESSENCES: ESSENCES,
    PRIX_DEFAUT: PRIX_DEFAUT,
    LONGUEURS_STOCK: LONGUEURS_STOCK,
    debiter: debiter,
    sectionCable: sectionCable,
    PANNEAUX: PANNEAUX,
    ENSOLEILLEMENT: ENSOLEILLEMENT,
    AZIMUTS: AZIMUTS,
    BORNES_VE: BORNES_VE,
    arrondi: arrondi,
    sectionTexte: sectionTexte
  };
})(window);
