# Synchronisation automatique TemplateBooth

## Route cron

- Endpoint: `POST /api/cron/templatebooth-sync` (ou `GET`)
- Authentification:
  - priorite: header `Authorization: Bearer <CRON_SECRET>`
  - fallback: query param `?secret=<CRON_SECRET>`
- Si `CRON_SECRET` est absent ou invalide, la route refuse l'appel.

## Variable d'environnement

Ajouter dans les secrets serveur:

```env
CRON_SECRET=un-secret-long-et-aleatoire
```

Ne jamais exposer cette variable cote client.

## Comportement de la synchro

La route cron:

1. force une synchro TemplateBooth
2. met a jour `data/templatebooth-cache.json`
3. detecte les nouvelles familles/templates
4. ajoute les nouvelles familles en `to_review` dans `data/template-category-overrides.json`
5. n'ecrase jamais les categories deja validees manuellement
6. ecrit un log d'execution dans `data/templatebooth-sync-history.json` (20 dernieres executions)

## Planification Vercel

Fichier de config:

```json
{
  "crons": [
    {
      "path": "/api/cron/templatebooth-sync",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Note importante:

- Les crons Vercel sont en UTC.
- `0 1 * * *` correspond a 03:00 en France quand Paris est en CEST (ete).
- En CET (hiver), 03:00 France correspond a `0 2 * * *`.

Si vous voulez strictement 03:00 Europe/Paris toute l'annee, utilisez un scheduler timezone-aware (cron serveur Linux avec `TZ=Europe/Paris`, ou un scheduler externe) qui appelle la meme route.

## Alternatives hors Vercel

### Cron Linux

```bash
0 3 * * * curl -X POST "https://votre-domaine/api/cron/templatebooth-sync" -H "Authorization: Bearer $CRON_SECRET"
```

### Planificateur de taches Windows

- Declencheur: quotidien 03:00
- Action:
  - Programme: `powershell.exe`
  - Arguments:
    ```powershell
    Invoke-RestMethod -Method Post -Uri "https://votre-domaine/api/cron/templatebooth-sync" -Headers @{ Authorization = "Bearer VOTRE_CRON_SECRET" }
    ```

