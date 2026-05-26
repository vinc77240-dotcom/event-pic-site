# CODEX_RULES.md — Règles permanentes Event Pic

Ce fichier définit les règles permanentes à appliquer pour toutes les tâches Codex du projet Event Pic.

## 1. Mode de travail par défaut

Codex doit fonctionner en mode autonome.

- Ne pas demander de validation utilisateur pour chaque correction.
- Ne pas créer de PR sauf demande explicite.
- Ne pas attendre une validation visuelle utilisateur avant de finaliser.
- Vérifier son propre travail.
- Corriger si le rendu n’est pas bon.
- Puis passer à la tâche suivante de `CODEX_QUEUE.md`.
- Quand toutes les tâches possibles sont terminées, faire la mise à jour finale : build, commit, push GitHub, déploiement Vercel et vérification production.

## 2. File d’attente

Avant de commencer :

1. Lire `CODEX_QUEUE.md`.
2. Traiter les tâches de la section `À faire` dans l’ordre.
3. Déplacer la tâche active dans `En cours`.
4. Traiter une seule tâche à la fois.
5. Quand une tâche est terminée, la déplacer dans `Terminé`.
6. Si une tâche ne peut pas être faite, la déplacer dans `Bloqué` avec la raison exacte.
7. Après chaque tâche terminée ou bloquée, passer à la tâche suivante.
8. Ne pas traiter une tâche absente de `CODEX_QUEUE.md`, sauf si elle vient d’être explicitement demandée par l’utilisateur.

## 3. Règle d’interruption stricte

Quand une tâche est déjà en cours :

1. Ne jamais basculer automatiquement sur une nouvelle demande utilisateur.
2. Ajouter la nouvelle demande dans `CODEX_QUEUE.md` section `À faire`.
3. Terminer d’abord la tâche actuellement en `En cours`.
4. Ne changer immédiatement de tâche que si le message utilisateur contient explicitement :
   - `STOP tâche actuelle`
   - `PRIORITÉ :`
   - `Annule la tâche en cours`
5. Si une nouvelle tâche est ajoutée en file d’attente, le signaler dans le résumé.
6. Ne pas mélanger deux tâches dans le même commit sauf si elles sont clairement liées.
7. Publier GitHub/Vercel uniquement quand la tâche active est terminée ou quand tout le lot de tâches prévu est terminé.

## 4. Règle anti-boucle

Ne pas rester bloqué dans une boucle de diagnostic.

Si une vérification locale échoue pour une raison d’environnement, par exemple :
- problème PATH ;
- Vercel CLI non connecté ;
- serveur local impossible à lancer ;
- navigateur intégré non disponible ;

alors :
1. vérifier le build si possible ;
2. vérifier les fichiers modifiés ;
3. noter la limite dans le résumé ;
4. continuer le workflow au lieu de relancer les mêmes tests indéfiniment.

## 5. Workflow par tâche

Pour chaque tâche :

1. Comprendre précisément la demande.
2. Identifier les fichiers concernés.
3. Modifier uniquement ce qui est nécessaire.
4. Ne pas modifier les pages admin sauf demande explicite.
5. Ne pas modifier les routes API sauf demande explicite.
6. Ne pas modifier d’autres sections sans nécessité.
7. Vérifier visuellement la zone modifiée.
8. Corriger si le rendu n’est pas bon.
9. Lancer le build.
10. Si le build est OK, conserver la modification.
11. Mettre à jour `CODEX_QUEUE.md`.
12. Passer à la tâche suivante.

## 6. Publication finale

La publication se fait à la fin du lot de tâches, pas forcément après chaque micro-correction.

Quand toutes les tâches possibles sont terminées :

1. Lancer un build final.
2. Vérifier `git status`.
3. Commit toutes les modifications cohérentes.
4. Push sur GitHub.
5. Déclencher ou attendre le déploiement Vercel automatique.
6. Vérifier la production sur `https://www.eventpic.fr/`.
7. Confirmer que les modifications sont visibles en production.

Si le déploiement manuel Vercel CLI échoue à cause d’un token invalide :
- ne pas boucler ;
- s’assurer que le push GitHub est fait ;
- indiquer que le déploiement automatique Vercel est attendu ;
- vérifier ensuite la production.

## 7. Validation visuelle obligatoire par Codex

Pour toute modification visuelle, Codex doit vérifier lui-même :

- Desktop.
- Mobile 390px.
- Mobile 360px.
- Production sur `https://www.eventpic.fr/` après déploiement.

À confirmer dans le résumé :

- La zone demandée a bien changé.
- Les autres sections n’ont pas bougé.
- Aucun débordement horizontal.
- Les textes restent lisibles.
- Les images ne sont pas coupées de façon gênante.
- Les boutons restent visibles et cliquables.
- Le rendu est plus propre qu’avant.

Si le rendu visuel n’est pas clairement meilleur :
1. corriger immédiatement ;
2. re-vérifier ;
3. ne pas marquer la tâche comme terminée tant que le rendu n’est pas acceptable.

## 8. Images et assets

Avant d’utiliser une image :

- Vérifier que le fichier est la bonne image.
- Ne pas utiliser une capture du site à la place d’un visuel produit.
- Ne pas remplacer une image par une mauvaise image.
- Ne pas recadrer une mauvaise image.
- Si l’image est incorrecte, déplacer la tâche dans `Bloqué` avec la raison exacte et passer à la tâche suivante.

Pour les cartes mobile :
- Ne pas appliquer une règle globale qui dégrade toutes les images.
- Corriger au besoin carte par carte.
- Desktop et mobile peuvent avoir des règles différentes.

## 9. Mobile

Priorité mobile :

- Lisibilité.
- Images visibles.
- Pas de texte coupé.
- Pas de cartes trop longues inutilement.
- Pas de gros blocs qui alourdissent la page.
- Pas de débordement horizontal.
- Vérifier 390px et 360px.

## 10. Footer mobile

Pour le footer mobile :

- Garder un rendu compact, premium et lisible.
- Ne pas créer de gros encadré contact massif.
- Garder Instagram et WhatsApp discrets.
- Garder les liens lisibles.
- Vérifier que l’email ne se coupe pas.
- Si une structure ne fonctionne pas, refaire la structure plutôt que faire des micro-décalages.

## 11. Section Nos prestations

Pour la section `Nos prestations` :

- Les vraies prestations doivent rester claires.
- Ne pas présenter une option comme une animation si ce n’est pas cohérent.
- Sur mobile, privilégier un rendu lisible plutôt qu’une uniformité stricte.
- Ne pas laisser une image miniature dans un grand fond vide.
- Corriger les images carte par carte si nécessaire.

## 12. Règles de sécurité

Même en mode autonome, ne jamais :
- supprimer des données client ;
- supprimer des fichiers importants sans raison claire ;
- modifier des secrets ou variables d’environnement sans demande explicite ;
- casser les pages admin ;
- publier des identifiants, tokens ou informations privées ;
- supprimer les enregistrements Brevo ou DNS sans demande explicite.

Si une tâche nécessite un secret, un accès externe manquant, ou un asset absent :
- la déplacer dans `Bloqué` ;
- expliquer clairement ce qui manque ;
- passer à la tâche suivante.

## 13. Résumé final attendu

Toujours finir par un résumé clair avec :

- Tâches réalisées.
- Tâches bloquées et raisons.
- Fichiers modifiés.
- Build final OK ou erreur.
- Rendu desktop vérifié.
- Rendu mobile 390px vérifié.
- Rendu mobile 360px vérifié.
- Push GitHub effectué ou non.
- Déploiement Vercel terminé ou en attente.
- Production vérifiée sur `https://www.eventpic.fr/`.
- Statut final de `CODEX_QUEUE.md`.
