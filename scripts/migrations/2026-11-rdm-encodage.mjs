/**
 * 2026-11-rdm-encodage.mjs — Dédoublonnage des questions RDM (M-20261126-10, rév. 3).
 *
 * Contexte : le seed a été lancé deux fois. La base contient ~400 documents RDM pour
 * ~200 questions distinctes. Ce script supprime tous les doublons et ne conserve
 * qu'une seule question par énoncé.
 *
 * Ce script :
 *   1. Calcule la forme réparée (fixMojibake) de chaque question RDM en base.
 *   2. Regroupe les questions par énoncé réparé normalisé (espaces, casse).
 *   3. Dans chaque groupe avec plusieurs documents :
 *        - choisit UN gagnant : propre d'abord, sinon le plus référencé, sinon le
 *          plus ancien (_id) ;
 *        - si le gagnant est cassé, le répare ($set) ;
 *        - supprime TOUTES les autres copies du groupe (cassées ou propres) ;
 *        - si la bonne réponse diffère entre membres du groupe → exclusion + liste
 *          séparée (conflit, aucune action sur ce groupe).
 *   4. Avant toute suppression : réaffecte les références (parties.reponses[].quizId,
 *      parties.quizIds[]) vers la question gardée.
 *   5. Écrit rdm-supprimees.json (documents complets) avant de supprimer.
 *
 * Garde-fous (mode --appliquer) :
 *   - Refus si les suppressions prévues dépassent 200.
 *   - Refus si une suppression vise un document hors catégorie RDM.
 *
 * Usage :
 *   node scripts/migrations/2026-11-rdm-encodage.mjs [--simulation]
 *   node scripts/migrations/2026-11-rdm-encodage.mjs --appliquer --sauvegarde <dossier>
 *
 * - Mode par défaut : --simulation (lecture seule).
 * - Écriture uniquement avec --appliquer + --sauvegarde pointant vers une sauvegarde
 *   existante, dont le nom commence par la date du jour, contenant quizzes.json
 *   avec au moins 400 documents de la catégorie RDM.
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

/** ID de la catégorie RDM en production (connue d'après le seed et les sauvegardes). */
const RDM_CAT_ID = '6ad5fd1aaad96ac2b419bc51';

/** Nombre minimum de documents RDM attendus dans la sauvegarde. */
const MIN_RDM_BACKUP = 400;

/** Nombre maximum de suppressions autorisées en mode --appliquer. */
const MAX_SUPPRESSIONS = 200;

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

const sauvegArg = (() => {
  const idx = args.indexOf('--sauvegarde');
  if (idx === -1) return null;
  return args[idx + 1] || null;
})();

if (!simulationMode && !sauvegArg) {
  console.error('ERREUR : --appliquer requiert --sauvegarde <dossier>.');
  console.error(
    'Exemple : node scripts/migrations/2026-11-rdm-encodage.mjs --appliquer ' +
    '--sauvegarde E:/Nathan/formation-elmes-quiz/sauvegardes/2026-11-26-avant-rdm',
  );
  process.exit(1);
}

// ── Validation de la sauvegarde (obligatoire avant --appliquer) ──────────────

function validerSauvegarde(sauvegDir) {
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
      `E:/Nathan/formation-elmes-quiz/sauvegardes/${today}-avant-rdm --toutes`,
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

  // Vérifier que quizzes.json contient au moins MIN_RDM_BACKUP documents RDM.
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

  const rdmCount = quizzesData.filter((doc) => {
    const catId = doc.categorieId;
    if (!catId) return false;
    if (typeof catId === 'string') return catId === RDM_CAT_ID;
    if (catId.$oid) return catId.$oid === RDM_CAT_ID;
    return false;
  }).length;

  if (rdmCount < MIN_RDM_BACKUP) {
    console.error(
      `ERREUR : quizzes.json contient seulement ${rdmCount} document(s) de la catégorie RDM` +
      ` (attendu : >= ${MIN_RDM_BACKUP}).`,
    );
    console.error(
      'Cette sauvegarde semble ancienne ou partielle. Lancez sauvegarde.mjs avec --toutes.',
    );
    process.exit(1);
  }

  console.log(`Sauvegarde validée : ${sauvegDir}`);
  console.log(
    `  quizzes.json : ${quizzesData.length} documents au total, ${rdmCount} de la catégorie RDM.\n`,
  );
}

// ── Sérialisation EJSON (compatible avec sauvegarde.mjs) ─────────────────────

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

/** Normalise un énoncé pour le regroupement (casse, espaces). */
function normaliser(str) {
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
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

// ── Comptage des références dans les collections ──────────────────────────────

/**
 * Compte les références à chaque ID dans la collection `parties`.
 * Retourne une Map<idStr, { reponsesCount, quizIdsCount, total }>.
 */
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

/**
 * Réaffecte toutes les références d'une question supprimée (deletedOid)
 * vers la question gardée (keptOid) dans la collection `parties`.
 * Retourne { reponsesModified, quizIdsModified }.
 */
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

// ── Bannière ──────────────────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════════════════════════');
console.log(' Migration 2026-11 — Dédoublonnage RDM (M-20261126-10, rév. 3)');
console.log(' Mode : ' + (simulationMode
  ? 'SIMULATION (lecture seule, aucune écriture)'
  : 'APPLIQUER (écriture en base)'));
console.log('══════════════════════════════════════════════════════════════════\n');

if (!simulationMode) {
  console.log('ATTENTION : ce script va modifier et supprimer des données en production.');
  validerSauvegarde(path.resolve(sauvegArg));
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

  const db = mongoose.connection.db;
  const categories = db.collection('categories');
  const quizzes   = db.collection('quizzes');
  const parties   = db.collection('parties');

  // ── Étape 1 : Vérifier la présence de la catégorie RDM ───────────────────
  console.log('── Étape 1 : Catégorie RDM ──────────────────────────────────────');
  const rdmCategorie = await categories.findOne({ slug: 'rdm' });

  if (!rdmCategorie) {
    console.log('  Catégorie RDM introuvable. Aucune action nécessaire.\n');
    await mongoose.disconnect();
    console.log('══════════════════════════════════════════════════════════════════');
    console.log(simulationMode ? ' SIMULATION terminée.' : ' MIGRATION terminée.');
    console.log(' Aucune question RDM en base. Rien à traiter.');
    console.log('══════════════════════════════════════════════════════════════════\n');
    return;
  }
  console.log(`  ID catégorie RDM : ${rdmCategorie._id}\n`);

  // ── Étape 2 : Chargement et enrichissement des questions RDM ─────────────
  console.log('── Étape 2 : Chargement des questions RDM ───────────────────────');
  const rdmDocs = await quizzes.find({ categorieId: rdmCategorie._id }).toArray();
  console.log(`  Total questions RDM en base : ${rdmDocs.length}\n`);

  if (rdmDocs.length === 0) {
    console.log('  Aucune question RDM. Rien à traiter.');
    await mongoose.disconnect();
    return;
  }

  // Enrichir chaque document avec sa forme réparée et son statut.
  const enriched = rdmDocs.map((doc) => {
    const fixedEnonce    = fixMojibake(doc.enonce);
    const fixedAssertions = Array.isArray(doc.assertions)
      ? doc.assertions.map(fixMojibake)
      : [];
    const fixedReponse   = fixMojibake(doc.reponse);
    const propre         = estPropre(doc);
    const cleNormalisee  = normaliser(fixedEnonce);
    return { doc, fixedEnonce, fixedAssertions, fixedReponse, propre, cleNormalisee };
  });

  const nbPropres = enriched.filter((e) => e.propre).length;
  const nbCassees = enriched.filter((e) => !e.propre).length;
  console.log(`  Questions déjà propres  : ${nbPropres}`);
  console.log(`  Questions cassées (mojibake détecté) : ${nbCassees}\n`);

  // ── Étape 3 : Regroupement par énoncé normalisé ───────────────────────────
  console.log('── Étape 3 : Regroupement par énoncé réparé ─────────────────────');
  const groupes = new Map(); // cleNormalisee → enriched[]
  for (const item of enriched) {
    const liste = groupes.get(item.cleNormalisee) || [];
    liste.push(item);
    groupes.set(item.cleNormalisee, liste);
  }

  const nbGroupes = groupes.size;
  const nbSingles = [...groupes.values()].filter((g) => g.length === 1).length;
  const nbMulti   = nbGroupes - nbSingles;
  console.log(`  Groupes distincts        : ${nbGroupes}`);
  console.log(`  Groupes avec 1 document  : ${nbSingles}`);
  console.log(`  Groupes avec N documents : ${nbMulti}\n`);

  // ── Étape 4 : Première passe — détection des conflits et collecte des IDs ─
  console.log('── Étape 4 : Analyse des groupes ────────────────────────────────');

  /** Singles cassées : à réparer ($set), aucune suppression. */
  const aReparerSingles = [];
  /** Groupes en conflit (bonne réponse ambiguë) : exclus de tout traitement. */
  const conflits = [];
  /** Groupes multi-doc sans conflit, à traiter après comptage des refs. */
  const multiGroupes = [];
  /** Toutes les IDs des groupes multi (pour compter les refs). */
  const idsMulti = new Set();

  for (const [, items] of groupes) {
    if (items.length === 1) {
      if (!items[0].propre) aReparerSingles.push(items[0]);
      continue;
    }

    // Détection de conflits sur la bonne réponse (après réparation).
    const reponsesUniques = new Set(items.map((i) => i.fixedReponse.trim()));
    if (reponsesUniques.size > 1) {
      conflits.push({ items });
      continue;
    }

    // Groupe multi-doc sans conflit.
    for (const item of items) idsMulti.add(item.doc._id.toString());
    multiGroupes.push(items);
  }

  console.log(`  Groupes à 1 doc cassé → réparation ($set)   : ${aReparerSingles.length}`);
  console.log(`  Groupes multi-doc sans conflit (à traiter)  : ${multiGroupes.length}`);
  console.log(`  Groupes en conflit (bonne réponse différente): ${conflits.length}`);

  // ── Étape 5 : Comptage des références ────────────────────────────────────
  console.log('\n── Étape 5 : Références dans la collection parties ──────────────');

  const toutesLesIds = [...idsMulti];
  let refMap = new Map();
  if (toutesLesIds.length > 0) {
    refMap = await compterReferences(toutesLesIds, parties);
  }

  let totalRefsReponses = 0;
  let totalRefsQuizIds  = 0;
  for (const { reponsesCount, quizIdsCount } of refMap.values()) {
    totalRefsReponses += reponsesCount;
    totalRefsQuizIds  += quizIdsCount;
  }
  console.log(`  Références dans parties.reponses[].quizId : ${totalRefsReponses}`);
  console.log(`  Références dans parties.quizIds[]         : ${totalRefsQuizIds}`);

  // ── Résolution des gagnants et constitution des listes finales ───────────
  //
  // Pour chaque groupe multi-doc (sans conflit) :
  //   1. Trier : propre d'abord, puis plus référencé, puis plus ancien (_id).
  //   2. Gagnant = premier après tri.
  //   3. Si gagnant cassé → réparation ($set).
  //   4. Tous les autres → suppression.

  const aReparerMulti    = []; // gagnants cassés de groupes multi
  const suppressionFinals = []; // { item, keptId }

  for (const items of multiGroupes) {
    // Tri : propre desc > refs desc > _id asc.
    const sorted = [...items].sort((a, b) => {
      // propre en premier (true > false).
      if (a.propre !== b.propre) return a.propre ? -1 : 1;
      // Plus référencé en premier.
      const ra = (refMap.get(a.doc._id.toString()) || { total: 0 }).total;
      const rb = (refMap.get(b.doc._id.toString()) || { total: 0 }).total;
      if (rb !== ra) return rb - ra;
      // Plus ancien en premier (ObjectId lexicographique croissant).
      return a.doc._id.toString() < b.doc._id.toString() ? -1 : 1;
    });

    const gagnant = sorted[0];

    // Si le gagnant est cassé, le réparer.
    if (!gagnant.propre) {
      aReparerMulti.push(gagnant);
    }

    // Toutes les autres copies → à supprimer.
    for (let i = 1; i < sorted.length; i++) {
      suppressionFinals.push({ item: sorted[i], keptId: gagnant.doc._id });
    }
  }

  // Liste finale des réparations (singles + gagnants cassés de groupes multi).
  const aReparer = [...aReparerSingles, ...aReparerMulti];

  // ── Résumé des actions prévues ───────────────────────────────────────────
  console.log('\n── Résumé des actions prévues ───────────────────────────────────');
  console.log(`  Gardées (1 par groupe + toutes les singles)  : ${nbGroupes}`);
  console.log(`  Suppressions prévues (toutes les copies en surnombre) : ${suppressionFinals.length}`);
  console.log(`  Réparations prévues ($set)                   : ${aReparer.length}`);
  console.log(`    dont gagnants de groupes multi cassés      : ${aReparerMulti.length}`);
  console.log(`    dont singles cassées                       : ${aReparerSingles.length}`);
  console.log(`  Conflits exclus (bonne réponse ambiguë)      : ${conflits.length}`);

  if (conflits.length > 0) {
    console.log('\n── Détail des conflits (bonne réponse ambiguë) ─────────────────');
    console.log('  Ces groupes ne sont PAS traités. Décision manuelle requise.\n');
    for (const { items } of conflits) {
      console.log(`  Groupe "${normaliser(items[0].fixedEnonce).slice(0, 60)}..." :`);
      for (const item of items) {
        const refs = (refMap.get(item.doc._id.toString()) || { total: 0 }).total;
        console.log(
          `    ID: ${item.doc._id}  propre: ${item.propre}` +
          `  reponse: "${item.fixedReponse.slice(0, 40)}"  refs: ${refs}`,
        );
        const diffs = [];
        if (item.fixedEnonce !== items[0].fixedEnonce) diffs.push('enonce');
        if (item.fixedReponse !== items[0].fixedReponse) diffs.push('reponse (CONFLIT)');
        if (JSON.stringify(item.fixedAssertions) !== JSON.stringify(items[0].fixedAssertions)) {
          diffs.push('assertions');
        }
        if (diffs.length) console.log(`      Différences : ${diffs.join(', ')}`);
      }
      console.log('');
    }
  }

  // Références à réaffecter.
  if (suppressionFinals.length > 0) {
    let nbAvecRefs = 0;
    let totalRefsAReaffecter = 0;
    for (const { item } of suppressionFinals) {
      const refs = refMap.get(item.doc._id.toString()) || { total: 0 };
      if (refs.total > 0) {
        nbAvecRefs++;
        totalRefsAReaffecter += refs.total;
      }
    }
    console.log(`\n  Questions à supprimer avec au moins 1 référence : ${nbAvecRefs}`);
    console.log(`  Total références à réaffecter dans parties       : ${totalRefsAReaffecter}`);
    if (nbAvecRefs > 0) {
      console.log('  (Avec --appliquer : références réaffectées avant suppression.)');
    }
  }

  // ── Étape 6 : Application (seulement avec --appliquer) ───────────────────
  if (!simulationMode) {
    console.log('\n── Étape 6 : Garde-fous de volume ───────────────────────────────');

    // Garde-fou 1 : nombre de suppressions.
    if (suppressionFinals.length > MAX_SUPPRESSIONS) {
      console.error(
        `ERREUR GARDE-FOU : ${suppressionFinals.length} suppressions prévues dépassent` +
        ` la limite de ${MAX_SUPPRESSIONS}.`,
      );
      console.error('Vérifiez la simulation et ajustez si nécessaire.');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(
      `  Suppressions prévues : ${suppressionFinals.length} <= ${MAX_SUPPRESSIONS} (OK)`,
    );

    // Garde-fou 2 : tous les documents à supprimer doivent appartenir à la catégorie RDM.
    const horsRDM = suppressionFinals.filter(
      ({ item }) => item.doc.categorieId.toString() !== rdmCategorie._id.toString(),
    );
    if (horsRDM.length > 0) {
      console.error(
        `ERREUR GARDE-FOU : ${horsRDM.length} document(s) à supprimer hors catégorie RDM :`,
      );
      for (const { item } of horsRDM) {
        console.error(`  ID: ${item.doc._id}  categorieId: ${item.doc.categorieId}`);
      }
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log('  Toutes les suppressions ciblent la catégorie RDM (OK)\n');

    console.log('── Étape 7 : Application ────────────────────────────────────────');

    const sauvegDir = path.resolve(sauvegArg);

    // Écrire rdm-supprimees.json avant toute suppression.
    if (suppressionFinals.length > 0) {
      const supprimees = suppressionFinals.map(({ item, keptId }) => ({
        ...toEJSON(item.doc),
        _migration_keptId: keptId.toString(),
      }));
      const suppFile = path.join(sauvegDir, 'rdm-supprimees.json');
      writeFileSync(suppFile, JSON.stringify(supprimees, null, 2), 'utf8');
      console.log(
        `  rdm-supprimees.json écrit : ${suppFile} (${suppressionFinals.length} documents)`,
      );
    }

    // Réaffectation des références puis suppression.
    let nbSupp = 0;
    let totalRefsReaffectees = 0;
    const nonSupprimees = [];

    for (const { item, keptId } of suppressionFinals) {
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

      await quizzes.deleteOne({ _id: deletedOid });
      nbSupp++;
    }

    // Réparations ($set) pour les questions cassées à conserver.
    let nbRepares = 0;
    for (const item of aReparer) {
      await quizzes.updateOne(
        { _id: item.doc._id },
        {
          $set: {
            enonce:     item.fixedEnonce,
            assertions: item.fixedAssertions,
            reponse:    item.fixedReponse,
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
    console.log(`   Total questions RDM en base : ${rdmDocs.length}`);
    console.log(`   Groupes distincts (questions uniques) : ${nbGroupes}`);
    console.log(`   Suppressions prévues : ${suppressionFinals.length}`);
    console.log(`   Réparations prévues ($set) : ${aReparer.length}`);
    console.log(`   Conflits exclus : ${conflits.length}`);
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
