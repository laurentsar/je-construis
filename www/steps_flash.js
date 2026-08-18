/*
 * steps_flash.js — la marche à suivre pour flasher la passerelle Zigbee Lidl
 * Silvercrest avec un firmware open source, depuis un PC sous Ubuntu.
 *
 * Troisième projet de l'app, même principe que le carport et le Traducteur
 * Gemma : des étapes cochables, avec outils, durée, points d'attention et
 * astuces, mais un contenu fixe basé sur une procédure de flash réelle.
 *
 * Projet open source : jnilo1/hacking-lidl-silvercrest-gateway
 * https://github.com/jnilo1/hacking-lidl-silvercrest-gateway
 */
(function (global) {
  'use strict';

  function construire() {
    return [
      {
        id: 'z_materiel',
        titre: 'Réunir le matériel',
        duree: 'achats',
        outils: ['Passerelle Lidl Silvercrest (SGWZ 1 A1/A2 ou B2)', 'Adaptateur USB-série 3.3V TTL (ex. CP2102)', 'Fer à souder + fil fin', 'Câble Ethernet RJ45', 'PC sous Ubuntu (ou toute distro Linux)'],
        details: [
          'Passerelle Lidl Silvercrest Zigbee Gateway : SGWZ 1 A1/A2 (1ère génération, micro-USB) ou SGWZ 1 B2 (2ème génération, USB-C) — les deux sont compatibles avec le firmware du projet.',
          'Adaptateur USB-série 3.3V TTL obligatoire. Modèle utilisé dans cette procédure : ElectroWorldFR USB to Serial 6-en-1 (CP2102), TTL/RS485/RS232, avec sélecteur DIP à mettre sur TTL.',
          'Fer à souder et fil fin, pour souder GND/TX/RX sur les pastilles TP19/TP18/TP17 de la carte.',
          'Câble Ethernet (RJ45), à brancher entre la passerelle et la box/routeur dès la mise sous tension.',
          'Un PC sous Ubuntu (ou toute distribution Linux), connecté au même réseau.'
        ],
        images: [
          { src: 'img/zigbee/gateways.jpg', alt: 'Les deux passerelles compatibles : SGWZ 1 B2 (USB-C, à gauche) et SGWZ 1 A1/A2 (micro-USB, à droite)' },
          { src: 'img/zigbee/adaptateur.jpg', alt: 'Adaptateur USB vers série 6-en-1 (CP2102), sélecteur de mode à mettre sur TTL' }
        ],
        attention: 'Un adaptateur 5V ou le branchement du fil 3V3 peut endommager définitivement la carte.'
      },
      {
        id: 'z_soudure',
        titre: 'Souder le connecteur de flash',
        duree: '15 à 20 min',
        outils: ['Fer à souder', 'Fil fin', 'Bon éclairage (pastilles petites)'],
        details: [
          'Ouvrir le boîtier et repérer, au dos de la carte juste à côté du port RJ45, la rangée de pastilles sérigraphiées RX / TX / GND / 3V3 — référencées TP19 (RX), TP18 (TX), TP17 (GND), TP16 (3V3).',
          'Souder un fil uniquement sur TP17 (GND), TP18 (TX) et TP19 (RX).',
          'Câblage croisé vers l\'adaptateur : TP17 (GND) → USBGND, TP18 (TX) → RXD, TP19 (RX) → TXD. La broche 3V3 de l\'adaptateur reste non connectée.',
          'Paramètres console à retenir pour la suite : 38400 baud, 8N1, sans contrôle de flux.'
        ],
        images: [
          { src: 'img/zigbee/connecteur-macro.jpg', alt: 'Gros plan sur le connecteur de flash : RX / TX / GND / 3V3 sérigraphiés au-dessus des pastilles TP19/TP18/TP17/TP16' }
        ],
        attention: 'Ne jamais souder ni connecter TP16 (3V3) : la passerelle est déjà alimentée par son propre bloc secteur/USB, et brancher ce fil peut créer un conflit d\'alimentation ou griller la carte. Attention aussi au croisement TX ↔ RX, classique sur ce type de connexion série.'
      },
      {
        id: 'z_prep_ubuntu',
        titre: 'Préparer la machine Ubuntu',
        duree: '10 min',
        outils: ['Terminal'],
        details: [
          'Donner l\'accès au port série : sudo usermod -aG dialout $USER puis newgrp dialout — vérifier avec groups que dialout apparaît.',
          'Installer les paquets nécessaires : sudo apt install -y git screen tftp-hpa python3 python3-pip arp-scan mtd-utils.',
          'Installer aussi le venv Python, utilisé plus tard par le flash de la radio : sudo apt install python3-venv (ou python3.12-venv selon la version affichée par python3 --version).'
        ],
        astuce: 'Si newgrp dialout ne suffit pas et que le port reste inaccessible dans un nouveau terminal, se déconnecter puis se reconnecter à la session Ubuntu — le groupe est chargé au login.'
      },
      {
        id: 'z_projet',
        titre: 'Télécharger le projet',
        duree: '5 min',
        outils: ['git'],
        details: [
          'cd ~',
          'git clone https://github.com/jnilo1/hacking-lidl-silvercrest-gateway.git',
          'cd hacking-lidl-silvercrest-gateway',
          'Vérifier avec ls que flash_install_rtl8196e.sh et flash_efr32.sh sont bien présents dans le dossier.'
        ]
      },
      {
        id: 'z_detection',
        titre: 'Détecter l\'adaptateur USB-série',
        duree: '5 min',
        outils: ['Terminal'],
        details: [
          'Brancher l\'adaptateur USB-série sur le PC (sans encore le relier à la passerelle).',
          'sudo dmesg | tail -20 (sudo nécessaire : la lecture du tampon noyau est restreinte par défaut sur Ubuntu récent).',
          'ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null — noter le nom exact du port (ex. /dev/ttyUSB0), il sera réutilisé pour la console série.'
        ],
        astuce: 'Si rien n\'apparaît : débrancher/rebrancher l\'adaptateur et refaire la commande sudo dmesg.'
      },
      {
        id: 'z_bootloader',
        titre: 'Passer la passerelle en mode bootloader',
        duree: '5 à 10 min',
        outils: ['screen', 'Câble Ethernet', 'Câble d\'alimentation de la passerelle'],
        details: [
          'Ouvrir la console série : screen /dev/ttyUSB0 38400 (l\'écran devient noir/vide, c\'est normal).',
          'Brancher le câble Ethernet entre la passerelle et la box/routeur AVANT de mettre sous tension, puis brancher l\'alimentation.',
          'Dès la mise sous tension, marteler la touche ESC jusqu\'à voir apparaître « ---Escape booting by user » puis le prompt <RealTek> : le mode bootloader est actif.',
          'Quitter screen sans éteindre la passerelle : Ctrl+A puis K, puis confirmer avec y.'
        ],
        attention: 'La passerelle doit rester allumée et en mode bootloader. Bien quitter screen avant de lancer le script de flash, sinon le port série reste occupé (vérifier avec screen -ls, et au besoin screen -X -S <nom> quit). Si le démarrage continue sans s\'arrêter, débrancher l\'alimentation et recommencer en appuyant sur ESC plus tôt.'
      },
      {
        id: 'z_flash_linux',
        titre: 'Flasher le système Linux (RTL8196E)',
        duree: 'quelques minutes',
        outils: ['Terminal'],
        details: [
          'cd ~/hacking-lidl-silvercrest-gateway',
          './flash_install_rtl8196e.sh — le script construit une image de 16 Mio et l\'envoie par TFTP à la passerelle.',
          'Répondre aux questions du script (configuration réseau, mode radio Zigbee ou Thread).',
          'Ne rien débrancher pendant cette étape, même si cela semble figé : l\'opération peut prendre plusieurs minutes.'
        ],
        astuce: 'Sur un bootloader déjà en version custom (V2.x), le script détecte souvent la passerelle automatiquement via ICMP et flashe sans intervention manuelle. Si le message confirme un reboot et un accès SSH revenu en ~2 minutes, l\'étape suivante (cas Tuya) ne concerne pas cette passerelle : passer directement au flash de la radio EFR32.'
      },
      {
        id: 'z_tuya',
        titre: 'Cas particulier : bootloader Tuya d\'origine',
        duree: '5 min (si nécessaire)',
        outils: ['Console série (screen)'],
        details: [
          'Sur une passerelle encore sous bootloader Tuya d\'origine (pré-v2), celui-ci ne répond pas à ICMP : le script affiche « Bootloader does not answer ICMP (Tuya / pre-v2) - manual flash required » et demande un flash manuel.',
          'Basculer sur la fenêtre de la console série (screen /dev/ttyUSB0 38400), toujours sur le prompt <RealTek>.',
          'Taper à la main, caractère par caractère (pas de copier-coller) : FLW 0 80500000 01000000, puis répondre Y à la confirmation.',
          'Attendre environ 2 minutes sans rien débrancher — une série de points (....) s\'affiche, c\'est la progression normale.',
          'Une fois le prompt <RealTek> revenu, revenir dans le terminal du script et répondre y à « Has the flash completed ».'
        ],
        attention: 'Si le bootloader répond « Unknown command » : vérifier que la commande est tapée à la main (pas collée), tester avec ? pour lister les commandes disponibles. Un texte illisible/tronqué fait suspecter une soudure GND mal faite ou un adaptateur USB-série de mauvaise qualité (clones CH340 notamment) — test possible : stty -F /dev/ttyUSB0 38400 cs8 -cstopb -parenb -ixon -ixoff -crtscts raw.'
      },
      {
        id: 'z_efr32',
        titre: 'Flasher la radio Zigbee/Thread (EFR32)',
        duree: '5 à 10 min',
        outils: ['SSH (plus besoin du câble série)'],
        details: [
          'Trouver l\'IP de la passerelle : ping 192.168.1.88 (valeur par défaut) ou sudo arp-scan --localnet.',
          'Syntaxe : ./flash_efr32.sh [-y] [-g <IP>] <firmware> [<baud>] — firmware au choix : ncp (Zigbee2MQTT/ZHA classique), rcp (bas niveau), otrcp (Thread), router (extension de réseau mesh), bootloader (dépannage).',
          'Cas le plus courant pour Home Assistant : ./flash_efr32.sh -y -g <IP> ncp (ou ./flash_efr32.sh -y ncp si l\'IP est restée à 192.168.1.88).',
          'Le script se connecte en SSH (parfois deux fois) avec le mot de passe root par défaut : root. Rien ne s\'affiche en le tapant, c\'est normal.',
          'Déroulement attendu : détection du pont, passage en mode flash, « Flashing... », puis « Flash complete » et reboot de la passerelle.'
        ],
        attention: 'Piège fréquent : l\'IP n\'est pas un argument positionnel libre. ./flash_efr32.sh -y ncp 192.168.1.88 provoque l\'erreur « BAUD must be a positive integer » — il faut le flag -g. Le message « Failed to read firmware metadata: KeyError(...) » pendant le flash n\'est lui pas bloquant. Si une erreur venv/ensurepip apparaît au premier lancement : sudo apt install python3-venv, puis supprimer le dossier silabs-flasher du dépôt et relancer.'
      },
      {
        id: 'z_verif',
        titre: 'Vérification finale et sécurisation',
        duree: '5 min',
        outils: ['ssh'],
        details: [
          'Confirmer l\'accès : ssh root@<IP_DE_LA_PASSERELLE>.',
          'Changer le mot de passe par défaut maintenant que le flash est validé : passwd.',
          'Sauvegarder la configuration complète : ./backup_gateway.sh <IP_DE_LA_PASSERELLE> — utile pour restaurer rapidement en cas de souci futur.'
        ]
      },
      {
        id: 'z_ha',
        titre: 'Connecter à Home Assistant',
        duree: '10 min',
        outils: [],
        details: [
          'Avec Zigbee2MQTT : dans configuration.yaml, serial.port = tcp://<IP_DE_LA_PASSERELLE>:8888, adapter = ember, puis redémarrer Zigbee2MQTT.',
          'Avec ZHA : Paramètres → Appareils et services → Ajouter une intégration → ZHA, configuration manuelle, port socket = socket://<IP_DE_LA_PASSERELLE>:8888.',
          'Pour un usage Thread/Matter (firmware otrcp) : ajouter d\'abord l\'add-on Open Thread Border Router (http://<IP_PASSERELLE>:8081), puis Thread (auto-détecté), puis Matter.'
        ],
        astuce: 'Si l\'appairage Matter échoue via l\'app Home Assistant Companion : Paramètres → Application Companion → Dépannage → Synchroniser les identifiants Thread.'
      },
      {
        id: 'z_ip',
        titre: 'Changer l\'adresse IP (si besoin)',
        duree: '5 min',
        outils: ['ssh', 'vi'],
        details: [
          'Méthode rapide, sans reflash : ssh root@<IP_ACTUELLE>, puis vi /userdata/etc/eth0.conf pour modifier IP/masque/passerelle, sauvegarder (Échap puis :wq) et reboot.',
          'Méthode complète, avec mise à jour du firmware : ./flash_install_rtl8196e.sh <IP_ACTUELLE> — le script sauvegarde la config existante, repropose IP statique ou DHCP, puis reflashe.',
          'Choisir la méthode rapide pour juste changer l\'IP ou garder l\'adresse MAC d\'origine ; la méthode complète seulement si une mise à jour du firmware est aussi voulue.'
        ],
        attention: 'Un flash complet via la méthode 2 génère une nouvelle adresse MAC aléatoire à chaque fois. Si des réservations DHCP ou du filtrage MAC sont en place sur la box, noter l\'adresse MAC d\'origine avant de flasher.'
      }
    ];
  }

  global.FlashSteps = { construire: construire };
})(window);
