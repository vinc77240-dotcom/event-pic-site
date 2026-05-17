# TemplateBooth Canva Harvester (local)

Outil local pour :
- ouvrir un navigateur visible,
- vous laisser vous connecter manuellement a TemplateBooth,
- parcourir des pages template,
- detecter des liens Canva "Edit in Canva",
- importer automatiquement les liens vers Event Pic local.

## Securite

- Aucun mot de passe n'est demande par le script.
- Les cookies ne sont jamais exportes.
- Aucune cle API n'est ecrite dans les logs.
- Le script ne contourne pas les pages membres ni les protections.
- Les requetes sont sequentielles avec pauses.

## Installation

```powershell
cd tools/templatebooth-canva-harvester
npm.cmd install
```

## Configuration

1. Copiez `.env.example` vers `.env`.
2. Choisissez le mode:
   - `HARVEST_MODE=file`: lit `input-templatebooth-urls.txt`
   - `HARVEST_MODE=eventpic`: lit `/api/admin/templates/export-templatebooth-urls`
3. Ajustez `HARVEST_DELAY_MS` (minimum recommande: 2000+ ms).

## Utilisation

```powershell
cd tools/templatebooth-canva-harvester
npm.cmd run login
npm.cmd run harvest
```

## Connexion manuelle persistante

```powershell
cd tools/templatebooth-canva-harvester
npm.cmd run login
```

Cette commande :
- ouvre Chromium en mode visible,
- charge `https://templatesbooth.com/my-account/`,
- attend votre validation terminal,
- conserve la session dans :
  - `tools/templatebooth-canva-harvester/.browser-profile`

Ensuite :

```powershell
cd tools/templatebooth-canva-harvester
npm.cmd run harvest
```

Au lancement :
1. Chromium s'ouvre en mode visible avec profil local:
   - `tools/templatebooth-canva-harvester/.browser-profile`
2. Si la session n'est pas connectee, le harvester retourne :
   - `Connexion TemplateBooth requise. Lancez npm.cmd run login.`
3. Relancez ensuite `npm.cmd run harvest`.

Le script enregistre un rapport JSON dans `tools/templatebooth-canva-harvester/output/`.

## Import Event Pic

Si `AUTO_IMPORT=true`, le script envoie les liens trouves vers:

- `POST /api/admin/template-source-links/canva-import`

Les associations peu fiables sont rangees dans:

- `data/canva-import-pending.json`

Vous pouvez les traiter depuis `/admin/demandes`, section **Imports Canva en attente**.

## Script racine (optionnel)

Depuis la racine du projet:

```powershell
npm.cmd run harvest:canva
```
