/*
 * steps_routeur.js — la marche à suivre pour monter le routeur solaire
 * (PV router) qui envoie le surplus des panneaux vers une charge (ballon
 * d'eau chaude, chauffage) au lieu de le revendre à perte.
 *
 * Quatrième projet de l'app, même principe que les trois autres : des
 * étapes cochables, avec outils, durée, points d'attention et astuces,
 * mais un contenu fixe basé sur le dépôt source.
 *
 * Projet open source (matériel + firmware) : xlyric/pv-router-esp32,
 * association APPER — https://github.com/xlyric/pv-router-esp32
 * Licence CC BY-NC-SA 4.0 (usage non commercial).
 *
 * Ce projet n'apparaît dans l'app que si le carport a l'option panneaux
 * solaires activée (P.solaire) : sans production solaire, un routeur de
 * surplus n'a pas d'utilité.
 */
(function (global) {
  'use strict';

  function construire() {
    return [
      {
        id: 'r_materiel',
        titre: 'Réunir le matériel',
        duree: 'achats — ~45 € (base)',
        outils: ['TTGO T-Display (ESP32 + écran)', 'Sonde SCT013', 'Carte routeur DIN (APPER)', 'Sonde(s) Dallas 18B20'],
        details: [
          'Carte routeur au format DIN : vendue par l\'association APPER (~25 €), avec son support DIN — commande directe sur HelloAsso.',
          'TTGO T-Display : microcontrôleur ESP32 avec écran couleur intégré (~12 €), non fourni par l\'association.',
          'Sonde de courant SCT013 (~8 €), ou en alternative un Shelly EM pour la mesure.',
          'Sonde(s) de température Dallas 18B20 : fortement recommandées pour la sécurité si un variateur est utilisé.',
          'En option : un variateur AC déporté (Robotdyn) ou un relais statique (SSR) pour piloter une charge — voir le projet complémentaire PV-Dimmer.'
        ],
        attention: 'Budget approximatif du kit de base (carte APPER + TTGO + SCT013) : ~45 €, hors variateur/relais. Achetée via l\'association APPER, la carte ouvre droit à un crédit d\'impôt de 60 % pour les particuliers en France.'
      },
      {
        id: 'r_cablage',
        titre: 'Câbler la sonde et les sécurités',
        duree: '30 min à 1 h',
        outils: ['Tournevis', 'Disjoncteur 2 A', 'Câbles isolés'],
        details: [
          'Sans variateur déporté : installe la carte dans le tableau électrique et connecte la sonde SCT013 sur la phase de sortie du compteur (entre le compteur et le tableau).',
          'Avec variateur déporté : branche en plus le Dimmer à l\'emplacement prévu sur la carte, et ajoute une sonde Dallas 18B20 pour éviter toute surchauffe.',
          'Sur un ballon en stéatite : n\'utilise qu\'une seule résistance pour une régulation plus fine et moins de perturbations réseau.',
          'Prends le plus grand variateur Robotdyn (20 A) ou un SSR Random 40 A minimum, et ventile son dissipateur si la puissance est élevée.'
        ],
        attention: 'La carte a une protection intégrée (fusible), mais place-la derrière un disjoncteur 2 A. Utilise des câbles correctement isolés, et fais appel à un professionnel qualifié en cas de doute — c\'est un raccordement sur le réseau électrique de la maison.'
      },
      {
        id: 'r_flash',
        titre: 'Flasher le firmware (Web OTA)',
        duree: '5 min',
        outils: ['Navigateur Chrome ou Edge', 'Câble USB'],
        details: [
          'Branche le TTGO en USB, puis va sur ota.apper-solaire.org/ota.php depuis Chrome ou Edge.',
          'Sélectionne le port série auquel le TTGO est connecté.',
          'Choisis « INSTALL PV ROUTER TTGO » (ou une autre version selon la carte), puis valide : le programme se charge automatiquement.'
        ],
        astuce: 'Pas besoin d\'installer PlatformIO ni l\'IDE Arduino pour un flash simple : le Web OTA suffit. Les mises à jour suivantes se font directement depuis la page /update de l\'interface du routeur.'
      },
      {
        id: 'r_wifi',
        titre: 'Configurer le Wi-Fi',
        duree: '5 min',
        outils: ['Console série ou mode point d\'accès'],
        details: [
          'Par port série : ouvre la console (« Log & Console » depuis l\'outil OTA) et tape : pass ton_mot_de_passe puis ssid ton_ssid puis reboot.',
          'Par mode AP : connecte-toi au point d\'accès Wi-Fi du routeur et configure ton réseau via l\'interface qui s\'ouvre automatiquement.',
          'L\'écran TTGO affiche ensuite l\'IP et le niveau de signal : jaune = bon (> -64 dBm), orange = moyen (> -70 dBm), rouge = faible (> -80 dBm).'
        ]
      },
      {
        id: 'r_dashboard',
        titre: 'Découvrir le tableau de bord',
        duree: '10 min',
        outils: ['Navigateur'],
        details: [
          'Connecte-toi à l\'IP affichée sur l\'écran TTGO depuis n\'importe quel navigateur du réseau local.',
          'Le tableau de bord affiche : Sigma (W, puissance échangée avec le réseau), Dimmers (%, puissance envoyée aux variateurs), Température, et l\'état (Stable / Injection / Réseau).',
          'La page Configuration regroupe les réglages du variateur local, des seuils de routage et du Wi-Fi/MQTT.'
        ],
        images: [
          { src: 'img/routeur/dashboard.jpg', alt: 'Tableau de bord web du routeur PV : puissance réseau, puissance routée, température et états du système' }
        ]
      },
      {
        id: 'r_reglages',
        titre: 'Régler les seuils de routage',
        duree: '15 à 30 min',
        outils: ['Page Configuration du routeur'],
        details: [
          'Delta (seuil de soutirage, en W) : au-dessus, la charge diminue — valeur par défaut 50 W.',
          'Delta Neg (seuil d\'injection, en W) : en dessous, la charge augmente — valeur par défaut -25 W.',
          'Correction factor : facteur de correction de la mesure, 0.86 par défaut.',
          'Offset et cosphi : à ajuster si la puissance mesurée est incorrecte, en fonction du type de sonde utilisé.',
          'L\'objectif est de garder l\'échange avec le réseau proche de 0 W en permanence, pour maximiser l\'autoconsommation.'
        ],
        astuce: 'Si la mesure de puissance est fausse : vérifie d\'abord le sens et la position de la sonde SCT013 (phase de sortie du compteur), avant de toucher aux réglages cosphi/offset.'
      },
      {
        id: 'r_integration',
        titre: 'Intégrer à Home Assistant / MQTT (optionnel)',
        duree: '15 min',
        outils: [],
        details: [
          'Le routeur propose une intégration MQTT native, compatible Home Assistant, Jeedom et Domoticz — à configurer depuis la page MQTT de l\'interface web.',
          'Quelques points d\'accès utiles pour l\'automatisation : /state et /statefull (état en JSON), /getmqtt (config MQTT), /boost (mode boost 2 h), /reboot.',
          'Une source d\'énergie externe est aussi possible (Shelly EM, Enphase Envoy) à la place de la sonde SCT013.'
        ]
      }
    ];
  }

  global.RouteurSteps = { construire: construire };
})(window);
