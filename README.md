# 🏗️ Je Construis

Application Android (et PWA) pour **construire soi-même un carport bois** : on
donne ses cotes, l'app sort les sections, la **liste des matériaux**, le **débit
de coupe**, les **plans cotés** et la **marche à suivre** du chantier.

Tout est calculé sur le téléphone : **aucun compte, aucun réseau, aucune donnée
envoyée**. L'app fonctionne entièrement hors ligne, y compris au fond d'un
terrain sans 4G.

## Ce que l'app fait

| Onglet | Contenu |
|---|---|
| 📐 **Projet** | Longueur, largeur, les deux hauteurs (monopente), section des poteaux, entraxe des chevrons, débords, couverture, pied de poteau, essence, zone de neige, dimensions des plots. |
| 📋 **Matériaux** | La liste complète — bois, quincaillerie, couverture, béton — avec quantités, sections et longueurs, plus une estimation de budget à prix éditables. |
| ✂️ **Débit** | Comment sortir toutes les pièces des barres du commerce (3, 4, 5, 6 m), trait de scie compris, avec le dessin de chaque barre et la chute. |
| 📏 **Plans** | Perspective, vue de face, vue de côté et vue de dessus, **cotées et redessinées à chaque changement de dimension**. |
| 🔨 **Étapes** | 12 à 15 étapes du chantier (les options solaire et électricité en ajoutent trois) : démarches, implantation, fouilles, plots, poteaux, pannes, contreventement, chevrons, couverture, finitions, entretien — avec outils, durées, pièges et cases à cocher. |
| ☀️ **Solaire** *(carte de l'onglet Projet)* | Combien de panneaux tiennent sur la toiture, en quelle disposition, pour quelle puissance crête, quelle production annuelle et quelle économie — inclinaison et orientation réelles comprises. |
| 🔌 **Électricité** *(carte de l'onglet Projet)* | Prises étanches, éclairage LED et **borne de recharge** : l'app calcule la **section de câble** qui tient à la fois le courant et la chute de tension sur la distance jusqu'au tableau, la profondeur de tranchée et les protections. |
| ℹ️ **Infos** | Mes projets enregistrés, sauvegarde vers Home Assistant, limites du calcul. |

## Ce que l'app calcule vraiment

- **Sections conseillées** de pannes et de chevrons selon la portée réelle, avec
  un cran de sécurité en plus en zone de neige. Hors des portées courantes, elle
  le dit au lieu d'extrapoler.
- **Pente** en %, en degrés et longueur de rampant — et surtout **l'alerte
  quand la pente est trop faible pour la couverture choisie** (7 % pour du bac
  acier, 30 % pour des tuiles). C'est l'erreur la plus fréquente sur les projets
  de carport trouvés en ligne.
- **Débit de coupe** par rangement première-décroissante : nombre de barres,
  coupes par barre, chutes.
- **Béton des plots** en m³ et en sacs de 35 kg.
- **Volume et masse de bois** (utile pour la livraison).
- **Emprise au sol**, avec le rappel déclaration préalable / permis de construire
  au seuil de 20 m².
- **Photovoltaïque** : nombre de panneaux réellement posables (les deux
  orientations sont testées, marges de rive comprises), puissance crête,
  production corrigée de l'inclinaison du toit et de l'orientation, économie
  annuelle, et **charge ajoutée** — qui fait automatiquement monter d'un cran
  les sections de bois.
- **Sections de câble** par le calcul : courant admissible **et** chute de
  tension (5 % maxi, 3 % pour l'éclairage, comme la NF C 15-100), pour des
  prises, des LED ou une borne de 3,7 à 22 kW.

## Ce que l'app n'est pas

Ce n'est **pas une note de calcul**. Les tables de sections viennent de la
pratique courante de la charpente (couverture légère, portées usuelles). Pour un
ouvrage accolé à la maison, une portée hors tables, un site très exposé au vent
ou un doute sur le sol : faire valider par un charpentier ou un bureau d'études
(Eurocode 5, DTU 31.1). Les prix sont des ordres de grandeur, pas des devis.

## Installation

- **APK** : chaque push sur `main` publie une Release GitHub signée. L'app
  vérifie elle-même s'il en existe une plus récente et propose le
  téléchargement.
- **PWA** : servir le dossier `www/` en HTTPS, puis « Ajouter à l'écran
  d'accueil ».

## Développement

```bash
npm install
npx cap sync android      # nécessite d'abord npx cap add android
python3 tools_gen_icon.py # régénère les icônes (aucune dépendance)
```

`android/` n'est pas versionné : le workflow le régénère à chaque build, puis
applique la signature (`ci/patch_signing.py`), la version (`ci/set_version.py`),
les icônes (`ci/set_icons.py`) et l'autorisation HTTP local pour la sauvegarde
Home Assistant (`ci/patch_manifest.py`).

La clé de signature vit **uniquement** dans `~/app-kit/keys/` et dans les
secrets GitHub `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD`.

## Structure

```
www/
  index.html     6 onglets
  calc.js        moteur : sections, matériaux, débit, béton, devis
  plans.js       les 4 vues en SVG, cotées, générées depuis les paramètres
  steps.js       la marche à suivre, adaptée aux choix (pied de poteau, couverture)
  app.js         interface, persistance, projets enregistrés
  autobackup.js  sauvegarde vers Home Assistant (partagé entre mes apps)
  update-check.js bannière de mise à jour (partagé)
```
