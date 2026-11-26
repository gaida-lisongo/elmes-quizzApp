/**
 * 2026-11-dedoublonnage-questions.mjs — Dédoublonnage multi-catégories.
 * Révision 2 (M-20261126-15) : vrais slugs, casse préservée dans formules,
 * différence de distracteurs ne déclenche plus un conflit.
 *
 * Contexte : pour 9 catégories, le seed a été lancé plusieurs fois.
 * Ce script supprime les doublons d'énoncés et ne conserve qu'une seule question
 * par énoncé et par catégorie.
 *
 * Ce script :
 *   1. Pour chaque catégorie cible, charge toutes les questions en base.
 *   2. Applique fixMojibake puis normalise (trim, espaces, casse) avant de comparer.
 *   3. Regroupe par énoncé normalisé.
 *   4. Dans chaque groupe avec plusieurs documents :
 *        - Détecte les conflits : bonne réponse ou assertions différentes
 *          (au-delà de l'encodage et des espaces) → exclusion + liste séparée.
 *        - Choisit UN gagnant : propre d'abord, sinon le plus référencé, sinon le
 *          plus ancien (_id).
 *        - Si le gagnant est cassé → réparation ($set).
 *        - Supprime TOUTES les autres copies.
 *   5. Réaffecte les références (parties.reponses[].quizId, parties.quizIds[])
 *      vers la question gardée avant suppression.
 *   6. Écrit doublons-supprimes.json (documents complets) avant de supprimer.
 *
 * Catégories traitées par défaut (9, slug réels en base) :
 *   droit, economie, statique, thermodynamique,
 *   m-canique-terrestre-et-c-leste, engins-elevage,
 *   cin-matique-du-point-mat-riel, lectromagn-tisme, ondes-lumineuses
 *
 * La catégorie RDM est EXPLICITEMENT exclue (traitée par 2026-11-rdm-encodage.mjs).
 *
 * Garde-fous (mode --appliquer) :
 *   - Refus si les suppressions prévues dépassent 20 au total (passe M-15).
 *   - Refus si une suppression vise une catégorie hors liste autorisée.
 *   - Refus si sauvegarde absente, non datée d'aujourd'hui, ou quizzes.json
 *     ne correspond pas au nombre actuel de documents en base (±0).
 *
 * Usage :
 *   node scripts/migrations/2026-11-dedoublonnage-questions.mjs [--simulation]
 *   node scripts/migrations/2026-11-dedoublonnage-questions.mjs \
 *     --appliquer --sauvegarde <dossier>
 *   node scripts/migrations/2026-11-dedoublonnage-questions.mjs \
 *     --categories droit,economie --appliquer --sauvegarde <dossier>
 *
 * - Mode par défaut : --simulation (lecture seule).
 * - Écriture uniquement avec --appliquer + --sauvegarde pointant vers une sauvegarde
 *   existante, dont le nom commence par la date du jour, contenant quizzes.json
 *   avec le nombre exact de documents actuellement en base.
 * - Idempotent : relancer après application donne 0 modification.
 * - Aucune donnée personnelle dans les journaux. Aucun secret dans le code.
 */

'use strict';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Constantes ───────────────────────────────────────────────────────────────

/** Catégories autorisées par défaut (slugs réels en base). RDM est EXCLUE. */
const CATEGORIES_DEFAUT = [
  'droit',
  'economie',
  'statique',
  'thermodynamique',
  'm-canique-terrestre-et-c-leste',
  'engins-elevage',
  'cin-matique-du-point-mat-riel',
  'lectromagn-tisme',
  'ondes-lumineuses',
];

/** Slug interdit (catégorie RDM gérée par un autre script). */
const SLUG_INTERDIT = 'rdm';

/**
 * Nombre maximum de suppressions autorisées en mode --appliquer.
 * Abaissé à 20 pour la passe M-15 (3 catégories retrouvées + thermo).
 */
const MAX_SUPPRESSIONS = 20;

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
const simulationMode = !args.includes('--appliquer');

if (args.includes('--simulation') && args.includes('--appliquer')) {
  console.error('ERREUR : --simulation et --appliquer sont mutuellement exclusifs.');
  process.exit(1);
}

// Parsing --categories
const categoriesArg = (() => {
  const idx = args.indexOf('--categories');
  if (idx === -1) return null;
  return args[idx + 1] || null;
})();

const categoriesCibles = categoriesArg
  ? categoriesArg.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : [...CATEGORIES_DEFAUT];

// Vérification : RDM interdit
if (categoriesCibles.includes(SLUG_INTERDIT)) {
  console.error(
    `ERREUR : la catégorie "${SLUG_INTERDIT}" est exclue de ce script. ` +
    'Utilisez scripts/migrations/2026-11-rdm-encodage.mjs.',
  );
  process.exit(1);
}

// Parsing --sauvegarde
const sauvegArg = (() => {
  const idx = args.indexOf('--sauvegarde');
  if (idx === -1) return null;
  return args[idx + 1] || null;
})();

if (!simulationMode && !sauvegArg) {
  console.error('ERREUR : --appliquer requiert --sauvegarde <dossier>.');
  console.error(
    'Exemple : node scripts/migrations/2026-11-dedoublonnage-questions.mjs ' +
    '--appliquer ' +
    '--sauvegarde E:/Nathan/formation-elmes-quiz/sauvegardes/2026-11-26-avant-doublons',
  );
  process.exit(1);
}

// ── Validation de la sauvegarde ───────────────────────────────────────────────

/**
 * Valide le dossier de sauvegarde et retourne le contenu de quizzes.json
 * (pour vérification ultérieure du compte).
 */
function chargerSauvegarde(sauvegDir) {
  if (!existsSync(sauvegDir)) {
    console.error(`ERREUR : le dossier de sauvegarde n'existe pas : ${sauvegDir}`);
    process.exit(1);
  }

  const stat = statSync(sauvegDir);
  if (!stat.isDirectory()) {
    console.error(`ERREUR : ${sauvegDir} n'est pas un dossier.`);
    process.exit(1);
  }

  // Vérifier que le nom du dossier commence par la date du jour (YYYY-MM-DD).
  const today = new Date().toISOString().slice(0, 10);
  const folderName = path.basename(sauvegDir);
  if (!folderName.startsWith(today)) {
    console.error(
      `ERREUR : la sauvegarde '${folderName}' ne commence pas par la date d'aujourd'hui (${today}).`,
    );
    console.error(
      "Lancez d'abord : node scripts/migrations/sauvegarde.mjs " +
      `E:/Nathan/formation-elmes-quiz/sauvegardes/${today}-avant-doublons --toutes`,
    );
    process.exit(1);
  }

  const quizzesFile = path.join(sauvegDir, 'quizzes.json');
  if (!existsSync(quizzesFile)) {
    console.error(`ERREUR : quizzes.json introuvable dans ${sauvegDir}.`);
    console.error(
      "Lancez d'abord : node scripts/migrations/sauvegarde.mjs <dossier> --toutes",
    );
    process.exit(1);
  }

  let quizzesData;
  try {
    quizzesData = JSON.parse(readFileSync(quizzesFile, 'utf8'));
  } catch (err) {
    console.error(`ERREUR : impossible de lire/parser quizzes.json : ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(quizzesData)) {
    console.error('ERREUR : quizzes.json ne contient pas un tableau JSON.');
    process.exit(1);
  }

  return quizzesData;
}

// ── Sérialisation EJSON ───────────────────────────────────────────────────────

function toEJSON(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof mongoose.Types.ObjectId) return { $oid: value.toString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(toEJSON);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toEJSON(v);
    return out;
  }
  return value;
}

// ── Table de correspondance Windows-1252 (0x80-0x9F) ─────────────────────────

const W1252_REVERSE = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201C: 0x93, // "
  0x201D: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F, // Ÿ
};

function isMojiChar(cp) {
  return (cp >= 0x80 && cp <= 0xFF) || W1252_REVERSE[cp] !== undefined;
}

function tryDecode(seq) {
  const bytes = [];
  for (let i = 0; i < seq.length; i++) {
    const cp = seq.codePointAt(i);
    if (cp <= 0xFF) {
      bytes.push(cp);
    } else if (W1252_REVERSE[cp] !== undefined) {
      bytes.push(W1252_REVERSE[cp]);
    } else {
      return null;
    }
  }
  try {
    const uint8 = new Uint8Array(bytes);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(uint8);
    if (decoded === seq) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

/** Corrige le mojibake dans une chaîne. Idempotent. */
function fixMojibake(str) {
  if (typeof str !== 'string') return str;
  let result = '';
  let i = 0;
  while (i < str.length) {
    const cp = str.codePointAt(i);
    if (isMojiChar(cp)) {
      let j = i;
      while (j < str.length && isMojiChar(str.codePointAt(j))) j++;
      const seq = str.slice(i, j);
      const fixed = seq.length >= 2 ? tryDecode(seq) : null;
      result += (fixed !== null) ? fixed : seq;
      i = j;
    } else {
      result += str[i];
      i++;
    }
  }
  return result;
}

/** Normalise une chaîne pour comparaison (casse, espaces). */
function normaliser(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Applique fixMojibake puis normalise. */
function normaliserRepare(str) {
  return normaliser(fixMojibake(str));
}

/** Teste si un document Quiz est déjà propre (pas de mojibake). */
function estPropre(doc) {
  if (fixMojibake(doc.enonce) !== doc.enonce) return false;
  if (fixMojibake(doc.reponse) !== doc.reponse) return false;
  if (Array.isArray(doc.assertions)) {
    for (const a of doc.assertions) {
      if (fixMojibake(a) !== a) return false;
    }
  }
  return true;
}

// ── Références dans parties ───────────────────────────────────────────────────

async function compterReferences(idList, partiesColl) {
  const oids = idList.map((id) => new mongoose.Types.ObjectId(id.toString()));

  const [reponsesAgg, quizIdsAgg] = await Promise.all([
    partiesColl.aggregate([
      { $match: { 'reponses.quizId': { $in: oids } } },
      { $unwind: '$reponses' },
      { $match: { 'reponses.quizId': { $in: oids } } },
      { $group: { _id: '$reponses.quizId', count: { $sum: 1 } } },
    ]).toArray(),
    partiesColl.aggregate([
      { $match: { quizIds: { $in: oids } } },
      { $unwind: '$quizIds' },
      { $match: { quizIds: { $in: oids } } },
      { $group: { _id: '$quizIds', count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const counts = new Map();
  for (const id of idList) {
    counts.set(id.toString(), { reponsesCount: 0, quizIdsCount: 0, total: 0 });
  }
  for (const r of reponsesAgg) {
    const key = r._id.toString();
    if (counts.has(key)) {
      counts.get(key).reponsesCount = r.count;
      counts.get(key).total += r.count;
    }
  }
  for (const r of quizIdsAgg) {
    const key = r._id.toString();
    if (counts.has(key)) {
      counts.get(key).quizIdsCount = r.count;
      counts.get(key).total += r.count;
    }
  }
  return counts;
}

async function reaffecterRefs(deletedOid, keptOid, partiesColl) {
  const [r1, r2] = await Promise.all([
    partiesColl.updateMany(
      { 'reponses.quizId': deletedOid },
      { $set: { 'reponses.$[elem].quizId': keptOid } },
      { arrayFilters: [{ 'elem.quizId': deletedOid }] },
    ),
    partiesColl.updateMany(
      { quizIds: deletedOid },
      { $set: { 'quizIds.$[elem]': keptOid } },
      { arrayFilters: [{ elem: deletedOid }] },
    ),
  ]);
  return {
    reponsesModified: r1.modifiedCount,
    quizIdsModified: r2.modifiedCount,
  };
}

// ── Analyse d'une catégorie ───────────────────────────────────────────────────

/**
 * Analyse les doublons d'une catégorie et retourne les actions prévues.
 * @param {object} categorie - document de la catégorie (avec _id et slug)
 * @param {object} quizzesColl - collection MongoDB quizzes
 * @param {Map} refMap - références pré-calculées (peut être vide en simulation partielle)
 * @returns {object} statistiques et listes d'actions
 */
function analyserCategorie(categorie, docs, refMap) {
  const enriched = docs.map((doc) => {
    const fixedEnonce    = fixMojibake(doc.enonce);
    const fixedAssertions = Array.isArray(doc.assertions)
      ? doc.assertions.map(fixMojibake)
      : [];
    const fixedReponse   = fixMojibake(doc.reponse);
    const propre         = estPropre(doc);
    const cleNormalisee  = normaliser(fixedEnonce);
    return { doc, fixedEnonce, fixedAssertions, fixedReponse, propre, cleNormalisee };
  });

  // Regroupement par énoncé normalisé.
  const groupes = new Map();
  for (const item of enriched) {
    const liste = groupes.get(item.cleNormalisee) || [];
    liste.push(item);
    groupes.set(item.cleNormalisee, liste);
  }

  const aReparerSingles = [];
  const conflits = [];
  const multiGroupes = [];
  const idsMulti = new Set();

  for (const [, items] of groupes) {
    if (items.length === 1) {
      if (!items[0].propre) aReparerSingles.push(items[0]);
      continue;
    }

    // Détection de conflit sur la bonne réponse (après réparation + normalisation).
    const reponsesUniques = new Set(items.map((i) => normaliserRepare(i.fixedReponse)));
    if (reponsesUniques.size > 1) {
      conflits.push({ items, raison: 'bonne-reponse' });
      continue;
    }

    // Détection de conflit sur les assertions (après réparation + normalisation).
    // Comparaison par ensemble trié (order-independent) : si les mêmes assertions
    // sont présentes mais dans un ordre différent, ce n'est pas un conflit.
    const assertionsRef = [...items[0].fixedAssertions].map(normaliser).sort().join('||');
    const assertionsDiff = items.some(
      (i) => [...i.fixedAssertions].map(normaliser).sort().join('||') !== assertionsRef,
    );
    if (assertionsDiff) {
      conflits.push({ items, raison: 'assertions' });
      continue;
    }

    for (const item of items) idsMulti.add(item.doc._id.toString());
    multiGroupes.push(items);
  }

  // Résolution des gagnants.
  const aReparerMulti = [];
  const suppressions = []; // { item, keptId }

  for (const items of multiGroupes) {
    const sorted = [...items].sort((a, b) => {
      if (a.propre !== b.propre) return a.propre ? -1 : 1;
      const ra = (refMap.get(a.doc._id.toString()) || { total: 0 }).total;
      const rb = (refMap.get(b.doc._id.toString()) || { total: 0 }).total;
      if (rb !== ra) return rb - ra;
      return a.doc._id.toString() < b.doc._id.toString() ? -1 : 1;
    });

    const gagnant = sorted[0];
    if (!gagnant.propre) aReparerMulti.push(gagnant);
    for (let i = 1; i < sorted.length; i++) {
      suppressions.push({ item: sorted[i], keptId: gagnant.doc._id });
    }
  }

  const aReparer = [...aReparerSingles, ...aReparerMulti];

  return {
    slug: categorie.slug,
    nbDocs: docs.length,
    nbGroupes: groupes.size,
    nbSingles: [...groupes.values()].filter((g) => g.length === 1).length,
    nbMulti: multiGroupes.length,
    aReparer,
    aReparerSingles,
    aReparerMulti,
    suppressions,
    conflits,
    idsMulti,
  };
}

// ── Bannière ──────────────────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════════════════════════');
console.log(' Migration 2026-11 — Dédoublonnage questions multi-catégories (M-20261126-15, rév. 2)');
console.log(' Mode : ' + (simulationMode
  ? 'SIMULATION (lecture seule, aucune écriture)'
  : 'APPLIQUER (écriture en base)'));
console.log(' Catégories cibles : ' + categoriesCibles.join(', '));
console.log('══════════════════════════════════════════════════════════════════\n');

// Chargement de la sauvegarde (en mode --appliquer uniquement).
let sauvegardeDocs = null;
let sauvegDir = null;
if (!simulationMode) {
  console.log('ATTENTION : ce script va modifier et supprimer des données en production.\n');
  sauvegDir = path.resolve(sauvegArg);
  sauvegardeDocs = chargerSauvegarde(sauvegDir);
  // La vérification du compte se fera après connexion à la base.
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error(
      'ERREUR : MONGO_URI introuvable. Vérifiez .env.local ou .env à la racine du projet.',
    );
    process.exit(1);
  }

  console.log('Connexion à MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connexion établie.\n');

  const db          = mongoose.connection.db;
  const categories  = db.collection('categories');
  const quizzesColl = db.collection('quizzes');
  const parties     = db.collection('parties');

  // ── Vérification de la sauvegarde (mode --appliquer) ─────────────────────
  if (!simulationMode) {
    console.log('── Vérification de la sauvegarde ────────────────────────────────');
    const totalEnBase = await quizzesColl.countDocuments();
    const totalSauvegarde = sauvegardeDocs.length;
    console.log(`  Documents en base actuellement : ${totalEnBase}`);
    console.log(`  Documents dans quizzes.json    : ${totalSauvegarde}`);
    if (totalSauvegarde !== totalEnBase) {
      console.error(
        `ERREUR : quizzes.json contient ${totalSauvegarde} document(s) mais la base en a` +
        ` ${totalEnBase}. La sauvegarde n'est pas à jour. Lancez sauvegarde.mjs d'abord.`,
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log('  Sauvegarde validée : compte exact.\n');
  }

  // ── Étape 1 : Résolution des catégories ──────────────────────────────────
  console.log('── Étape 1 : Résolution des catégories ──────────────────────────');
  const categoriesDocs = [];
  const slugsIntrouvables = [];

  for (const slug of categoriesCibles) {
    const cat = await categories.findOne({ slug });
    if (!cat) {
      slugsIntrouvables.push(slug);
      console.log(`  [${slug}] Non trouvée en base — ignorée.`);
    } else {
      categoriesDocs.push(cat);
      console.log(`  [${slug}] ID : ${cat._id}`);
    }
  }

  if (categoriesDocs.length === 0) {
    console.log('\nAucune catégorie cible trouvée en base. Rien à traiter.');
    await mongoose.disconnect();
    return;
  }
  console.log('');

  // ── Étape 2 : Chargement des questions par catégorie ─────────────────────
  console.log('── Étape 2 : Chargement des questions ───────────────────────────');
  const docsBySlug = new Map();
  let totalDocs = 0;

  for (const cat of categoriesDocs) {
    const docs = await quizzesColl.find({ categorieId: cat._id }).toArray();
    docsBySlug.set(cat.slug, { cat, docs });
    totalDocs += docs.length;
    console.log(`  [${cat.slug}] ${docs.length} question(s) chargée(s).`);
  }
  console.log(`  Total : ${totalDocs} question(s) pour ${categoriesDocs.length} catégorie(s).\n`);

  // ── Étape 3 : Collecte de tous les IDs multi-doc pour comptage des refs ──
  console.log('── Étape 3 : Collecte des IDs (pré-analyse sans refs) ───────────');
  const toutesIdsMulti = new Set();
  const analysesPreliminaires = new Map();

  for (const cat of categoriesDocs) {
    const { docs } = docsBySlug.get(cat.slug);
    const analyse = analyserCategorie(cat, docs, new Map());
    analysesPreliminaires.set(cat.slug, analyse);
    for (const id of analyse.idsMulti) toutesIdsMulti.add(id);
    console.log(
      `  [${cat.slug}] ${analyse.nbDocs} docs, ` +
      `${analyse.nbGroupes} groupes, ` +
      `${analyse.suppressions.length} suppression(s) préliminaire(s), ` +
      `${analyse.conflits.length} conflit(s).`,
    );
  }

  // ── Étape 4 : Comptage des références dans parties ───────────────────────
  console.log('\n── Étape 4 : Références dans la collection parties ──────────────');
  let refMap = new Map();
  if (toutesIdsMulti.size > 0) {
    refMap = await compterReferences([...toutesIdsMulti], parties);
  }

  let totalRefsReponses = 0;
  let totalRefsQuizIds  = 0;
  for (const { reponsesCount, quizIdsCount } of refMap.values()) {
    totalRefsReponses += reponsesCount;
    totalRefsQuizIds  += quizIdsCount;
  }
  console.log(`  Références dans parties.reponses[].quizId : ${totalRefsReponses}`);
  console.log(`  Références dans parties.quizIds[]         : ${totalRefsQuizIds}\n`);

  // ── Étape 5 : Analyse finale avec refs ───────────────────────────────────
  console.log('── Étape 5 : Analyse finale avec références ─────────────────────');
  const analysesFinales = new Map();

  for (const cat of categoriesDocs) {
    const { docs } = docsBySlug.get(cat.slug);
    const analyse = analyserCategorie(cat, docs, refMap);
    analysesFinales.set(cat.slug, analyse);
  }

  // ── Résumé par catégorie ──────────────────────────────────────────────────
  console.log('\n── Résumé par catégorie ─────────────────────────────────────────');
  let totalSuppressions = 0;
  let totalReparations  = 0;
  let totalConflits     = 0;
  let totalRefs         = 0;

  const tousLesSuppressions = [];
  const toutesLesReparations = [];
  const tousLesConflits = [];

  console.log(
    '  ' +
    'Catégorie'.padEnd(22) +
    'Docs'.padStart(6) +
    'Groupes'.padStart(8) +
    'Suppr.'.padStart(8) +
    'Repar.'.padStart(8) +
    'Conflits'.padStart(10) +
    'Refs'.padStart(6),
  );
  console.log('  ' + '─'.repeat(68));

  for (const cat of categoriesDocs) {
    const a = analysesFinales.get(cat.slug);
    const nbRefs = a.suppressions.reduce(
      (acc, { item }) => acc + (refMap.get(item.doc._id.toString()) || { total: 0 }).total,
      0,
    );

    console.log(
      '  ' +
      cat.slug.padEnd(22) +
      String(a.nbDocs).padStart(6) +
      String(a.nbGroupes).padStart(8) +
      String(a.suppressions.length).padStart(8) +
      String(a.aReparer.length).padStart(8) +
      String(a.conflits.length).padStart(10) +
      String(nbRefs).padStart(6),
    );

    totalSuppressions += a.suppressions.length;
    totalReparations  += a.aReparer.length;
    totalConflits     += a.conflits.length;
    totalRefs         += nbRefs;
    tousLesSuppressions.push(...a.suppressions.map((s) => ({ ...s, slug: cat.slug })));
    toutesLesReparations.push(...a.aReparer);
    tousLesConflits.push(...a.conflits.map((c) => ({ ...c, slug: cat.slug })));
  }

  console.log('  ' + '─'.repeat(68));
  console.log(
    '  ' +
    'TOTAL'.padEnd(22) +
    String(totalDocs).padStart(6) +
    ''.padStart(8) +
    String(totalSuppressions).padStart(8) +
    String(totalReparations).padStart(8) +
    String(totalConflits).padStart(10) +
    String(totalRefs).padStart(6),
  );

  // Détail des conflits.
  if (tousLesConflits.length > 0) {
    console.log('\n── Détail des conflits ──────────────────────────────────────────');
    console.log('  Ces groupes ne sont PAS traités. Décision manuelle requise.\n');
    for (const { items, raison, slug } of tousLesConflits) {
      const enonce = normaliser(fixMojibake(items[0].doc.enonce));
      console.log(`  [${slug}] "${enonce.slice(0, 55)}..." (raison : ${raison})`);
      for (const item of items) {
        const refs = (refMap.get(item.doc._id.toString()) || { total: 0 }).total;
        console.log(
          `    ID: ${item.doc._id}  propre: ${item.propre}` +
          `  reponse: "${fixMojibake(item.doc.reponse).slice(0, 35)}"  refs: ${refs}`,
        );
      }
      console.log('');
    }
  }

  // ── Étape 6 : Garde-fous et application ──────────────────────────────────
  if (!simulationMode) {
    console.log('\n── Étape 6 : Garde-fous de volume ───────────────────────────────');

    if (totalSuppressions > MAX_SUPPRESSIONS) {
      console.error(
        `ERREUR GARDE-FOU : ${totalSuppressions} suppressions prévues dépassent` +
        ` la limite de ${MAX_SUPPRESSIONS}.`,
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(
      `  Suppressions prévues : ${totalSuppressions} <= ${MAX_SUPPRESSIONS} (OK)`,
    );

    // Vérifier que toutes les suppressions ciblent des catégories autorisées.
    const idsCatsAutorisees = new Set(categoriesDocs.map((c) => c._id.toString()));
    const horsListe = tousLesSuppressions.filter(
      ({ item }) => !idsCatsAutorisees.has(item.doc.categorieId.toString()),
    );
    if (horsListe.length > 0) {
      console.error(
        `ERREUR GARDE-FOU : ${horsListe.length} document(s) à supprimer hors catégories autorisées.`,
      );
      for (const { item } of horsListe) {
        console.error(`  ID: ${item.doc._id}  categorieId: ${item.doc.categorieId}`);
      }
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`  Toutes les suppressions ciblent des catégories autorisées (OK)\n`);

    console.log('── Étape 7 : Application ────────────────────────────────────────');

    // Écrire doublons-supprimes.json avant toute suppression.
    if (tousLesSuppressions.length > 0) {
      const supprimees = tousLesSuppressions.map(({ item, keptId, slug }) => ({
        _migration_slug: slug,
        _migration_keptId: keptId.toString(),
        ...toEJSON(item.doc),
      }));
      const suppFile = path.join(sauvegDir, 'doublons-supprimes.json');
      writeFileSync(suppFile, JSON.stringify(supprimees, null, 2), 'utf8');
      console.log(
        `  doublons-supprimes.json écrit : ${suppFile} (${tousLesSuppressions.length} documents)`,
      );
    }

    // Réaffectation des références puis suppressions.
    let nbSupp = 0;
    let totalRefsReaffectees = 0;
    const nonSupprimees = [];

    for (const { item, keptId } of tousLesSuppressions) {
      const deletedOid = item.doc._id;
      const keptOid    = new mongoose.Types.ObjectId(keptId.toString());

      let reaffResult = { reponsesModified: 0, quizIdsModified: 0 };
      try {
        reaffResult = await reaffecterRefs(deletedOid, keptOid, parties);
        totalRefsReaffectees += reaffResult.reponsesModified + reaffResult.quizIdsModified;
      } catch (err) {
        nonSupprimees.push({
          id: deletedOid.toString(),
          raison: `réaffectation impossible : ${err.message}`,
        });
        continue;
      }

      await quizzesColl.deleteOne({ _id: deletedOid });
      nbSupp++;
    }

    // Réparations ($set).
    let nbRepares = 0;
    for (const item of toutesLesReparations) {
      const fixedAssertions = Array.isArray(item.doc.assertions)
        ? item.doc.assertions.map(fixMojibake)
        : [];
      await quizzesColl.updateOne(
        { _id: item.doc._id },
        {
          $set: {
            enonce:     fixMojibake(item.doc.enonce),
            assertions: fixedAssertions,
            reponse:    fixMojibake(item.doc.reponse),
          },
        },
      );
      nbRepares++;
    }

    console.log(`  Questions supprimées     : ${nbSupp}`);
    console.log(`  Questions réparées ($set): ${nbRepares}`);
    console.log(`  Références réaffectées   : ${totalRefsReaffectees}`);

    if (nonSupprimees.length > 0) {
      console.log(`  AVERTISSEMENT : ${nonSupprimees.length} document(s) non supprimé(s) :`);
      for (const { id, raison } of nonSupprimees) {
        console.log(`    ID ${id} : ${raison}`);
      }
    }
  }

  await mongoose.disconnect();

  // ── Résumé final ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  if (simulationMode) {
    console.log(' SIMULATION terminée (aucune donnée modifiée).');
    console.log(`   Total questions analysées : ${totalDocs}`);
    console.log(`   Total suppressions prévues : ${totalSuppressions}`);
    console.log(`   Total réparations prévues ($set) : ${totalReparations}`);
    console.log(`   Total conflits exclus : ${totalConflits}`);
    console.log(`   Total références à réaffecter : ${totalRefs}`);
    if (slugsIntrouvables.length > 0) {
      console.log(`   Catégories introuvables en base : ${slugsIntrouvables.join(', ')}`);
    }
    console.log(' Relancez avec --appliquer --sauvegarde <dossier> pour écrire.');
  } else {
    console.log(' MIGRATION terminée.');
  }
  console.log('══════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Erreur fatale :', err.message);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
