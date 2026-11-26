/**
 * sauvegarde.mjs — Sauvegarde en JSON (EJSON canonique) les collections MongoDB.
 *
 * Usage :
 *   node scripts/migrations/sauvegarde.mjs <dossier_sortie> [--toutes]
 *
 * Exemples :
 *   node scripts/migrations/sauvegarde.mjs E:/Nathan/formation-elmes-quiz/sauvegardes/2026-11-26
 *   node scripts/migrations/sauvegarde.mjs E:/Nathan/formation-elmes-quiz/sauvegardes/2026-11-26 --toutes
 *
 * - <dossier_sortie> est OBLIGATOIRE et doit être hors du dépôt git.
 * - Sans --toutes : exporte players, equipes, enrollements.
 * - Avec --toutes  : exporte toutes les collections de la base.
 * - Lit MONGO_URI depuis l'environnement ou .env.local / .env à la racine du projet.
 * - N'affiche jamais l'URI ni de données personnelles.
 * - N'écrit jamais dans le dépôt.
 */

'use strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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
const outputArg = args.find((a) => !a.startsWith('--'));
const toutesCollections = args.includes('--toutes');

if (!outputArg) {
  console.error('ERREUR : le dossier de sortie est obligatoire.');
  console.error('Usage : node scripts/migrations/sauvegarde.mjs <dossier_sortie> [--toutes]');
  console.error('Exemple : node scripts/migrations/sauvegarde.mjs E:/Nathan/formation-elmes-quiz/sauvegardes/2026-11-26');
  process.exit(1);
}

const outputDir = path.resolve(outputArg);

// ── Garde : refus si le dossier de sortie est dans le dépôt ──────────────────

const REPO_ROOT = path.resolve(path.join(__dirname, '../../'));
const outputNormalized = outputDir.endsWith(path.sep) ? outputDir : outputDir + path.sep;
const repoNormalized = REPO_ROOT.endsWith(path.sep) ? REPO_ROOT : REPO_ROOT + path.sep;

if (outputNormalized.startsWith(repoNormalized) || outputDir === REPO_ROOT) {
  console.error('ERREUR : le dossier de sortie est situé dans le dépôt git.');
  console.error('  Dossier demandé : ' + outputDir);
  console.error('  Racine du dépôt : ' + REPO_ROOT);
  console.error('Choisissez un emplacement hors du dépôt, par exemple :');
  console.error('  E:/Nathan/formation-elmes-quiz/sauvegardes/2026-11-26');
  process.exit(1);
}

// ── Collections par défaut ───────────────────────────────────────────────────

const COLLECTIONS_MIGRATION = ['players', 'equipes', 'enrollements'];

// ── Sérialiseur EJSON canonique ──────────────────────────────────────────────
// Convertit les types BSON (ObjectId, Date, Binary) en EJSON canonique MongoDB.

function isObjectId(val) {
  return (
    val !== null &&
    typeof val === 'object' &&
    (val._bsontype === 'ObjectId' || val._bsontype === 'ObjectID') &&
    typeof val.toHexString === 'function'
  );
}

function toEJSON(val) {
  if (val === null || val === undefined) return val;
  if (isObjectId(val)) {
    return { $oid: val.toHexString() };
  }
  if (val instanceof Date) {
    return { $date: { $numberLong: String(val.getTime()) } };
  }
  if (Buffer.isBuffer(val)) {
    return { $binary: { base64: val.toString('base64'), subType: '00' } };
  }
  if (val && val._bsontype === 'Binary') {
    const buf =
      typeof val.buffer !== 'undefined'
        ? Buffer.from(val.buffer)
        : Buffer.from(val.value(), 'binary');
    const subType = typeof val.sub_type === 'number'
      ? val.sub_type.toString(16).padStart(2, '0')
      : '00';
    return { $binary: { base64: buf.toString('base64'), subType } };
  }
  if (Array.isArray(val)) {
    return val.map(toEJSON);
  }
  if (typeof val === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(val)) {
      result[k] = toEJSON(v);
    }
    return result;
  }
  return val;
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

  // Liste des collections à exporter
  let collections;
  if (toutesCollections) {
    const listeCollections = await db.listCollections().toArray();
    collections = listeCollections.map((c) => c.name).sort();
    console.log(`Mode --toutes : ${collections.length} collections détectées.`);
  } else {
    collections = COLLECTIONS_MIGRATION;
    console.log(`Collections ciblées (migration paliers) : ${collections.join(', ')}`);
  }

  // Création du dossier de sortie
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`Dossier créé : ${outputDir}\n`);
  } else {
    console.log(`Dossier de sortie : ${outputDir}\n`);
  }

  const rapport = [];

  for (const collectionName of collections) {
    process.stdout.write(`  Exportation de '${collectionName}'...`);

    // Lecture brute via le driver natif (pour obtenir tous les champs, sans filtrage Mongoose)
    const rawDocs = await db.collection(collectionName).find({}).toArray();
    const count = rawDocs.length;

    // Conversion EJSON canonique
    const ejsonDocs = rawDocs.map((doc) => toEJSON(doc));

    // Écriture
    const filePath = path.join(outputDir, `${collectionName}.json`);
    const json = JSON.stringify(ejsonDocs, null, 2);
    writeFileSync(filePath, json, 'utf8');

    // Vérification : relecture et comptage
    const relecture = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(relecture) || relecture.length !== count) {
      console.error(`\nERREUR : vérification échouée pour '${collectionName}'. Écrit : ${count}, relu : ${relecture.length}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(` OK — ${count} documents → ${filePath}`);
    rapport.push({ collection: collectionName, count, file: filePath });
  }

  await mongoose.disconnect();

  console.log('\n── Résumé ──────────────────────────────────────────────────────');
  for (const { collection, count, file } of rapport) {
    console.log(`  ${collection.padEnd(20)} : ${String(count).padStart(6)} documents  →  ${file}`);
  }
  console.log('────────────────────────────────────────────────────────────────');
  console.log('Sauvegarde terminée. Chaque fichier a été relu et vérifié.\n');
}

main().catch((err) => {
  console.error('Erreur fatale :', err.message);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
