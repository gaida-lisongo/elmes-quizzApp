// Usage : node scripts/seed/seed-content.js
// Prérequis : MONGO_URI dans .env.local ou en variable d'environnement
// Idempotent : peut être relancé sans créer de doublons
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

  // Préparer les documents Quiz avec le bon categorieId
  const docs = questions.map(q => ({
    categorieId: categorie._id,
    enonce: q.enonce,
    assertions: q.assertions,
    reponse: q.reponse,
    type: q.type || 'QCM',
    level: q.level ?? 0,
    status: true,
    assets: '',
  }));

  // insertMany avec ordered: false ignore les doublons d'index unique (enonce)
  let inserted = 0;
  let skipped = 0;
  try {
    const result = await Quiz.insertMany(docs, { ordered: false });
    inserted = result.length;
  } catch (err) {
    if (err.code === 11000 || (err.writeErrors && err.writeErrors.length > 0)) {
      // Doublons partiels : récupérer le nb d'insérés depuis insertedDocs
      inserted = err.result ? (err.result.nInserted || 0) : 0;
      skipped = docs.length - inserted;
    } else {
      throw err;
    }
  }

  const skipMsg = skipped > 0 ? ` (${skipped} doublons ignorés)` : '';
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
