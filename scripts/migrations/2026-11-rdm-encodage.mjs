/**
 * 2026-11-rdm-encodage.mjs — Dédoublonnage des questions RDM (M-20261126-10, rév. 2).
 *
 * Contexte : le seed a été lancé deux fois. La première fois avec le fichier rdm.json
 * mal encodé (mojibake), la seconde fois avec le fichier corrigé (PR #6). La base
 * contient donc ~200 questions cassées + ~200 questions propres = ~400 questions RDM.
 *
 * Ce script :
 *   1. Calcule la forme réparée (fixMojibake) de chaque question RDM en base.
 *   2. Regroupe les questions par énoncé réparé normalisé (espaces, casse).
 *   3. Dans chaque groupe de plusieurs documents :
 *        - garde UNE question (propre d'abord ; à égalité : plus référencée, puis plus ancienne) ;
 *        - supprime les autres UNIQUEMENT si elles sont cassées ET ont une jumelle propre ;
 *        - une cassée sans jumelle propre est réparée ($set) et non supprimée ;
 *        - si la bonne réponse diffère entre membres du groupe → exclusion + liste séparée.
 *   4. Avant toute suppression : réaffecte les références (parties.reponses[].quizId,
 *      parties.quizIds[]) vers la question gardée.
 *   5. Écrit rdm-supprimees.json (documents complets) avant de supprimer.
 *
 * Usage :
 *   node scripts/migrations/2026-11-rdm-encodage.mjs [--simulation]
 *   node scripts/migrations/2026-11-rdm-encodage.mjs --appliquer --sauvegarde <dossier>
 *
 * - Mode par défaut : --simulation (lecture seule).
 * - Écriture uniquement avec --appliquer + --sauvegarde pointant vers une sauvegarde
 *   existante, datée d'aujourd'hui, contenant quizzes.json.
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
  console.error('Exemple : node scripts/migrations/2026-11-rdm-encodage.mjs --appliquer --sauvegarde E:/Nathan/formation-elmes-quiz/sauvegardes/2026-11-26');
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

  // Vérifier que le dossier est daté d'aujourd'hui (nom contient YYYY-MM-DD).
  const today = new Date().toISOString().slice(0, 10); // 2026-11-26
  const folderName = path.basename(sauvegDir);
  if (!folderName.includes(today)) {
    console.error(`ERREUR : la sauvegarde '${folderName}' ne semble pas datée d'aujourd'hui (${today}).`);
    console.error('Lancez d\'abord : node scripts/migrations/sauvegarde.mjs <dossier> --toutes');
    process.exit(1);
  }

  const quizzesFile = path.join(sauvegDir, 'quizzes.json');
  if (!existsSync(quizzesFile)) {
    console.error(`ERREUR : quizzes.json introuvable dans ${sauvegDir}.`);
    console.error('Lancez d\'abord : node scripts/migrations/sauvegarde.mjs <dossier> --toutes');
    process.exit(1);
  }

  console.log(`Sauvegarde validée : ${sauvegDir}`);
  console.log(`  quizzes.json présent.\n`);
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
console.log(' Migration 2026-11 — Dédoublonnage RDM (M-20261126-10, rév. 2)');
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
    console.error('ERREUR : MONGO_URI introuvable. Vérifiez .env.local ou .env à la racine du projet.');
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

  const nbPropres  = enriched.filter((e) => e.propre).length;
  const nbCassees  = enriched.filter((e) => !e.propre).length;
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

  // ── Étape 4 : Analyse par groupe ──────────────────────────────────────────
  console.log('── Étape 4 : Analyse des groupes ────────────────────────────────');

  const aReparer   = []; // { doc, fixedEnonce, fixedAssertions, fixedReponse }  → $set
  const aSupprimer = []; // { item, keptId }  → deleteOne (après réaffectation)
  const conflits   = []; // { items }  → exclus, listés séparément
  // Questions propres supplémentaires (doubles propres) : hors périmètre, signalées seulement.
  const doublesPropresBruts = [];

  // Toutes les IDs potentiellement impliquées dans les groupes multi pour comptage des refs.
  const idsMulti = new Set();

  for (const [, items] of groupes) {
    if (items.length === 1) {
      const item = items[0];
      if (!item.propre) {
        aReparer.push(item);
      }
      continue;
    }

    // Groupe avec plusieurs documents.
    for (const item of items) idsMulti.add(item.doc._id.toString());

    const propres  = items.filter((i) => i.propre);
    const cassees  = items.filter((i) => !i.propre);

    // Détection de conflits sur la bonne réponse (après réparation).
    const reponsesUniques = new Set(items.map((i) => i.fixedReponse.trim()));
    if (reponsesUniques.size > 1) {
      conflits.push({ items });
      continue;
    }

    if (propres.length === 0) {
      // Toutes les questions du groupe sont cassées : on les répare toutes, sans suppression.
      // (Pas de jumelle propre → autorisation de suppression non applicable.)
      for (const item of cassees) {
        aReparer.push(item);
      }
      continue;
    }

    // Il y a au moins une propre. Les cassées ont leur jumelle propre → suppression autorisée.
    // Parmi les propres, choisir la gagnante (plus referencée, puis plus ancienne).
    // Le comptage précis des refs est fait après ; ici on met toutes les propres comme
    // candidates et on choisira après le comptage.

    // Les cassées sont toutes à supprimer en faveur de la gagnante propre.
    for (const item of cassees) {
      aSupprimer.push({ item, keptId: null /* rempli après sélection du gagnant */ });
    }

    // Si plusieurs propres (double seed du fichier propre) : hors périmètre de suppression,
    // mais on le signale. On choisira la gagnante après refs.
    if (propres.length > 1) {
      doublesPropresBruts.push({ items: propres });
    }
  }

  console.log(`  Groupes à 1 doc cassé → réparation ($set)   : ${aReparer.length}`);
  console.log(`  Cassées avec jumelle propre → suppression    : ${aSupprimer.length}`);
  console.log(`  Groupes en conflit (bonne réponse différente): ${conflits.length}`);
  if (doublesPropresBruts.length > 0) {
    console.log(`  Groupes avec plusieurs propres (hors périmètre) : ${doublesPropresBruts.length}`);
  }

  // ── Étape 5 : Comptage des références ────────────────────────────────────
  console.log('\n── Étape 5 : Références dans la collection parties ──────────────');

  // On compte les refs de toutes les IDs des groupes multi.
  const toutesLesIds = [...idsMulti];
  let refMap = new Map();
  if (toutesLesIds.length > 0) {
    refMap = await compterReferences(toutesLesIds, parties);
  }

  // Afficher le résumé des références par collection.
  let totalRefsReponses = 0;
  let totalRefsQuizIds  = 0;
  for (const { reponsesCount, quizIdsCount } of refMap.values()) {
    totalRefsReponses += reponsesCount;
    totalRefsQuizIds  += quizIdsCount;
  }
  console.log(`  Références dans parties.reponses[].quizId : ${totalRefsReponses}`);
  console.log(`  Références dans parties.quizIds[]         : ${totalRefsQuizIds}`);

  // Résoudre les gagnants pour chaque groupe multi-doc avec propre.
  // Regrouper les suppressions par groupe pour choisir le bon gagnant.
  const suppressionFinals = []; // { item, keptId, refCount }
  {
    // Reconstruire les groupes multi propres pour choisir la gagnante.
    for (const [, items] of groupes) {
      if (items.length <= 1) continue;
      const propres = items.filter((i) => i.propre);
      const cassees = items.filter((i) => !i.propre);
      if (propres.length === 0) continue;

      const reponsesUniques = new Set(items.map((i) => i.fixedReponse.trim()));
      if (reponsesUniques.size > 1) continue; // conflit, déjà traité

      // Choisir la gagnante parmi les propres :
      // 1. Plus référencée (total refs), 2. Plus ancienne (_id plus petit = plus tôt inséré).
      propres.sort((a, b) => {
        const ra = (refMap.get(a.doc._id.toString()) || { total: 0 }).total;
        const rb = (refMap.get(b.doc._id.toString()) || { total: 0 }).total;
        if (rb !== ra) return rb - ra; // décroissant par refs
        // Plus ancienne : ObjectId lexicographique croissant.
        return a.doc._id.toString() < b.doc._id.toString() ? -1 : 1;
      });
      const gagnante = propres[0];

      // Les cassées → suppression avec keptId = gagnante.
      for (const item of cassees) {
        suppressionFinals.push({ item, keptId: gagnante.doc._id });
      }
      // Les propres perdantes (doublons propres) → hors périmètre, signalées seulement.
    }
  }

  // ── Résumé détaillé des suppressions prévues ─────────────────────────────
  console.log(`\n── Résumé des actions prévues ───────────────────────────────────`);
  console.log(`  Suppressions prévues (cassées + jumelle propre) : ${suppressionFinals.length}`);
  console.log(`  Réparations prévues ($set, cassées isolées)     : ${aReparer.length}`);
  console.log(`  Conflits exclus (bonne réponse ambiguë)         : ${conflits.length}`);

  if (conflits.length > 0) {
    console.log('\n── Détail des conflits (bonne réponse ambiguë) ─────────────────');
    console.log('  Ces groupes ne sont PAS traités. Décision manuelle requise.\n');
    for (const { items } of conflits) {
      console.log(`  Groupe "${normaliser(items[0].fixedEnonce).slice(0, 60)}..." :`);
      for (const item of items) {
        const refs = (refMap.get(item.doc._id.toString()) || { total: 0 }).total;
        console.log(`    ID: ${item.doc._id}  propre: ${item.propre}  reponse: "${item.fixedReponse.slice(0, 40)}"  refs: ${refs}`);
        // Différences détectées :
        const diffEnonce   = item.fixedEnonce    !== items[0].fixedEnonce;
        const diffReponse  = item.fixedReponse   !== items[0].fixedReponse;
        const diffAssertions = JSON.stringify(item.fixedAssertions) !== JSON.stringify(items[0].fixedAssertions);
        const diffs = [];
        if (diffEnonce)    diffs.push('enonce');
        if (diffReponse)   diffs.push('reponse (CONFLIT)');
        if (diffAssertions) diffs.push('assertions (ordre ou texte)');
        if (diffs.length) console.log(`      Différences : ${diffs.join(', ')}`);
      }
      console.log('');
    }
  }

  if (doublesPropresBruts.length > 0) {
    console.log('── Doubles propres détectés (hors périmètre) ───────────────────');
    console.log('  Ces doublons sont tous propres. La suppression n\'est pas autorisée pour ce cas.');
    for (const { items } of doublesPropresBruts) {
      console.log(`  "${normaliser(items[0].fixedEnonce).slice(0, 60)}..." :`);
      for (const item of items) {
        console.log(`    ID: ${item.doc._id}`);
      }
    }
    console.log('');
  }

  // ── Références à réaffecter par suppression prévue ───────────────────────
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
    console.log('\n── Étape 6 : Application ────────────────────────────────────────');

    const sauvegDir = path.resolve(sauvegArg);

    // Écrire rdm-supprimees.json avant toute suppression.
    if (suppressionFinals.length > 0) {
      const supprimees = suppressionFinals.map(({ item, keptId }) => ({
        ...toEJSON(item.doc),
        _migration_keptId: keptId.toString(),
      }));
      const suppFile = path.join(sauvegDir, 'rdm-supprimees.json');
      writeFileSync(suppFile, JSON.stringify(supprimees, null, 2), 'utf8');
      console.log(`  rdm-supprimees.json écrit : ${suppFile} (${suppressionFinals.length} documents)`);
    }

    // Réaffectation des références puis suppression.
    let nbSupp = 0;
    let totalRefsReaffectees = 0;
    const nonSupprimees = []; // IDs qu'on ne pouvait pas réaffecter

    for (const { item, keptId } of suppressionFinals) {
      const deletedOid = item.doc._id;
      const keptOid    = new mongoose.Types.ObjectId(keptId.toString());

      // Réaffecter les références avant suppression.
      let reaffResult = { reponsesModified: 0, quizIdsModified: 0 };
      try {
        reaffResult = await reaffecterRefs(deletedOid, keptOid, parties);
        totalRefsReaffectees += reaffResult.reponsesModified + reaffResult.quizIdsModified;
      } catch (err) {
        nonSupprimees.push({ id: deletedOid.toString(), raison: `réaffectation impossible : ${err.message}` });
        continue;
      }

      // Supprimer le document cassé.
      await quizzes.deleteOne({ _id: deletedOid });
      nbSupp++;
    }

    // Réparations ($set) pour les cassées isolées.
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
    console.log(`   Groupes distincts          : ${nbGroupes}`);
    console.log(`   Suppressions prévues       : ${suppressionFinals.length}`);
    console.log(`   Réparations prévues ($set) : ${aReparer.length}`);
    console.log(`   Conflits exclus            : ${conflits.length}`);
    console.log(`   Doubles propres (hors périmètre) : ${doublesPropresBruts.length}`);
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
