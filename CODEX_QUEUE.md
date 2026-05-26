# File d'attente Codex

| Tache | Statut | Note |
| --- | --- | --- |
| Footer mobile - structure globale premium | Terminé | Footer mobile refait en blocs clairs: marque centrée, coordonnées dans un conteneur dédié, actions sociales en pastilles et navigation en deux colonnes; build OK. |
| Accueil mobile - cadrage images Nos prestations | Terminé | Règles mobiles ciblées ajoutées: cartes plus compactes, Photobooth en cover sans padding, cadrage audio/vidéo ajusté, JBL sans marge intérieure avec coins arrondis; build OK. |
| Carte "Enceintes JBL PartyBox" - agrandir visuel interne | Terminé | Visuel interne JBL agrandi via `scale: 1.12` sans changer la zone média ni les autres cartes; padding/inset supprimés, coins arrondis conservés; validation locale desktop, mobile 390px et 360px effectuée. |
| Carte "Enceintes JBL PartyBox" - taille visuelle image | Terminé | Padding et inset spécifiques retirés sur l'image JBL; la zone média et l'image remplissent le même gabarit que les autres cartes, coins arrondis conservés; validation locale desktop, mobile 390px et 360px effectuée. |
| Carte "Enceintes JBL PartyBox" - arrondi image production | Terminé | Correction ciblée JBL: wrapper média arrondi/clippé et image JBL clippée en conservant cadrage, taille, position et padding; validation locale desktop, mobile 390px et 360px effectuée. |
| Accueil - renommer Nos animations en Nos prestations | Terminé | Mini-titre passé à "Nos prestations"; carte "Fonds photos" renommée "Décor photo" avec texte de complément photobooth; carte "Cadres photos personnalisés" déjà absente; validation desktop, mobile 390px et 360px effectuée. |
| Accueil - retirer carte "Cadres photos personnalisés" des animations | Terminé | Carte retirée de "Nos animations"; grille passée à 5 cartes; validation locale desktop, mobile 390px/360px et comparaison production effectuées. |
| Carte "Enceintes JBL PartyBox" - coins image arrondis | Terminé | Conteneur média JBL et image JBL arrondis/clippés (`border-radius` + `clip-path`); validation desktop, mobile 390px et 360px effectuée. |
| Carte "Cadres photos personnalisés" - prévisualisation image | Terminé | Carte dédiée avec interaction image: bouton/zone cliquable + modale premium (vue agrandie). Image actuelle conservée. |
| Cadres photos personnalisés - visuel réel | Terminé | Visuel finalisé pour la carte avec `/images/event-pic/cadres-photos-personnalises-event-pic.webp` (formats paysage, portrait, bande verticale). |
| Carte "Enceintes JBL PartyBox" - cadrage homogène | Terminé | Cadrage JBL ajusté en non-cadré: `object-fit: contain`, centrage ajusté et léger padding; zone média maintenue homogène. |
| Accueil - compacter Réservation/Inclus | Terminé | Section Inclus séparée retirée; inclusions fusionnées en bloc compact sous les 3 cartes Réservation; build local OK. |
| Nos animations - dimensionnement images | Terminé | Photos audio/vidéo passées en cover, produits agrandis avec moins de padding, mockups élargis dans la zone média commune; build local OK. |
| Nos animations - homogénéiser images cartes | Terminé | Zones média des 6 cartes harmonisées: hauteur commune, centrage des images, mockups contenus dans la même zone et boutons alignés en bas; build local OK. |
| Carte "Photobooth premium" - texte | Terminé | Description passée à “Borne bois ou métal pour une animation élégante et fluide.” |
| Intro hero - mention livres d’or vidéo | Terminé | Sous-titre hero mis à jour : “Photobooths professionnels, livres d’or audio et vidéo, et animations événementielles en Île-de-France.” |
| Remettre image carte Livre d'or vidéo | Terminé | La carte "Livre d'or vidéo" utilise de nouveau `/images/event-pic/livre-or-video-premium-event-pic.webp` et ne tombe plus sur le fallback audio. |
| Accueil - image Livre d'or vidéo | Terminé | Livre d'or vidéo : image incorrecte, vraie photo à fournir. Le fichier actuel est une capture de la section du site; la carte utilise temporairement le visuel propre du livre d'or audio. |
| Hero accueil - vraie borne bois | Terminé | Hero remplacé par `/images/event-pic/photobooth-bois-premium-event-pic.png`, fichier validé visuellement comme vraie borne bois; build local OK. |
| Accueil - carte Livre d'or vidéo | Terminé | Carte "Livre d'or vidéo" ajoutée dans "Nos animations"; grille adaptée en 3 + 3 desktop, 2 colonnes tablette et 1 colonne mobile. |
| Hero accueil - image borne bois bloquée | Terminé | Hero borne bois bloqué : fichier image incorrect, à remplacer par la vraie photo borne bois. |
| Footer mobile - centrage optique logo+texte marque | Terminé | Bloc marque mobile recentré dans sa cellule, logo centré et texte aligné dessous avec espacement réduit. |
| Footer mobile - équilibrage marque | Terminé | Bloc marque mobile centré (`footer-brand`) avec logo en premier et texte aligné dessous; suppression de la signature conservée. |
| Footer mobile (signature supprimée sur mobile) | Terminé | Texte "Event Pic" retiré du bloc marque mobile; logo rond Event Pic positionné en premier, suivi de "Photobooth premium en Île-de-France". |
| Micro-correction footer mobile reseaux | Terminé | Texte "Île-de-France" vérifié; alignement icone/texte Instagram et WhatsApp affiné sans changer la structure mobile. |
| Interaction cartes Avis Google accueil | Terminé | Modale accessible ajoutée pour lire le texte complet d'un avis Google compact; fermeture par bouton, Échap ou clic hors modale. |
| Réduire section Avis Google accueil | Terminé | Version compacte de la section Avis Google: résumé global en ligne, cartes réduites, texte limité à 4 lignes desktop et 3 lignes mobile. |
| Refaire footer mobile en deux grilles | Terminé | Structure mobile en deux grilles: zone haute marque/coordonnées principales, zone basse Instagram/WhatsApp + navigation. |
| Texte et retour à la ligne footer mobile | Terminé | Texte "Ile-de-France" corrigé en "Île-de-France"; email `event_pic@outlook.fr` forcé en non-coupure sur mobile (nowrap) avec réduction légère de taille. |
| Centrage section "Inclus dans nos prestations" | Terminé | Mini-titre, titre, description et grille centrés via style `.home-benefits-section`. |
| Corriger le centrage visuel du bloc coordonnées mobile | Terminé | Correction du bloc footer-contact mobile faite: `footer-mobile-contact` en `fit-content`, centrage visuel sous logo, largeur ajustée au contenu. |
| Footer mobile | Termine | Structure mobile brand / coordonnees / navigation prete et build valide. |
| Footer mobile - centrage coordonnees | Termine | Bloc coordonnees mobile centre avec largeur controlee, desktop inchange, build valide. |
| Footer mobile - micro-correction coordonnees | Terminé | Bloc coordonnees recentré sous le logo, conteneur 300px, logo rond mobile ajusté. |


