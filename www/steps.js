/*
 * steps.js — la marche à suivre, construite à partir du projet calculé.
 *
 * Les étapes ne sont pas un texte figé : les cotes, les quantités et les gestes
 * changent selon les choix (type de pied de poteau, couverture, présence de
 * jambes de force). Une notice qui parle de sceller un sabot alors qu'on a
 * choisi des pieds réglables, c'est une notice qu'on cesse de lire.
 *
 * Chaque étape porte un `id` stable : c'est lui qui retient les cases cochées
 * d'un chantier à l'autre.
 */
(function (global) {
  'use strict';

  function m(x) { return Calc.arrondi(x, 2) + ' m'; }

  function construire(r) {
    var p = r.parametres, s = r.structure, f = r.fondations;
    var pied = p.piedPoteau, etapes = [];

    etapes.push({
      id: 'admin',
      titre: 'Vérifier ce que tu as le droit de construire',
      duree: '1 h + délai mairie',
      outils: ['Plan cadastral', 'PLU de la commune'],
      details: [
        'Emprise au sol du projet : ' + Calc.arrondi(p.longueur * p.largeur, 1) + ' m².',
        p.longueur * p.largeur > 20
          ? 'Au-dessus de 20 m², un permis de construire est en principe exigé (comptez 2 à 3 mois).'
          : 'En dessous de 20 m², une déclaration préalable suffit en général (environ 1 mois d\'instruction).',
        'Vérifie aussi les distances aux limites séparatives (souvent 3 m, ou en limite sous conditions) et les règles d\'aspect du PLU.',
        'En secteur protégé (monument historique, site classé), l\'avis de l\'architecte des Bâtiments de France s\'ajoute.'
      ],
      attention: 'Un abri monté sans autorisation peut être frappé d\'une demande de démolition, même des années plus tard. C\'est l\'étape la moins agréable et la plus rentable.'
    });

    etapes.push({
      id: 'implantation',
      titre: 'Implanter et tracer',
      duree: '2 h',
      outils: ['Cordeau', 'Équerre de maçon ou méthode 3-4-5', 'Mètre ruban 10 m', 'Piquets', 'Niveau laser ou à bulle'],
      details: [
        'Trace le rectangle fini : ' + m(p.longueur) + ' × ' + m(p.largeur) + ' (axes des poteaux).',
        'Vérifie l\'équerrage en mesurant les deux diagonales : elles doivent être égales à moins de 1 cm (ici ' +
          Calc.arrondi(Math.sqrt(p.longueur * p.longueur + p.largeur * p.largeur), 2) + ' m).',
        'Marque les ' + s.nbPoteaux + ' centres de poteaux : ' + s.nbParRangee +
          ' par file, espacés de ' + m(s.entraxePoteaux) + '.',
        'Repère le sens de la pente : la file haute (' + m(p.hautAvant) + ') et la file basse (' + m(p.hautArriere) + ').'
      ],
      astuce: 'Plante les piquets 50 cm en dehors du tracé et tends les cordeaux entre eux : tu peux creuser sans perdre tes repères.'
    });

    etapes.push({
      id: 'fouilles',
      titre: 'Creuser les fondations',
      duree: '1 journée à la main, 2 h à la mini-pelle',
      outils: ['Bêche / tarière', 'Brouette', 'Pelle', 'Niveau'],
      details: [
        s.nbPoteaux + ' fouilles de ' + (f.plotCote * 100) + ' × ' + (f.plotCote * 100) +
          ' cm sur ' + (f.plotProfondeur * 100) + ' cm de profondeur.',
        'Descends sous la profondeur hors gel de ta région (50 cm en plaine, jusqu\'à 90 cm en montagne).',
        'Compacte le fond et mets 5 cm de gravier pour drainer.',
        'Volume total à évacuer : environ ' + Calc.arrondi(f.volumeBeton * 1.1, 2) + ' m³ de terre.'
      ],
      attention: 'Avant de creuser, fais une DT-DICT ou vérifie où passent l\'eau, l\'électricité et le tout-à-l\'égout. Une pelle dans un câble, c\'est une très mauvaise journée.'
    });

    var etapeBeton = {
      id: 'beton',
      titre: 'Couler les plots',
      duree: 'une demi-journée + 7 jours de séchage',
      outils: ['Bétonnière ou auge', 'Truelle', 'Règle', 'Niveau', 'Cordeau'],
      details: [
        'Environ ' + f.sacs + ' sacs de 35 kg (soit ' + f.volumeBeton + ' m³) pour les ' + s.nbPoteaux + ' plots.',
        'Coule les plots à la même altitude, en t\'aidant du cordeau : c\'est ce qui évite de rattraper 3 cm plus tard.',
        'Talute légèrement le dessus vers l\'extérieur pour que l\'eau ne stagne pas au pied du poteau.'
      ],
      attention: 'Le béton porte réellement au bout de 7 jours (28 pour sa résistance nominale). Ne mets pas la charpente dessus le lendemain.'
    };
    if (pied === 'sabot_scelle') {
      etapeBeton.details.push('SABOTS À SCELLER : plante chaque sabot dans le béton frais, aligné au cordeau et d\'aplomb, et vérifie l\'entraxe (' +
        m(s.entraxePoteaux) + ') avant que ça ne prenne.');
      etapeBeton.attention += ' Et un sabot scellé de travers ne se rattrape pas : re-vérifie tout avant la prise.';
    }
    if (pied === 'scellement_direct') {
      etapeBeton.details.push('SCELLEMENT DIRECT : les poteaux doivent être en place, étayés et d\'aplomb AVANT de couler.');
    }
    etapes.push(etapeBeton);

    if (pied === 'reglable' || pied === 'sabot_visse') {
      etapes.push({
        id: 'pieds',
        titre: 'Poser les pieds de poteau',
        duree: '2 h',
        outils: ['Perforateur + foret béton Ø10', 'Clé à cliquet', 'Aspirateur', 'Niveau'],
        details: [
          s.nbPoteaux + ' × ' + r.pied.nom + '.',
          'Perce les plots secs, dépoussière les trous (une cheville dans un trou plein de poussière tient deux fois moins) et pose des chevilles à expansion ou des goujons M10.',
          pied === 'reglable'
            ? 'Règle toutes les platines hautes au même niveau au laser AVANT de poser le bois : c\'est exactement à ça que sert ce type de pied.'
            : 'Vérifie l\'écartement intérieur du U : il doit correspondre à la section réelle du poteau (' +
              Calc.sectionTexte(s.sectionPoteau) + ').'
        ],
        astuce: 'Présente les pieds, trace au crayon, retire-les, perce, puis repose : plus rapide que de percer à travers la platine.'
      });
    }

    etapes.push({
      id: 'poteaux',
      titre: 'Lever et caler les poteaux',
      duree: 'une demi-journée à deux',
      outils: ['Étais ou tasseaux de calage', 'Niveau 1 m', 'Serre-joints', 'Visseuse à choc'],
      details: [
        s.nbParRangee + ' poteaux de ' + m(s.longPoteauHaut) + ' côté haut, ' +
          s.nbParRangee + ' de ' + m(s.longPoteauBas) + ' côté bas, en ' + Calc.sectionTexte(s.sectionPoteau) + '.',
        'Coupe les poteaux à la bonne longueur en tenant compte de la hauteur du pied (' +
          Calc.arrondi(r.pied.hauteurSol * 100, 0) + ' cm ici).',
        'Étaie chaque poteau dans deux directions dès qu\'il est debout, et contrôle l\'aplomb sur deux faces.',
        'Contrôle une dernière fois les diagonales de l\'ensemble avant de fixer définitivement.'
      ],
      attention: 'Ne travaille jamais seul au levage : un poteau de ' + Calc.sectionTexte(s.sectionPoteau) +
        ' sur ' + m(s.longPoteauHaut) + ' pèse plusieurs dizaines de kilos et n\'a aucune stabilité tant que la panne n\'est pas posée.'
    });

    etapes.push({
      id: 'pannes',
      titre: 'Poser les pannes porteuses',
      duree: 'une demi-journée à deux',
      outils: ['Scie circulaire', 'Ciseau à bois (si entailles)', 'Serre-joints', 'Tirefonds 8 × 120', 'Échafaudage ou escabeaux'],
      details: [
        '2 pannes de ' + m(s.longPanne) + ' en ' + Calc.sectionTexte(s.sectionPanne) +
          ', posées sur chaque file de poteaux.',
        'Portée entre poteaux : ' + m(s.entraxePoteaux) + ' — c\'est elle qui a dicté cette section.',
        'Assemblage : équerres métalliques de part et d\'autre, ou mi-bois entaillé en tête de poteau puis tirefonné.',
        'Si une panne doit être aboutée, fais-le TOUJOURS au droit d\'un poteau, jamais entre deux.'
      ],
      astuce: 'Pose les pannes avec le cœur du bois vers le haut (les cernes en forme de sourire vers le bas) : la pièce travaille dans le bon sens et se déforme moins.'
    });

    if (s.nbJambes) {
      etapes.push({
        id: 'contreventement',
        titre: 'Poser les jambes de force',
        duree: '2 h',
        outils: ['Scie à onglet ou scie circulaire', 'Tirefonds', 'Serre-joints'],
        details: [
          s.nbJambes + ' jambes de force en ' + Calc.sectionTexte(s.sectionJambe) +
            ', coupées à 45° (environ ' + m(s.longJambe) + ' de long).',
          'Une à chaque tête de poteau, entre le poteau et la panne.',
          'C\'est ce qui empêche l\'ensemble de se coucher en parallélogramme sous le vent.'
        ],
        attention: 'Sans contreventement, un carport sur poteaux tient debout par ses seuls assemblages : le premier coup de vent latéral le met en biais.'
      });
    }

    etapes.push({
      id: 'chevrons',
      titre: 'Poser les chevrons',
      duree: 'une demi-journée',
      outils: ['Mètre', 'Cordeau à tracer', 'Sabots ou équerres', 'Visseuse'],
      details: [
        s.nbChevrons + ' chevrons de ' + m(s.longChevron) + ' en ' + Calc.sectionTexte(s.sectionChevron) + '.',
        'Entraxe ' + Math.round(s.entraxeChevrons * 100) + ' cm, tracé au cordeau sur les deux pannes en même temps.',
        'Débords : ' + Calc.arrondi((+p.debordHaut || 0) * 100, 0) + ' cm en haut, ' +
          Calc.arrondi((+p.debordBas || 0) * 100, 0) + ' cm en bas.',
        'Fixe chaque about avec un sabot ou deux vis en biais, dans les deux pannes.'
      ],
      astuce: 'Pose d\'abord les deux chevrons de rive, tends un cordeau entre eux, et aligne tous les autres dessus : la ligne de toit sera droite.'
    });

    var couv = r.couverture, info = r.couvertureInfo;
    var etapeCouv = {
      id: 'couverture',
      titre: 'Poser la couverture : ' + info.nom,
      duree: 'une demi-journée à une journée',
      outils: ['Visseuse', 'Grignoteuse ou scie à métaux (bac acier)', 'Cordeau', 'Gants anti-coupure', 'Harnais si hauteur'],
      details: [
        'Surface à couvrir : ' + couv.surface + ' m² (mesurée sur le rampant, pas au sol).',
        'Pente réelle : ' + r.geometrie.pentePct + ' % — le minimum admis pour ce matériau est ' + info.penteMini + ' %.'
      ],
      attention: info.note
    };
    if (couv.plaques) {
      etapeCouv.details.push(couv.plaques + ' plaques de ' + couv.longueurPlaque + ' m (largeur utile ' +
        info.largeurUtile + ' m), et environ ' + couv.vis + ' vis à joint néoprène.');
      etapeCouv.details.push('Commence la pose du côté opposé aux vents dominants et recouvre d\'une onde au minimum.');
      etapeCouv.details.push('Visse EN SOMMET D\'ONDE, pas dans le creux : dans le creux, l\'eau passe par la vis.');
    }
    if (couv.tuiles) {
      etapeCouv.details.push('Environ ' + couv.tuiles + ' tuiles et ' + couv.liteaux + ' ml de liteaux.');
      etapeCouv.details.push('Pose l\'écran sous-toiture, puis le contre-lattage, puis les liteaux à l\'entraxe du modèle de tuile.');
    }
    if (couv.osb) {
      etapeCouv.details.push(couv.osb + ' panneaux d\'OSB 18 mm et ' + couv.rouleaux + ' rouleaux de shingle.');
      etapeCouv.details.push('Décale les joints d\'OSB d\'une rangée à l\'autre, et laisse 3 mm de dilatation entre panneaux.');
    }
    etapes.push(etapeCouv);

    // --- Options : elles s'insèrent AVANT les finitions, parce qu'on ne pose
    // pas des panneaux ni un câble une fois la gouttière et les rives en place.
    if (r.solaire && r.solaire.nb > 0) {
      var sol = r.solaire;
      etapes.push({
        id: 'solaire',
        titre: 'Poser les panneaux solaires (' + sol.kwc + ' kWc)',
        duree: 'une journée à deux',
        outils: ['Visseuse à choc', 'Clé dynamométrique', 'Cordeau', 'Harnais', 'Multimètre'],
        details: [
          sol.nb + ' panneaux « ' + sol.panneau.nom + ' », en ' + sol.sens + ' : ' +
            sol.parRangee + ' par rangée sur ' + sol.rangees + ' rangée(s).',
          'Rails aluminium vissés DANS LES CHEVRONS (pas dans la seule tôle) : ' + sol.rails +
            ' ml environ, avec un point de fixation tous les 50 cm.',
          'Pose les crochets, puis les rails, puis contrôle l\'alignement au cordeau avant de poser le premier panneau.',
          sol.micro
            ? 'Un micro-onduleur par panneau, clipsé sous le panneau avant de le poser — après, on n\'y accède plus.'
            : 'Onduleur central à fixer à l\'abri du soleil direct, avec 20 cm d\'air autour.',
          'Serre les pinces au couple indiqué par le fabricant : trop serré, le cadre se déforme et le verre casse.',
          'Charge ajoutée : environ ' + sol.poids + ' kg répartis sur la toiture.'
        ],
        attention: 'Ne marche JAMAIS sur les panneaux, même « juste pour passer ». Une microfissure ne se voit pas et fait chuter la production pendant des années.',
        astuce: 'Laisse un passage de 40 cm entre deux rangées : c\'est ce qui permet de nettoyer et de démonter un panneau sans toucher aux autres.'
      });

      etapes.push({
        id: 'solaire_raccord',
        titre: 'Raccorder et déclarer l\'installation solaire',
        duree: 'une demi-journée + démarches',
        outils: ['Multimètre', 'Pince à sertir MC4', 'Coffret AC/DC'],
        details: [
          'Câblage en série ou en parallèle selon la tension d\'entrée de l\'onduleur — vérifie la tension à vide AVANT de connecter.',
          'Coffret de protection DC et AC avec parafoudre : c\'est exigé au CONSUEL.',
          'Déclaration préalable en mairie, convention d\'autoconsommation Enedis, puis attestation CONSUEL avant mise en service.',
          'Production attendue : environ ' + sol.production.toLocaleString('fr-FR') + ' kWh par an, soit ' +
            sol.economie + ' € d\'économie estimée.'
        ],
        attention: 'Un champ solaire est sous tension dès qu\'il fait jour : il n\'y a pas d\'interrupteur côté panneaux. On câble le matin tôt ou panneaux bâchés, et on ne travaille jamais gants nus sur du DC.'
      });
    }

    if (r.elec) {
      var e = r.elec;
      var lignes = [
        'Tranchée de ' + e.longueurTranchee + ' m à ' + Math.round(e.profondeurTranchee * 100) +
          ' cm de profondeur' + (e.profondeurTranchee > 0.7 ? ' (obligatoire sous un passage de véhicule)' : '') + '.',
        'Gaine TPC rouge Ø63, lit de sable de 5 cm dessous et dessus, puis grillage avertisseur rouge à 20 cm au-dessus.'
      ];
      if (e.circuitPrises) {
        lignes.push('Prises : câble 3G' + e.circuitPrises.section + ' mm² (chute de tension ' +
          e.circuitPrises.chutePct + ' % sur ' + e.distance + ' m), ' + e.nbPrises + ' prises IP55.');
      }
      if (e.circuitLumiere) {
        lignes.push('Éclairage : câble 3G' + e.circuitLumiere.section + ' mm², ' + e.nbLampes +
          ' réglettes LED IP65 fixées sous les chevrons.');
      }
      if (e.circuitBorne) {
        lignes.push('Borne : câble ' + (e.borne.triphase ? '5G' : '3G') + e.circuitBorne.section +
          ' mm² dédié, protégé par un différentiel 30 mA type A-EV et son propre disjoncteur.');
      }
      lignes.push('Piquet de terre au pied de l\'abri, relié au coffret et à toute masse métallique.');

      etapes.push({
        id: 'elec',
        titre: 'Amener le courant et poser les équipements',
        duree: 'une journée (tranchée comprise)',
        outils: ['Bêche ou trancheuse', 'Aiguille de tirage', 'Pince à dénuder', 'Multimètre', 'Perforateur'],
        details: lignes,
        attention: 'Le raccordement au tableau se fait hors tension, et doit être réalisé ou vérifié par un électricien : c\'est ce que demandera ton assurance en cas de sinistre. Une borne de recharge ajoutée sans déclaration peut aussi poser problème avec ton fournisseur.',
        astuce: 'Passe une deuxième gaine vide dans la même tranchée. Elle ne coûte presque rien aujourd\'hui, et elle t\'évitera de tout rouvrir le jour où tu voudras de la fibre, un portail ou une caméra.'
      });
    }

    etapes.push({
      id: 'finitions',
      titre: 'Finitions et évacuation de l\'eau',
      duree: 'une demi-journée',
      outils: ['Scie', 'Visseuse', 'Pinceau ou pulvérisateur'],
      details: [
        'Planches de rive sur les abouts de chevrons : elles cachent les coupes et protègent le bois de bout, qui boit l\'eau bien plus que le reste.',
        'Gouttière du côté bas (' + m(p.hautArriere) + ') : ' + Calc.arrondi(p.longueur, 2) +
          ' m de gouttière, une descente, et de quoi éloigner l\'eau du pied des poteaux.',
        'Traitement / saturateur sur toutes les faces, y compris les coupes faites sur le chantier (une coupe fraîche n\'est plus protégée).',
        'Contrôle final de tous les assemblages au serrage.'
      ],
      astuce: 'La pluie qui ruisselle au pied d\'un poteau est ce qui le tue en premier. Une gouttière et 5 cm de gravier autour des plots font gagner des années.'
    });

    etapes.push({
      id: 'entretien',
      titre: 'Après un an : re-serrer et contrôler',
      duree: '1 h par an',
      outils: ['Clé à cliquet', 'Niveau'],
      details: [
        'Le bois sèche et travaille : re-serre tous les tirefonds au bout de quelques mois.',
        'Vérifie l\'aplomb des poteaux et l\'état des pieds métalliques (corrosion, eau stagnante).',
        'Reprends le saturateur tous les 2 à 3 ans selon l\'exposition.'
      ]
    });

    return etapes;
  }

  global.Steps = { construire: construire };
})(window);
