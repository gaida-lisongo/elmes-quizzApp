// Migration ponctuelle — paliers joueurs cumulatifs (novembre 2026).
// À exécuter UNE FOIS, APRÈS le déploiement de la branche feat/paliers-joueurs, sur la base
// de production (après une sauvegarde) :
//   mongosh "$MONGO_URI" scripts/migrations/2026-11-paliers.mongodb.js
// Idempotent : le relancer ne change rien de plus. Le code accepte les anciennes valeurs
// tant que ce script n'a pas tourné, l'ordre déploiement → migration est donc sans risque.

// 1. Renommage des anciens types.
const renommages = { STANDALONE: 'PALIER_1', ADVANCED: 'PALIER_2', VIP: 'PALIER_3' };
for (const [ancien, palier] of Object.entries(renommages)) {
  const r = db.players.updateMany({ type: ancien }, { $set: { type: palier } });
  print(`${ancien} → ${palier} : ${r.modifiedCount}`);
}
const sansType = db.players.updateMany({ type: { $exists: false } }, { $set: { type: 'PALIER_1' } });
print(`Sans type → PALIER_1 : ${sansType.modifiedCount}`);

// 2. Rattrapage de la règle de montée : membre actif ou capitaine d'une équipe → PALIER_3.
const idsEquipe = new Set();
db.equipes.find({}, { chefId: 1, membres: 1 }).forEach((e) => {
  if (e.chefId) idsEquipe.add(String(e.chefId));
  (e.membres || []).forEach((m) => { if (m.status && m.player) idsEquipe.add(String(m.player)); });
});
const p3 = db.players.updateMany(
  { _id: { $in: [...idsEquipe].map((id) => ObjectId(id)) }, type: { $in: ['PALIER_1', 'PALIER_2'] } },
  { $set: { type: 'PALIER_3' } },
);
print(`Membres d'équipe montés en PALIER_3 : ${p3.modifiedCount}`);

// 3. Enrôlement Parcours confirmé → au moins PALIER_2.
const idsParcours = db.enrollements.distinct('playerId', { status: 'CONFIRMED', parcoursId: { $exists: true }, playerId: { $exists: true } });
const p2 = db.players.updateMany(
  { _id: { $in: idsParcours }, type: 'PALIER_1' },
  { $set: { type: 'PALIER_2' } },
);
print(`Joueurs Parcours montés en PALIER_2 : ${p2.modifiedCount}`);

// 4. Contrôle final.
db.players.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).forEach((g) => print(`  ${g._id} : ${g.n}`));
