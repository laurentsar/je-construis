/*
 * steps_proxmox.js — la marche à suivre pour installer Proxmox VE sur un
 * Raspberry Pi 5 (portage ARM « Pimox »), puis y créer une VM Home
 * Assistant.
 *
 * Septième projet de l'app, extrait de l'article de domo-blog.fr
 * (Aurélien Brunet, 8 mai 2024) « Comment installer Proxmox sur
 * Raspberry Pi 5 avec Pimox » :
 * https://www.domo-blog.fr/comment-installer-proxmox-sur-raspberry-pi-5-avec-pimox/
 *
 * Les commandes sont celles de l'article, à l'identique ; seules les
 * adresses de l'exemple (10.0.0.38 pour le Pi, 10.0.0.1 pour la box) sont
 * à adapter à son réseau. Champ « code » : commandes affichées telles
 * quelles dans un bloc à part, pour pouvoir les recopier.
 */
(function (global) {
  'use strict';

  function construire() {
    return [
      {
        id: 'px_materiel',
        titre: 'Réunir le matériel',
        duree: 'achats — ~200 à 300 €',
        outils: ['Raspberry Pi 5 (4 ou 8 Go)', 'Ventilateur actif', 'Câble Ethernet', 'Carte microSD ou SSD NVMe'],
        details: [
          'Raspberry Pi 5 4 Go : suffisant pour une seule VM. Pour en faire tourner plusieurs, l\'article recommande le modèle 8 Go — Proxmox occupe à lui seul un peu plus de 1 Go de RAM.',
          'Ventilateur actif officiel (~10 €) ou boîtier aluminium avec ventilateur PWM (~24 €) : la virtualisation fait chauffer le processeur.',
          'En option, un shield NVMe M.2 Key-M (Geekworm X1001, ~16 €) et un SSD NVMe (256 à 500 Go) : bien plus rapide et durable qu\'une carte microSD pour héberger des VM.',
          'Un câble Ethernet : le Pi sera relié en filaire à la box.'
        ],
        attention: 'Le Wi-Fi est déconseillé pour un serveur de virtualisation : le pont réseau des VM (étape « Créer le pont réseau ») s\'appuie sur la prise Ethernet eth0.'
      },
      {
        id: 'px_os',
        titre: 'Installer Raspberry Pi OS Lite',
        duree: '15 min',
        outils: ['Raspberry Pi Imager', 'Un PC'],
        details: [
          'Avec Raspberry Pi Imager, écris Raspberry Pi OS Lite 64 bits, version Bookworm (Debian 12), sur la carte ou le SSD.',
          'Version Lite : l\'interface graphique ne sert à rien sur un serveur et consommerait des ressources.',
          'Dans les réglages d\'Imager, active SSH, renseigne le Wi-Fi (pour le premier accès) et définis un mot de passe.',
          'Démarre le Pi, connecte-toi en SSH, puis mets le système à jour.'
        ],
        code: 'sudo apt-get update\nsudo apt-get upgrade',
        astuce: 'Pour démarrer directement sur le SSD NVMe, domo-blog.fr a un tutoriel séparé : « Comment configurer le boot PCIe NVMe sur Raspberry Pi 5 ».'
      },
      {
        id: 'px_ip',
        titre: 'Fixer l\'adresse IP',
        duree: '5 min',
        outils: ['SSH'],
        details: [
          'Ouvre le fichier de configuration réseau : nano /etc/dhcpcd.conf',
          'Ajoute les lignes ci-dessous en remplaçant 10.0.0.1 par l\'adresse de ta box (routeur et DNS) et 10.0.0.38 par l\'adresse choisie pour le Pi.'
        ],
        code: 'interface eth0\nstatic_routers=10.0.0.1\nstatic domain_name_servers=10.0.0.1\nstatic ip_address=10.0.0.38/24',
        attention: 'Choisis une adresse hors de la plage DHCP de la box (ou réserve-la dans la box) pour éviter un conflit avec un autre appareil. L\'adresse définitive sera de toute façon reprise dans le pont réseau vmbr0.'
      },
      {
        id: 'px_nom',
        titre: 'Nommer la machine et définir le mot de passe root',
        duree: '5 min',
        outils: ['SSH'],
        details: [
          'nano /etc/hosts : remplace le contenu par le bloc ci-dessous ; seule l\'adresse IP de la 2e ligne est à adapter.',
          'nano /etc/hostname : écris simplement proxmox.',
          'Définis un mot de passe root avec sudo passwd root — c\'est lui qui servira à se connecter à l\'interface web de Proxmox.',
          'Redémarre avec sudo reboot.'
        ],
        code: '127.0.0.1 localhost proxmox\n10.0.0.38 proxmox\n::1             localhost ip6-localhost ip6-loopback\nff02::1         ip6-allnodes\nff02::2         ip6-allrouters'
      },
      {
        id: 'px_depot',
        titre: 'Ajouter le dépôt Proxmox pour ARM',
        duree: '10 min',
        outils: ['SSH'],
        details: [
          'Proxmox ne publie pas officiellement de version ARM : on passe par le portage communautaire, distribué par un miroir tiers (apqa.cn).',
          'La clé GPG téléchargée sert à vérifier l\'authenticité des paquets du dépôt.'
        ],
        code: 'sudo apt install curl\nsudo -s\ncurl https://mirrors.apqa.cn/proxmox/debian/pveport.gpg -o /etc/apt/trusted.gpg.d/pveport.gpg\necho "deb [arch=arm64] https://global.mirrors.apqa.cn/proxmox/debian/pve bookworm port">/etc/apt/sources.list.d/pveport.list\nsudo apt update\nsudo apt -y upgrade'
      },
      {
        id: 'px_install',
        titre: 'Installer Proxmox VE',
        duree: '20 à 40 min',
        outils: ['SSH'],
        details: [
          'ifupdown2 d\'abord : c\'est lui qui gère le réseau interne de Proxmox (le pont des VM).',
          'Puis Proxmox VE et ses compagnons.',
          'Postfix pose quelques questions pendant l\'installation, dont une adresse e-mail (notifications du serveur).'
        ],
        code: 'sudo apt-get install ifupdown2\napt-get install proxmox-ve postfix open-iscsi chrony mmc-utils usbutils'
      },
      {
        id: 'px_pont',
        titre: 'Créer le pont réseau vmbr0',
        duree: '10 min',
        outils: ['SSH', 'Câble Ethernet branché'],
        details: [
          'sudo nano /etc/network/interfaces, puis écris la configuration ci-dessous (adresses à adapter comme à l\'étape « Fixer l\'adresse IP »).',
          'Le pont vmbr0 porte l\'adresse IP du Pi et relie la prise eth0 au réseau interne des VM : chaque VM obtient ainsi sa propre adresse sur le réseau de la maison.',
          'Redémarre avec sudo reboot.'
        ],
        code: 'auto lo\niface lo inet loopback\n\niface eth0 inet manual\n\nauto vmbr0\niface vmbr0 inet static\naddress 10.0.0.38/24\ngateway 10.0.0.1\nbridge-ports eth0\nbridge-stp off\nbridge-fd 0\n\niface eth0 inet manual',
        attention: 'Ne fais pas ce pont sur le Wi-Fi : un lecteur de l\'article a perdu tout accès réseau au Pi en l\'adaptant à wlan0. Garde le câble Ethernet branché avant de redémarrer, sinon le Pi devient injoignable (il faudra un écran et un clavier pour corriger).'
      },
      {
        id: 'px_web',
        titre: 'Se connecter à l\'interface web',
        duree: '2 min',
        outils: ['Navigateur'],
        details: [
          'Ouvre https://10.0.0.38:8006 (avec l\'adresse IP de ton Pi).',
          'Le navigateur affiche une alerte de certificat : c\'est normal, le certificat est auto-signé — clique sur « continuer vers le site ».',
          'Connecte-toi avec l\'utilisateur root et le mot de passe défini plus tôt.'
        ]
      },
      {
        id: 'px_haos',
        titre: 'Créer la VM Home Assistant',
        duree: '15 à 30 min',
        outils: ['Shell Proxmox (interface web)'],
        details: [
          'Dans l\'interface web, ouvre le Shell du nœud proxmox et lance le script ci-dessous : il télécharge Home Assistant OS et crée la VM tout seul.',
          'Pi 5 8 Go : garde les options par défaut.',
          'Pi 5 4 Go : choisis l\'installation « advanced », laisse tout par défaut sauf la mémoire allouée, à mettre à 2048 Mo.',
          'La VM démarre automatiquement : relève son adresse IP dans sa console, puis ouvre-la dans le navigateur pour l\'assistant de démarrage de Home Assistant.'
        ],
        code: 'bash -c "$(wget -qLO - https://github.com/tteck/Proxmox/raw/main/vm/pimox-haos-vm.sh)"',
        astuce: 'Le premier démarrage de Home Assistant fait grimper le processeur : c\'est l\'initialisation, ça redescend ensuite.'
      }
    ];
  }

  global.ProxmoxSteps = { construire: construire };
})(window);
