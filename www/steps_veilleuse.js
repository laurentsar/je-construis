/*
 * steps_veilleuse.js — la marche à suivre pour monter une veilleuse
 * anti-trébuchement : une carte à ~5 €, un capteur de présence et une
 * bande LED, pilotés par ESPHome et Home Assistant.
 *
 * Septième projet de l'app, inspiré d'un article Android MT (Ouest-France,
 * d'après How-To Geek) sur la Raspberry Pi Pico W comme porte d'entrée bon
 * marché dans la domotique DIY. L'article ne donne ni dépôt ni YAML complet
 * : ce guide s'appuie donc directement sur la documentation officielle
 * ESPHome pour la plateforme RP2 (Pico W / Pico 2 W).
 *
 * Source matérielle : article Android MT, d'après How-To Geek.
 * Source technique : https://esphome.io/components/rp2/ (ESPHome, MIT).
 */
(function (global) {
  'use strict';

  function construire() {
    return [
      {
        id: 'v_materiel',
        titre: 'Réunir le matériel',
        duree: 'achats — ~10 à 15 €',
        outils: ['Raspberry Pi Pico W (ou Pico 2 W)', 'Capteur PIR HC-SR501', 'Bande LED 12 V + MOSFET (ou module relais)', 'Câbles Dupont, câble USB'],
        details: [
          'Raspberry Pi Pico W : microcontrôleur RP2040 avec Wi-Fi/Bluetooth (puce CYW43439), environ 5 à 6 € — la Pico 2 W (RP2350) fonctionne aussi, un peu plus chère. Ni l\'une ni l\'autre n\'a de système d\'exploitation : ce sont des microcontrôleurs, pas des mini-ordinateurs.',
          'Un capteur de présence PIR HC-SR501, très courant et bon marché : il détecte la chaleur d\'un mouvement, avec un potentiomètre de sensibilité et un potentiomètre de délai.',
          'Une bande LED 12 V classique (non adressable), pilotée via un petit MOSFET (ou un module relais) commandé par un GPIO du Pico — plus simple à câbler qu\'une bande adressable pour un premier montage.',
          'Une alimentation 12 V adaptée à la bande LED, des câbles Dupont, et un câble USB pour le Pico.'
        ],
        attention: 'Le Pico W n\'a ni MMU ni mémoire abondante (quelques centaines de Ko) : il ne fait tourner qu\'un firmware dédié (ESPHome), pas un système complet. C\'est largement suffisant pour lire un capteur et piloter une sortie.'
      },
      {
        id: 'v_addon',
        titre: 'Installer l\'add-on ESPHome dans Home Assistant',
        duree: '5 min',
        outils: ['Home Assistant'],
        details: [
          'Paramètres → Modules complémentaires → Boutique des modules complémentaires.',
          'Cherche « ESPHome », installe-le puis démarre-le.',
          'Ouvre son interface : c\'est elle qui va générer et envoyer le firmware au Pico.'
        ]
      },
      {
        id: 'v_config',
        titre: 'Créer la configuration de base',
        duree: '10 min',
        outils: ['Interface ESPHome'],
        details: [
          'Dans ESPHome, crée un nouvel appareil et choisis la carte rpipicow (Pico W) ou rpipico2w (Pico 2 W).',
          'La configuration minimale tient en quelques lignes :',
          'rp2:\n  board: rpipicow',
          'ESPHome ajoute automatiquement les blocs wifi, api, ota et logger nécessaires pour qu\'il rejoigne ton réseau et Home Assistant.'
        ],
        astuce: 'Depuis ESPHome 2026.7.0, la clé de plateforme s\'appelle rp2: (l\'ancienne rp2040: fonctionne encore, mais sera retirée courant 2027). Inutile de préciser platform_version : ce n\'est plus nécessaire depuis la 2024.9.2.'
      },
      {
        id: 'v_cablage',
        titre: 'Câbler le capteur et la bande LED',
        duree: '20 à 30 min',
        outils: ['Fer à souder ou plaque sans soudure', 'Tournevis (potentiomètres du PIR)'],
        details: [
          'Capteur PIR : VCC sur le 5V/3V3 du Pico (selon le modèle), GND sur une masse commune, OUT sur un GPIO libre (par exemple GPIO 15).',
          'Bande LED : alimentée en 12 V séparément, avec son retour commuté par un MOSFET (ou l\'entrée d\'un module relais) ; la grille du MOSFET (ou l\'entrée de commande du relais) se branche sur un autre GPIO (par exemple GPIO 16).',
          'Vérifie une masse commune entre le Pico, le PIR et l\'alimentation 12 V de la bande LED : sans ça, rien ne fonctionne de façon fiable.'
        ],
        attention: 'Ne branche jamais directement une bande LED 12 V sur un GPIO du Pico (3,3 V, courant limité) : toujours passer par un MOSFET ou un relais pour commuter la puissance séparément.'
      },
      {
        id: 'v_declaration',
        titre: 'Déclarer le capteur et la sortie dans ESPHome',
        duree: '10 min',
        outils: ['Interface ESPHome'],
        details: [
          'Ajoute un binary_sensor sur le GPIO du PIR, type motion : il remonte « détecté / pas détecté » dans Home Assistant.',
          'Ajoute une output (platform gpio) sur le GPIO relié au MOSFET ou au relais, puis une light (platform binary ou monochromatic) par-dessus, pour piloter la bande LED comme n\'importe quelle lumière Home Assistant.',
          'Enregistre, puis utilise le bouton Install d\'ESPHome pour compiler le firmware.'
        ]
      },
      {
        id: 'v_flash',
        titre: 'Premier flashage par USB',
        duree: '5 min',
        outils: ['Câble USB'],
        details: [
          'Maintiens le bouton BOOTSEL du Pico appuyé pendant le branchement USB : il apparaît sur l\'ordinateur comme un lecteur RPI-RP2.',
          'Lance l\'installation depuis ESPHome (en local, via le câble) : le firmware UF2 est copié sur ce lecteur, puis le Pico redémarre tout seul dessus.',
          'Les mises à jour suivantes se font par Wi-Fi (OTA), sans rebrancher le Pico.'
        ],
        astuce: 'Si les logs n\'apparaissent pas par USB, ajoute logger: hardware_uart: UART0 avec baud_rate: 115200 dans la configuration, et surveille-les via un adaptateur USB-série sur les broches GPIO 0 (TX) / GPIO 1 (RX) du Pico W.'
      },
      {
        id: 'v_automatiser',
        titre: 'Créer l\'automatisation dans Home Assistant',
        duree: '10 min',
        outils: ['Automatisations Home Assistant'],
        details: [
          'Déclencheur : le binary_sensor du PIR passe à « détecté ».',
          'Action : allumer la bande LED (luminosité réduite, pour ne pas éblouir en pleine nuit), puis l\'éteindre après un délai (par exemple 2 minutes) une fois le mouvement retombé.',
          'Autres idées citées par l\'article d\'origine, sur le même principe (un capteur + une sortie ESPHome) : capteur de porte, suivi de lave-linge/sèche-linge par vibration, sonde d\'humidité pour une plante.'
        ],
        attention: 'Le capteur PIR HC-SR501 réagit à la chaleur : une couverture chaude ou un animal qui bouge peuvent déclencher une fausse détection (et laisser la lumière allumée toute la nuit). Teste-le en conditions réelles, et ajuste ses deux potentiomètres (sensibilité, délai) avant de le considérer fiable.'
      }
    ];
  }

  global.VeilleuseSteps = { construire: construire };
})(window);
