// Migration ponctuelle — lots 1 à 3 du cahier des charges (septembre 2026).
// À exécuter UNE FOIS, AVANT le déploiement, sur la base de production (après une sauvegarde) :
//   mongosh "$MONGO_URI" scripts/migrations/2026-09-lots-1-3.mongodb.js
// Le script est idempotent : le relancer ne change rien de plus.

const now = new Date();

// 1. Q-04 : parties EN_COURS bloquées avant le correctif → clôturées en EXPIRED, SANS décompte
//    ni métriques (geste de transition). Nécessaire avant la création de l'index unique
//    « une partie EN_COURS par joueur ».
const parties = db.parties.updateMany(
  { status: 'EN_COURS' },
  { $set: { status: 'TERMINE', endReason: 'EXPIRED', endedAt: now, resultApplied: true } },
);
print(`Parties EN_COURS clôturées (EXPIRED, sans décompte) : ${parties.modifiedCount}`);

// 2. PAY-20 : anciens index uniques d'enrôlement (sans filtre de statut) remplacés par des index
//    limités aux statuts PENDING et CONFIRMED (créés automatiquement par Mongoose au démarrage).
for (const name of ['playerId_1_parcoursId_1_sessionId_1', 'equipeId_1_competitionId_1_sessionId_1']) {
  try {
    db.enrollements.dropIndex(name);
    print(`Index supprimé : ${name}`);
  } catch (error) {
    print(`Index ${name} absent (déjà supprimé ?) : ${error.message}`);
  }
}

// 3. Nouveaux champs utilisateur : solde réservé par les retraits et version de session.
const users = db.users.updateMany(
  { $or: [{ soldeBloque: { $exists: false } }, { sessionVersion: { $exists: false } }] },
  [{ $set: { soldeBloque: { $ifNull: ['$soldeBloque', 0] }, sessionVersion: { $ifNull: ['$sessionVersion', 0] } } }],
);
print(`Utilisateurs initialisés (soldeBloque, sessionVersion) : ${users.modifiedCount}`);

// 4. Q-05 : sessions de compétition dont les matchs ont déjà été ouverts (COMPLETED ou Bourse calculée).
const sessions = db.sessions.updateMany(
  {
    type: 'competition',
    matchesOpenedAt: { $exists: false },
    $or: [{ status: 'COMPLETED' }, { lastScholarshipComputedAt: { $exists: true } }],
  },
  [{ $set: { matchesOpenedAt: { $ifNull: ['$lastScholarshipComputedAt', now] } } }],
);
print(`Sessions de compétition marquées « matchs ouverts » : ${sessions.modifiedCount}`);

// 5. Enrôlements confirmés sans compteur remainingGames (données historiques).
const enrollments = db.enrollements.updateMany(
  { status: 'CONFIRMED', gamesGranted: true, remainingGames: { $exists: false } },
  [{
    $set: {
      remainingGames: {
        $max: [0, { $subtract: [{ $ifNull: ['$totalGrantedGames', 250] }, { $ifNull: ['$usedGames', { $ifNull: ['$parties', 0] }] }] }],
      },
    },
  }],
);
print(`Enrôlements normalisés (remainingGames) : ${enrollments.modifiedCount}`);

print('Migration terminée.');
