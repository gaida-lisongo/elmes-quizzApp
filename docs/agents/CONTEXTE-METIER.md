# Contexte métier ELMES-QUIZ

Tenu à jour par l'agent `orchestrateur`. Source détaillée : `../01-description-plateforme.md`, `../03-cahier-des-charges.md` (dossier parent `formation-elmes-quiz`).

## Plateforme
Quiz et compétitions intellectuelles en ligne pour les jeunes congolais, surtout étudiants. Next.js sur Vercel (`elmes-quizz-app.vercel.app`), MongoDB Atlas, paiements Mobile Money et carte via FlexPay, en CDF ou USD. De l'argent réel circule : `main` = production.

## Paliers joueurs (cumulatifs) — `lib/utils/paliers.ts`
| Palier | Nom affiché | Droits | Comment on y arrive |
|---|---|---|---|
| 1 | Challenger | Parties d'entraînement, Pass, parrainage, retraits | Inscription |
| 2 | Compétiteur | Tout le palier 1 + Parcours, classements, prix du top 3 | Premier enrôlement Parcours confirmé |
| 3 | Élite | Tout le palier 2 + équipe de 5, compétitions, matchs, Bourse | Création d'équipe, invitation acceptée, ou nommé capitaine |

- Un joueur ne redescend jamais. Les noms affichés se changent dans `INFOS_PALIERS` sans migration.
- Liens d'inscription : `/auth/signup#challenger`, `#competiteur`, `#elite` (les anciens `#standalone`, `#advanced`, `#vip` restent valides).
- Ne pas confondre avec `Player.level` (0 à 3) : la difficulté des questions, affichée « Niveau ».

## Produits (prix fixés par le serveur)
Pass ELEMBO 1 $ (15 parties), MOTUYA 3 $ (40), ELONGA 5 $ (130) ; création d'équipe 1 $ ; enrôlement Parcours 5 $ par défaut ; enrôlement Compétition 5 $ par défaut (250 matchs). Parrainage : +10 parties par filleul. Bonus hebdomadaire : +20 parties pour tous, +30 par Parcours en cours.

## Bourse d'Excellence (compétitions)
Net encaissé (moins 3,5 % de frais) : 35 % plateforme, 65 % Bourse. Un match parfait (5/5) verse Bourse ÷ (équipes × 250) dans la caisse de l'équipe. Les montants sont faibles sans sponsors.

## Décisions du propriétaire
- 2026-09-27 : correctifs lots 1 à 3 livrés ; lots 4 (SDK) et 5 à venir.
- 2026-11-26 : paliers cumulatifs à la place de STANDALONE / ADVANCED / VIP.
- 2026-11-26 : 1re compétition par équipes vers le 10 décembre 2026, puis deux par mois (fêtes de fin d'année, janvier). Objectif : au moins 20 équipes pour démarcher des sponsors. Campagnes Meta TOFU (7 images, 4 $ × 3 j), MOFU (5 images, 3 $ × 3 j), BOFU (2 images + 1 vidéo, 4 $ × 3 j). Autorisations Meta réglées selon le propriétaire.

## Contraintes permanentes
Jamais de push sur `main` ; branche + Pull Request, le propriétaire fusionne. Dépôt public : aucun secret. Pas de données personnelles dans les journaux. Toute suppression de données de production est confirmée par le propriétaire, après sauvegarde.
