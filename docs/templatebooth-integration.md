# Integration TemplateBooth / Canva Event Pic

Cette integration Next.js permet au client Event Pic de choisir un template, de le personnaliser dans Canva quand un lien public est disponible, puis de coller son lien Canva final pour validation admin.

## Structure

- `app/choisir-template/page.tsx` : parcours client "Choisir mon template".
- `app/admin/demandes/page.tsx` : tableau admin Event Pic et diagnostic API.
- `app/api/templatebooth/*` : routes serveur, sans exposition de cle API.
- `src/server/templatebooth/templateboothService.ts` : service backend dedie avec `X-API-Key`.
- `data/canva-template-links.json` : mapping local entre templates TemplateBooth et liens Canva publics.
- `data/templatebooth-templates.json` : catalogue local de fallback si l'API echoue.
- `data/customization-requests.json` : stockage local des demandes client pour cette version.

## Cle API

Dans `.env.local`, renseigne :

```env
TEMPLATEBOOTH_API_KEY=ta_cle_api_templatebooth
TEMPLATEBOOTH_BASE_URL=https://templatesbooth.com/wp-json/tb/v1
NEXT_PUBLIC_TEMPLATEBOOTH_WIDGET_URL=https://url-publique-du-widget-templatebooth
```

La cle n'est jamais utilisee dans le front. Elle est lue uniquement cote serveur dans `templateboothService.ts`, puis envoyee a TemplateBooth avec :

```http
X-API-Key: process.env.TEMPLATEBOOTH_API_KEY
```

## Parcours client

- Client : `http://localhost:3000/choisir-template?reservation=demo-event-pic`
- Confirmation widget : `http://localhost:3000/template-confirmation`
- Confirmation : `http://localhost:3000/confirmation?request=ID_DEMANDE`
- Admin : `http://localhost:3000/admin/demandes`

Le parcours client principal utilise le widget TemplateBooth integre en iframe. La page ajoute `redirect_url=/template-confirmation` a l'URL du widget quand l'URL est valide et que ce parametre n'est pas deja present.

Les cles privees restent hors du front : ne mets jamais `TEMPLATEBOOTH_API_KEY`, cle CheckCherry ou cle serveur dans `NEXT_PUBLIC_TEMPLATEBOOTH_WIDGET_URL`.

Les routes API TemplateBooth restent disponibles comme secours/admin. Les liens `post_url` sont conserves uniquement cote serveur/admin.

## Libelles et style du widget

Les libelles internes au widget, la langue, les champs visibles et le CSS du widget se reglent depuis le compte TemplateBooth quand ces options sont disponibles. Pour Event Pic, configure le widget en francais et utilise les libelles client suivants si TemplateBooth les permet :

- Prenom
- Nom
- Adresse email
- Telephone
- Date de l'evenement
- Texte principal a afficher
- Consignes particulieres
- Valider ma demande

La page Event Pic stylise l'en-tete, les explications, le rappel des formats et le cadre iframe. Les boutons internes au widget sont controles par TemplateBooth, sauf si un CSS personnalise est ajoute directement dans les options du widget TemplateBooth.

## Mapping Canva

Pour activer le bouton "Personnaliser dans Canva", ajoute un lien Canva public dans `data/canva-template-links.json`.

Structure :

```json
[
  {
    "template_id": "id-templatebooth-ou-slug",
    "name": "Nom du template",
    "format": "2x6",
    "layout": "26strip",
    "preview_url": "https://...",
    "post_url": "https://templatesbooth.com/premium/...",
    "canva_template_url": "https://www.canva.com/design/...",
    "event_type": "Mariage",
    "tags": ["chic", "dore", "premium"],
    "full_width": false
  }
]
```

Si `canva_template_url` est vide ou absent, le client peut choisir le template et envoyer une demande de personnalisation Event Pic, sans quitter le site vers TemplateBooth.

## Formats geres

- Bande verticale 2x6 : `layout=26strip`
- Portrait 10x15 / 4x6 : `layout=46postcard-p`
- Paysage 10x15 / 4x6 : `layout=46postcard-l`

Sur la page client avec widget, les boutons Event Pic rechargent l'iframe avec ces parametres publics. Les filtres internes TemplateBooth restent caches par recadrage de l'iframe. Comme le widget est externe, le filtrage final depend de la prise en charge de ces parametres par TemplateBooth.

Le filtre categorie Event Pic utilise les noms originaux TemplateBooth :

- `category=Wedding`
- `category=Birthday`
- `category=Religious`
- `category=Baby Shower`
- `category=Nightlife`
- `category=Corporate`
- `category=Christmas`
- `category=New Year's Eve`

Pour les themes absents de la liste de categories TemplateBooth, la page utilise une recherche :

- Gender reveal : `search=Gender Reveal`
- Fiancailles : `search=Engagement`

Les valeurs sont encodees avec `URLSearchParams`, et les filtres internes TemplateBooth restent invisibles dans l'iframe.

## Diagnostic

La route serveur `GET /api/templatebooth/test` retourne :

```json
{
  "ok": true,
  "status": 200,
  "total": 3248,
  "count": 48,
  "fallbackLocalUsed": false
}
```

La reponse ne contient jamais `TEMPLATEBOOTH_API_KEY`.

## Commandes

```bash
npm install
npm run dev
npm run typecheck
```

Dans ce workspace Codex, si `npm` n'est pas disponible dans PowerShell, le typecheck peut aussi etre lance avec le Node fourni :

```powershell
& 'C:\Users\vinc7\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\typescript\bin\tsc --noEmit
```
