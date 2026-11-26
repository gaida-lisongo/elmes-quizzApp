# Tableau des missions

Tenu à jour par l'agent `orchestrateur`. Statuts : À FAIRE · EN COURS · À VÉRIFIER · VALIDÉ · BLOQUÉ.

| Id | Mission | Agent | Statut | Branche / PR | Prochaine étape |
|---|---|---|---|---|---|
| M-20261126-1 | Réparer le build Vercel (filtre `role` de `list_users`) + banques de questions | backend | À VÉRIFIER | `fix/deploy-list-users-contenu` · PR #4 | Fusion par le propriétaire |
| M-20261126-2 | Paliers joueurs cumulatifs + montée automatique + migration | backend, frontend | À VÉRIFIER | `feat/paliers-joueurs` · PR #5 | Fusion après #4, puis `scripts/migrations/2026-11-paliers.mongodb.js` |
| M-20261126-3 | Nettoyage des faux utilisateurs en base | backend, adminsys | BLOQUÉ | — | Le propriétaire définit ce qu'est un « faux » compte ; sauvegarde avant toute suppression |
| M-20261126-4 | Vérifier FlexPay en production | adminsys | À FAIRE | — | Paiement test réel de 1 $ + journaux Vercel |
| M-20261126-5 | Campagnes TOFU / MOFU / BOFU de la 1re compétition | community | À FAIRE | — | Noms définitifs des paliers, puis briefs créatifs |
