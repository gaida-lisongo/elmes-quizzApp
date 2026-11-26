// Usage : node scripts/seed/seed-content.js
// Prérequis : MONGO_URI dans .env.local ou en variable d'environnement
// Idempotent : peut être relancé sans créer de doublons
//
// AVERTISSEMENT (M-20261126-10) : NE PAS relancer ce seed pour les questions RDM
// avant d'avoir exécuté la migration scripts/migrations/2026-11-rdm-encodage.mjs.
// Si des questions RDM ont été insérées en base avec un encodage mojibake (avant
// la PR #6 / fix/m8-rdm-encodage), relancer le seed créerait ~200 doublons
// (les anciens enonces mojibakés et les nouveaux enonces corrects coexistent,
// car l'index unique porte sur l'enonce brut). Lancer la migration d'abord.
//
// GARDE-FOU DOUBLONS (M-20261126-12) : avant d'insérer, les questions dont
// l'énoncé normalisé (trim + espaces + casse) existe déjà dans la même catégorie
// sont ignorées et affichées. Cela empêche la recréation de doublons après
// l'exécution de scripts/migrations/2026-11-dedoublonnage-questions.mjs.
'use strict';

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// ── Lire .env.local puis .env (sans dotenv) ──────────────────────────────────
function loadEnv(filePath) {
  try {
    fs.readFileSync(filePath, 'utf8').split('\n').forEach(line => {
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

// ── Schémas Mongoose inline ───────────────────────────────────────────────────
// Copies simplifiées des schémas pour usage en dehors de Next.js

const CategorieSchema = new mongoose.Schema(
  {
    designation: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String, default: '' },
    slug: { type: String, required: true, unique: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const QuizSchema = new mongoose.Schema(
  {
    categorieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Categorie', required: true },
    enonce: { type: String, required: true, unique: true },
    assertions: [{ type: String, required: true }],
    reponse: { type: String, required: true },
    assets: { type: String, default: '' },
    level: { type: Number, enum: [0, 1, 2, 3], default: 0 },
    status: { type: Boolean, default: true },
    type: { type: String, enum: ['QCM', 'VRAI_FAUX'], default: 'QCM' },
  },
  { timestamps: true }
);

const Categorie =
  mongoose.models.Categorie || mongoose.model('Categorie', CategorieSchema);
const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);

// ── Fichiers JSON à seeder ────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const JSON_FILES = [
  'droit.json',
  'economie.json',
  'rdm.json',
  'statique.json',
  'engins-elevage.json',
];

// ── Normalisation pour comparaison d'énoncés ─────────────────────────────────

/**
 * Normalise un énoncé pour la comparaison anti-doublons :
 * trim, collapse des espaces multiples, mise en minuscule.
 * Identique à la normalisation du script de migration.
 */
function normaliserEnonce(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ── Logique de seed ───────────────────────────────────────────────────────────
async function seedFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  const { designation, description, slug } = data.categorie;
  const questions = data.questions;

  // Créer la catégorie si elle n'existe pas déjà (par slug)
  let categorie = await Categorie.findOne({ slug });
  let categorieStatus;

  if (!categorie) {
    categorie = await Categorie.create({ designation, description, slug });
    categorieStatus = `Catégorie créée (id: ${categorie._id})`;
  } else {
    categorieStatus = `Catégorie existante (id: ${categorie._id})`;
  }

  // Charger les énoncés normalisés déjà présents en base pour cette catégorie.
  // Garde-fou anti-doublons (M-20261126-12) : on ignore les questions dont
  // l'énoncé normalisé existe déjà, même si l'enonce brut est différent
  // (différences d'encodage, d'espaces ou de casse).
  const existants = await Quiz.find(
    { categorieId: categorie._id },
    { enonce: 1 }
  ).lean();
  const enoceNormalisesEnBase = new Set(existants.map(q => normaliserEnonce(q.enonce)));

  // Filtrer les questions à insérer.
  const questionsAInserer = [];
  const questionsIgnorees = [];
  for (const q of questions) {
    const cleNorm = normaliserEnonce(q.enonce);
    if (enoceNormalisesEnBase.has(cleNorm)) {
      questionsIgnorees.push(q.enonce);
    } else {
      questionsAInserer.push(q);
      // Ajouter immédiatement pour éviter les doublons intra-fichier.
      enoceNormalisesEnBase.add(cleNorm);
    }
  }

  if (questionsIgnorees.length > 0) {
    console.log(
      `[${designation}] DOUBLONS IGNORÉS (${questionsIgnorees.length}) :`
    );
    for (const enonce of questionsIgnorees) {
      console.log(`  → "${enonce.slice(0, 80)}${enonce.length > 80 ? '...' : ''}"`);
    }
  }

  if (questionsAInserer.length === 0) {
    console.log(
      `[${designation}] ${categorieStatus} | Toutes les questions sont déjà en base. 0 insérée.`
    );
    return { inserted: 0, skipped: questionsIgnorees.length };
  }

  // Préparer les documents Quiz avec le bon categorieId
  const docs = questionsAInserer.map(q => ({
    categorieId: categorie._id,
    enonce: q.enonce,
    assertions: q.assertions,
    reponse: q.reponse,
    type: q.type || 'QCM',
    level: q.level ?? 0,
    status: true,
    assets: '',
  }));

  // insertMany avec ordered: false : filet de sécurité contre les doublons
  // d'index unique (enonce brut) qui auraient échappé au filtre ci-dessus.
  let inserted = 0;
  let skipped = questionsIgnorees.length;
  try {
    const result = await Quiz.insertMany(docs, { ordered: false });
    inserted = result.length;
  } catch (err) {
    if (err.code === 11000 || (err.writeErrors && err.writeErrors.length > 0)) {
      // Doublons partiels sur l'index unique brut.
      inserted = err.result ? (err.result.nInserted || 0) : 0;
      const extraSkip = docs.length - inserted;
      skipped += extraSkip;
      if (extraSkip > 0) {
        console.log(
          `[${designation}] AVERTISSEMENT : ${extraSkip} question(s) rejetée(s) ` +
          'par l\'index unique (énoncé brut déjà en base).'
        );
      }
    } else {
      throw err;
    }
  }

  const skipMsg = skipped > 0 ? ` (${skipped} doublons ignorés au total)` : '';
  console.log(
    `[${designation}] ${categorieStatus} | Questions insérées: ${inserted}${skipMsg}`
  );

  return { inserted, skipped };
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error(
      'Erreur : MONGO_URI introuvable. Définissez-la dans .env.local ou en variable d\'environnement.'
    );
    process.exit(1);
  }

  console.log('Connexion à MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connexion établie.\n');

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalCategories = 0;

  for (const fileName of JSON_FILES) {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[AVERTISSEMENT] Fichier introuvable, ignoré : ${filePath}`);
      continue;
    }
    const { inserted, skipped } = await seedFile(filePath);
    totalInserted += inserted;
    totalSkipped += skipped;
    totalCategories += 1;
  }

  console.log(
    `\nSeed terminé. Total : ${totalCategories} catégories, ${totalInserted} questions insérées.` +
    (totalSkipped > 0 ? ` (${totalSkipped} doublons ignorés)` : '')
  );
  console.log('Déconnexion.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
