/*
 * steps_ecran.js — la marche à suivre pour transformer un petit écran
 * GeekMagic SmallTV (vendu comme gadget météo) en tableau de bord Home
 * Assistant, sans flasher l'appareil.
 *
 * Sixième projet de l'app, inspiré d'un article Frandroid (« Comment j'ai
 * transformé un écran AliExpress à 15 € en tableau de bord domotique grâce
 * à l'IA ») : l'auteur y arrive avec un agent IA et un script maison. Le
 * même résultat s'obtient de façon reproductible avec un projet open
 * source existant, sans écrire de script : l'intégration Home Assistant
 * geekmagic-hacs, qui fait le rendu des images côté serveur et les pousse
 * à l'écran par HTTP.
 *
 * Projet open source : adrienbrault/geekmagic-hacs (MIT)
 * https://github.com/adrienbrault/geekmagic-hacs
 */
(function (global) {
  'use strict';

  function construire() {
    return [
      {
        id: 'e_materiel',
        titre: 'Réunir le matériel',
        duree: 'achats — ~15 €',
        outils: ['GeekMagic SmallTV ou SmallTV Ultra', 'Une instance Home Assistant existante'],
        details: [
          'GeekMagic SmallTV Ultra : un petit écran de 240 × 240 pixels vendu autour de 15 € sur AliExpress, présenté comme une station météo de bureau — c\'est lui qui sert d\'afficheur, sans rien à souder.',
          'Le SmallTV et le SmallTV Ultra reposent sur la même puce ESP8266 et le même écran ; seul le logiciel embarqué change. Le SmallTV Pro tourne sur un ESP32 plus costaud avec plus de mémoire, mais coûte nettement plus cher — inutile pour cet usage.',
          'Une instance Home Assistant déjà installée et fonctionnelle, avec HACS (Home Assistant Community Store) activé : c\'est elle qui fait tout le travail de rendu, l\'écran ne fait qu\'afficher l\'image reçue.'
        ],
        attention: 'Ce projet ne demande aucun flashage de l\'écran : il tourne avec son firmware d\'origine. Vérifie simplement que tu commandes bien un modèle SmallTV / SmallTV Ultra (ESP8266) — pas obligatoire d\'avoir le Pro.'
      },
      {
        id: 'e_wifi',
        titre: 'Connecter l\'écran au Wi-Fi',
        duree: '5 min',
        outils: ['Smartphone'],
        details: [
          'Alimente l\'écran en USB : il démarre sur son thème d\'horloge/météo par défaut.',
          'Configure le Wi-Fi de l\'écran depuis l\'app ou le portail de configuration fournis par GeekMagic, pour qu\'il rejoigne le même réseau que ta Home Assistant.',
          'Note l\'adresse IP attribuée à l\'écran : elle sera redemandée à l\'étape suivante.'
        ]
      },
      {
        id: 'e_hacs',
        titre: 'Installer l\'intégration via HACS',
        duree: '5 min',
        outils: ['Home Assistant', 'HACS'],
        details: [
          'Dans Home Assistant, ouvre HACS → menu → Dépôts personnalisés (Custom repositories).',
          'Ajoute l\'URL du dépôt : https://github.com/adrienbrault/geekmagic-hacs',
          'Installe l\'intégration « GeekMagic Display », puis redémarre Home Assistant.'
        ],
        astuce: 'Une installation manuelle est aussi possible : copier le dossier custom_components/geekmagic dans le dossier custom_components de Home Assistant, pour qui préfère éviter HACS.'
      },
      {
        id: 'e_appareil',
        titre: 'Ajouter l\'écran dans Home Assistant',
        duree: '5 min',
        outils: ['Home Assistant'],
        details: [
          'Paramètres → Appareils et services → Ajouter une intégration → cherche « GeekMagic ».',
          'Renseigne l\'adresse IP de l\'écran notée à l\'étape précédente.',
          'Le type de firmware et le profil d\'API sont détectés automatiquement : pas besoin de préciser le modèle exact.'
        ]
      },
      {
        id: 'e_dashboard',
        titre: 'Composer le tableau de bord',
        duree: '15 à 30 min',
        outils: ['Éditeur de vue geekmagic-hacs'],
        details: [
          'L\'éditeur de vue propose un aperçu en direct, le choix de la disposition (plein écran, grilles 2×2 à 3×3, séparations horizontales/verticales, mises en avant) et 15 thèmes (watchOS, Classic, Neon, Retro, StandBy, Night...).',
          'Ajoute des widgets par simple sélection d\'entité : jauges (barre, anneau, arc), valeur d\'entité, météo, climatisation, graphique, liste d\'attributs, HTML/CSS personnalisé...',
          'Reprends l\'idée de l\'article qui a inspiré ce projet : température et CO2 de la maison (vert sous 800 ppm, orange jusqu\'à 1200, rouge au-delà), consommation électrique en watts, ou tout autre capteur déjà suivi dans Home Assistant.'
        ],
        images: [
          { src: 'img/ecran/smart_home.png', alt: 'Exemple de dashboard rendu par geekmagic-hacs : lumières, température, humidité, porte' },
          { src: 'img/ecran/energy_monitor.png', alt: 'Exemple de dashboard énergie : consommation, production solaire, export, total du jour' }
        ]
      },
      {
        id: 'e_reglages',
        titre: 'Régler rafraîchissement, rotation et luminosité',
        duree: '5 min',
        outils: [],
        details: [
          'number.geekmagic_refresh_interval : fréquence de mise à jour de l\'image (5 à 300 secondes).',
          'number.geekmagic_cycle_interval : durée d\'affichage de chaque vue avant de passer à la suivante, si plusieurs vues sont configurées.',
          'number.geekmagic_brightness : luminosité de l\'écran (0 à 100 %).',
          'select.geekmagic_mode : basculer entre vues personnalisées, horloge, météo ou infos système.'
        ]
      },
      {
        id: 'e_automatiser',
        titre: 'Automatiser (optionnel)',
        duree: '10 min',
        outils: ['Automatisations Home Assistant'],
        details: [
          'switch.geekmagic_active permet d\'éteindre l\'écran automatiquement, par exemple quand la pièce est vide : déclencheur sur un capteur de présence, action switch.turn_off sur cette entité.',
          'Le service geekmagic.notify affiche une alerte temporaire par-dessus le tableau de bord (message, icône, durée) — utile pour un mouvement détecté ou une alerte ponctuelle.'
        ]
      }
    ];
  }

  global.EcranSteps = { construire: construire };
})(window);
