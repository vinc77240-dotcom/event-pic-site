# Extension Chrome locale — Extraction Canva TemplateBooth

Cette extension permet d’extraire les liens Canva depuis **TemplateBooth** en utilisant **votre session Chrome deja connectee**, puis d’importer les liens dans Event Pic local.

## Securite

- Ne lit pas les mots de passe.
- N’exporte pas les cookies.
- Ne lit pas localStorage/sessionStorage pour les envoyer ailleurs.
- N’effectue pas de scraping distant serveur.
- Fonctionne uniquement depuis votre navigateur local.

## Installation (Chrome)

1. Ouvrir `chrome://extensions`
2. Activer **Mode developpeur**
3. Cliquer **Charger l’extension non empaquetee**
4. Selectionner le dossier :

`tools/canva-link-extractor-extension`

## Utilisation

1. Ouvrir TemplateBooth dans Chrome (session connectee).
2. Ouvrir une page template.
3. Cliquer l’extension **Event Pic - Extracteur Canva**.
4. Cliquer **Extraire et importer**.
5. Les liens sont envoyes vers :

`http://localhost:3000/api/admin/template-source-links/canva-import`

## Resultat attendu

- Liens Canva importes automatiquement quand l’association est fiable.
- Liens incertains places dans `data/canva-import-pending.json`.
- Disponibles ensuite dans `/admin/demandes` (section imports Canva en attente).

## Pre-requis

- Event Pic local demarre sur `http://localhost:3000`.
- Acces admin Event Pic pour verifier/importer les resultats.
