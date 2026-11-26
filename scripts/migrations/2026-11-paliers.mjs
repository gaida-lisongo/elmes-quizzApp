/**
 * 2026-11-paliers.mjs — Migration des paliers joueurs (novembre 2026).
 *
 * Traduit les anciennes valeurs STANDALONE / ADVANCED / VIP en PALIER_1 / PALIER_2 / PALIER_3,
 * et fait monter les joueurs concernés en appliquant les règles cumulatives.
 *
 * Usage :
 *   node scripts/migrations/2026-11-paliers.mjs [--simulation] [--appliquer]
 *
 * - Mode par défaut : --simulation (lecture seule, compte seulement ce qui changerait).
 * - Écriture uniquement avec --appliquer.
 * - Idempotent : une 2e exécution donne 0 modification.
 * - Aucune suppression.
 * - Lit MONGO_URI depuis l'environnement ou .env.local / .env à la racine du projet.
 * - N'affiche jamais l'URI ni de données personnelles (seulement des comptes).
 *
 * Prérequis : lancer la sauvegarde (sauvegarde.mjs) avant d'utiliser --appliquer.
 */

'use strict';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Chargement des variables d'environnement ─────────────────────────────────

function loadEnv(filePath) {
  try {
    readFileSync(filePath, 'utf8').split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (_) {}
}

loadEnv(path.join(__dirname, '../../.env.local'));
loadEnv(path.join(__dirname, '../../.env'));

// ── Arguments ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const simulationMode = !args.includes('--appliquer');  // --simulation est le défaut

if (args.includes('--simulation') && args.includes('--appliquer')) {
  console.error('ERREUR : --simulation et --appliquer sont mutuellement exclusifs.');
  process.exit(1);
}

console.log('══════════════════════════════════════════════════════════════════');
console.log(' Migration 2026-11 — Paliers joueurs cumulatifs');
console.log(' Mode : ' + (simulationMode ? 'SIMULATION (lecture seule, aucune écriture)' : 'APPLIQUER (écriture en base)'));
console.log('══════════════════════════════════════════════════════════════════\n');

if (!simulationMode) {
  console.log('ATTENTION : ce script va modifier les données en production.');
  console.log('Vérifiez qu\'une sauvegarde a été faite avec sauvegarde.mjs.\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERREUR : MONGO_URI introuvable. Vérifiez .env.local ou .env à la racine du projet.');
    process.exit(1);
  }

  console.log('Connexion à MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connexion établie.\n');

  const db = mongoose.connection.db;
  const players = db.collection('players');
  const equipes = db.collection('equipes');
  const enrollements = db.collection('enrollements');
  const { ObjectId } = mongoose.Types;

  let totalModifications = 0;

  // ── Étape 1 : Renommage des anciens types ─────────────────────────────────
  console.log('── Étape 1 : Renommage des anciens types ────────────────────────');

  const renommages = [
    { ancien: 'STANDALONE', palier: 'PALIER_1' },
    { ancien: 'ADVANCED',   palier: 'PALIER_2' },
    { ancien: 'VIP',        palier: 'PALIER_3' },
  ];

  for (const { ancien, palier } of renommages) {
    const count = await players.countDocuments({ type: ancien });
    console.log(`  ${ancien} → ${palier} : ${count} document(s) à modifier`);
    if (!simulationMode && count > 0) {
      const r = await players.updateMany({ type: ancien }, { $set: { type: palier } });
      console.log(`    → modifié : ${r.modifiedCount}`);
      totalModifications += r.modifiedCount;
    } else if (!simulationMode) {
      console.log(`    → rien à modifier`);
    }
    if (simulationMode) totalModifications += count;
  }

  // Joueurs sans champ type
  const sanstypeCount = await players.countDocuments({ type: { $exists: false } });
  console.log(`  Sans type → PALIER_1 : ${sanstypeCount} document(s) à modifier`);
  if (!simulationMode && sanstypeCount > 0) {
    const r = await players.updateMany({ type: { $exists: false } }, { $set: { type: 'PALIER_1' } });
    console.log(`    → modifié : ${r.modifiedCount}`);
    totalModifications += r.modifiedCount;
  } else if (simulationMode) {
    totalModifications += sanstypeCount;
  }

  // ── Étape 2 : Membres actifs et capitaines d'équipe → PALIER_3 ───────────
  console.log('\n── Étape 2 : Membres actifs et capitaines d\'équipe → PALIER_3 ──');

  // Collecte des IDs des capitaines et membres actifs
  const idsEquipeCursor = equipes.find({}, { projection: { chefId: 1, membres: 1 } });
  const idsEquipe = new Set();

  for await (const equipe of idsEquipeCursor) {
    if (equipe.chefId) {
      idsEquipe.add(equipe.chefId.toString());
    }
    if (Array.isArray(equipe.membres)) {
      for (const membre of equipe.membres) {
        // membres[].status est un booléen : true = membre actif
        if (membre.status && membre.player) {
          idsEquipe.add(membre.player.toString());
        }
      }
    }
  }

  console.log(`  Capitaines + membres actifs détectés : ${idsEquipe.size} joueur(s) unique(s)`);

  if (idsEquipe.size > 0) {
    const objectIds = [...idsEquipe].map((id) => new ObjectId(id));
    // Ne monter que ceux qui ne sont pas encore PALIER_3
    const aMonterCount = await players.countDocuments({
      _id: { $in: objectIds },
      type: { $in: ['PALIER_1', 'PALIER_2', 'STANDALONE', 'ADVANCED'] },
    });
    console.log(`  Membres/capitaines à monter en PALIER_3 : ${aMonterCount}`);
    if (!simulationMode && aMonterCount > 0) {
      const r = await players.updateMany(
        {
          _id: { $in: objectIds },
          type: { $in: ['PALIER_1', 'PALIER_2', 'STANDALONE', 'ADVANCED'] },
        },
        { $set: { type: 'PALIER_3' } },
      );
      console.log(`    → modifié : ${r.modifiedCount}`);
      totalModifications += r.modifiedCount;
    } else if (simulationMode) {
      totalModifications += aMonterCount;
    }
  } else {
    console.log('  Aucune équipe trouvée.');
  }

  // ── Étape 3 : Enrôlement Parcours confirmé → au moins PALIER_2 ───────────
  console.log('\n── Étape 3 : Enrôlement Parcours confirmé → au moins PALIER_2 ──');

  // Joueurs avec un enrôlement Parcours confirmé
  const idsParcours = await enrollements.distinct('playerId', {
    status: 'CONFIRMED',
    parcoursId: { $exists: true },
    playerId: { $exists: true },
  });

  console.log(`  Joueurs avec enrôlement Parcours confirmé : ${idsParcours.length}`);

  if (idsParcours.length > 0) {
    // Seulement ceux qui sont encore PALIER_1 (ou STANDALONE)
    const aMonterCount = await players.countDocuments({
      _id: { $in: idsParcours },
      type: { $in: ['PALIER_1', 'STANDALONE'] },
    });
    console.log(`  À monter en PALIER_2 (étaient PALIER_1 / STANDALONE) : ${aMonterCount}`);
    if (!simulationMode && aMonterCount > 0) {
      const r = await players.updateMany(
        {
          _id: { $in: idsParcours },
          type: { $in: ['PALIER_1', 'STANDALONE'] },
        },
        { $set: { type: 'PALIER_2' } },
      );
      console.log(`    → modifié : ${r.modifiedCount}`);
      totalModifications += r.modifiedCount;
    } else if (simulationMode) {
      totalModifications += aMonterCount;
    }
  } else {
    console.log('  Aucun enrôlement Parcours confirmé trouvé.');
  }

  // ── Étape 4 : Contrôle final ──────────────────────────────────────────────
  console.log('\n── Étape 4 : Contrôle final ─────────────────────────────────────');
  console.log('  Distribution des types de joueurs après migration :');

  const groupes = await players.aggregate([
    { $group: { _id: '$type', n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  for (const { _id, n } of groupes) {
    const label = _id === null ? '(null)' : (_id === undefined ? '(undefined)' : _id);
    const statut = ['PALIER_1', 'PALIER_2', 'PALIER_3'].includes(label) ? '' : '  ← ancienne valeur, non migrée';
    console.log(`    ${String(label).padEnd(14)} : ${String(n).padStart(6)}${statut}`);
  }

  const totalPlayers = groupes.reduce((s, g) => s + g.n, 0);
  console.log(`    ${'TOTAL'.padEnd(14)} : ${String(totalPlayers).padStart(6)}`);

  // ── Résumé ────────────────────────────────────────────────────────────────
  await mongoose.disconnect();

  console.log('\n══════════════════════════════════════════════════════════════════');
  if (simulationMode) {
    console.log(` SIMULATION terminée. Documents qui seraient modifiés : ${totalModifications}`);
    console.log(' Aucune donnée modifiée. Relancez avec --appliquer pour écrire.');
  } else {
    console.log(` MIGRATION terminée. Documents modifiés : ${totalModifications}`);
    if (totalModifications === 0) {
      console.log(' (La migration était déjà appliquée — idempotence confirmée.)');
    }
  }
  console.log('══════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Erreur fatale :', err.message);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
