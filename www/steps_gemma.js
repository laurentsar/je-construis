/*
 * steps_gemma.js — la marche à suivre pour monter le Traducteur Gemma.
 *
 * Ce projet n'est pas un ouvrage bois : c'est un petit appareil à assembler et
 * à configurer (gemma-translator, Google Creative Lab). On garde exactement le
 * même principe que le carport — des étapes cochables, avec outils, durée,
 * points d'attention et astuces — mais le contenu est fixe : il ne dépend
 * d'aucune cote, seulement des scripts et du matériel officiels du projet.
 *
 * Source : https://github.com/google-gemma/gemma-translator (Apache 2.0).
 * L'appli traduit la voix HORS LIGNE grâce à Gemma + LiteRT-LM, une fois le
 * modèle téléchargé. C'est un traducteur à deux personnes, pensé pour un petit
 * écran (type 480 × 320) posé entre les deux interlocuteurs.
 */
(function (global) {
  'use strict';

  function construire() {
    return [
      {
        id: 'g_materiel',
        titre: 'Réunir le matériel',
        duree: '30 min de commande',
        outils: ['Raspberry Pi 5 8 Go', 'Alimentation officielle 27 W', 'Carte microSD 32 Go (ou SSD NVMe + HAT)'],
        details: [
          'Carte : Raspberry Pi 5 avec 8 Go de RAM — c\'est ce que le modèle Gemma exige.',
          'Entrée son : un microphone USB, ou une interface de capture audio USB.',
          'Sortie son : un petit haut-parleur, ou une sortie casque.',
          'Écran : un afficheur, idéalement tactile, type kiosque 480 × 320.',
          'Refroidissement : dissipateur ou ventilateur officiel — le Pi 5 chauffe quand le modèle tourne.'
        ],
        attention: 'Un Pi 5 en 4 Go ne suffit pas : le modèle gemma4-e2b a besoin des 8 Go. Vérifie bien la référence avant de commander.'
      },
      {
        id: 'g_boitier',
        titre: 'Imprimer le boîtier',
        duree: 'quelques heures d\'impression',
        outils: ['Imprimante 3D FDM', 'Bobine PLA ou PETG', 'Visserie M2.5'],
        details: [
          'Les fichiers du boîtier sont dans le dossier stl/ du dépôt gemma-translator.',
          'Une impression PLA standard convient en intérieur ; passe au PETG si l\'appareil reste exposé à la chaleur ou au soleil.',
          'Prévois les vis et entretoises pour fixer la carte et l\'écran dans le boîtier.'
        ],
        astuce: 'Imprime d\'abord la coque, présente la carte et l\'écran à blanc, et vérifie les découpes (USB, alimentation, micro) avant de lancer les pièces plus longues.'
      },
      {
        id: 'g_assemblage',
        titre: 'Assembler l\'appareil',
        duree: '1 h',
        outils: ['Tournevis de précision', 'Éventuellement un fer à souder'],
        details: [
          'Fixe le Raspberry Pi 5 dans le boîtier imprimé, avec son dissipateur ou son ventilateur.',
          'Branche l\'écran (nappe DSI ou câble HDMI selon le modèle), le micro USB et le haut-parleur.',
          'Referme le boîtier une fois que tout est en place et que rien ne force sur une nappe.'
        ],
        attention: 'Branche et débranche toujours les nappes et l\'écran Pi HORS TENSION : une nappe connectée sous tension peut griller le port.'
      },
      {
        id: 'g_os',
        titre: 'Installer le système',
        duree: '30 min + gravure de la carte',
        outils: ['Raspberry Pi Imager', 'Un PC + lecteur de carte'],
        details: [
          'Installe Raspberry Pi OS 64 bits sur la microSD (ou le SSD) avec Raspberry Pi Imager.',
          'Dans les réglages de l\'Imager, active SSH et renseigne le Wi-Fi : ça évite d\'avoir à brancher clavier et souris.',
          'Le projet demande Python 3.10+ et Node.js 18+ (20 LTS conseillé) — le script deploy-pi.sh les installe pour toi sur Raspberry Pi OS / Debian.'
        ],
        astuce: 'Au premier démarrage, fais les mises à jour du système (sudo apt update && sudo apt full-upgrade) avant d\'installer le projet.'
      },
      {
        id: 'g_recuperer',
        titre: 'Récupérer le projet',
        duree: '10 min',
        outils: ['Terminal (SSH ou local)', 'git'],
        details: [
          'Récupère le dépôt : git clone https://github.com/google-gemma/gemma-translator',
          'Entre dans le dossier, puis rends les scripts exécutables :',
          'chmod +x setup.sh download_model.sh start.sh deploy-pi.sh'
        ]
      },
      {
        id: 'g_setup',
        titre: 'Installer les dépendances',
        duree: '15 à 30 min',
        outils: ['Terminal', 'Connexion internet'],
        details: [
          'Lance ./setup.sh : le script crée un environnement Python isolé (venv) et installe tous les paquets nécessaires.',
          'Laisse-le aller jusqu\'au message « Setup complete ! ».'
        ],
        attention: 'Cette étape a besoin d\'internet. C\'est normal : une fois le modèle téléchargé (étape suivante), l\'appareil fonctionnera ensuite entièrement hors ligne.'
      },
      {
        id: 'g_modele',
        titre: 'Télécharger le modèle Gemma',
        duree: '20 min à 1 h selon le débit',
        outils: ['Terminal', 'Compte Hugging Face'],
        details: [
          'Lance ./download_model.sh : il récupère le modèle gemma4-e2b depuis Hugging Face et l\'importe dans LiteRT-LM.',
          'Il faut un compte Hugging Face et avoir accepté la licence d\'utilisation de Gemma sur leur site.',
          'C\'est un gros téléchargement, à faire une seule fois.'
        ],
        attention: 'C\'est la seule étape qui demande une vraie connexion. Après ça, plus aucune donnée ne sort de l\'appareil : la traduction se fait sur place.'
      },
      {
        id: 'g_lancer',
        titre: 'Lancer le traducteur',
        duree: '5 min',
        outils: ['Terminal', 'Micro + haut-parleur branchés'],
        details: [
          'Mode test : ./start.sh — l\'interface s\'ouvre sur http://localhost:5173.',
          'Mode réel : ./start.sh --prod — l\'interface compilée est servie sur http://localhost:3000.',
          'Le script démarre les trois services (LiteRT-LM sur 9379, le serveur Python, et l\'interface web).',
          'Fais un essai de voix pour vérifier que le micro capte et que le haut-parleur restitue bien la traduction.'
        ],
        astuce: 'Le premier lancement compile les dépendances web (npm) : c\'est plus long. Les fois suivantes, le démarrage est rapide.'
      },
      {
        id: 'g_kiosk',
        titre: 'Installer en mode kiosque (optionnel)',
        duree: '20 min',
        outils: ['Terminal'],
        details: [
          'Pour que l\'appareil démarre tout seul sur le traducteur : ./deploy-pi.sh',
          'Le script installe les paquets audio, construit l\'interface, télécharge le modèle, enregistre un service systemd et lance Chromium en plein écran sur http://localhost:3000 au démarrage.',
          'À partir de là, il suffit de brancher l\'appareil : il ouvre le traducteur sans clavier.'
        ]
      },
      {
        id: 'g_utiliser',
        titre: 'Se servir du traducteur',
        duree: 'prise en main immédiate',
        outils: ['Le clavier de l\'appareil'],
        details: [
          'Deux « voies » se font face : une par personne, chacune avec sa langue.',
          'Maintiens la touche Z pour parler (appuyer-parler), relâche pour lancer la traduction, qui est ensuite dite dans la langue de l\'autre.',
          'Flèches ← et → : changer la langue de la personne active.',
          'Barre Espace : passer d\'une personne à l\'autre (mode paysage, par défaut).',
          'Réglages ⚙ : choisir le mode clavier (paysage à un opérateur, ou vertical à deux mains).'
        ],
        astuce: 'La rotation de langue est bloquée pendant l\'enregistrement, et les raccourcis sont ignorés quand on est dans un champ de réglage : c\'est voulu, pour ne pas déclencher une action par erreur.'
      }
    ];
  }

  global.GemmaSteps = { construire: construire };
})(window);
