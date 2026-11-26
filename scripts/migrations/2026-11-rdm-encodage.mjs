/**
 * 2026-11-rdm-encodage.mjs — Migration correction encodage mojibake RDM (M-20261126-10).
 *
 * Associe chaque question RDM en base à sa version propre dans rdm.json (déjà
 * corrigé par la PR #6 / fix/m8-rdm-encodage). Met à jour les champs enonce,
 * assertions et reponse si le texte en base contient du mojibake.
 *
 * Usage :
 *   node scripts/migrations/2026-11-rdm-encodage.mjs [--simulation] [--appliquer]
 *
 * - Mode par défaut : --simulation (lecture seule, aucune écriture).
 * - Écriture uniquement avec --appliquer.
 * - Idempotent : relancer après une première exécution donne 0 modification.
 * - Aucune suppression, aucune insertion.
 * - Lit MONGO_URI depuis l'environnement ou .env.local / .env à la racine du projet.
 * - N'affiche jamais l'URI ni de données personnelles (seulement des comptes).
 *
 * Prérequis :
 *   - La sauvegarde (sauvegarde.mjs) doit avoir été lancée avant d'utiliser --appliquer.
 *   - rdm.json (scripts/seed/data/rdm.json) doit être la version corrigée (PR #6).
 *   - Ne pas relancer le seed RDM avant cette migration (risque de doublons).
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
const simulationMode = !args.includes('--appliquer');

if (args.includes('--simulation') && args.includes('--appliquer')) {
  console.error('ERREUR : --simulation et --appliquer sont mutuellement exclusifs.');
  process.exit(1);
}

console.log('══════════════════════════════════════════════════════════════════');
console.log(' Migration 2026-11 — Correction encodage RDM (M-20261126-10)');
console.log(' Mode : ' + (simulationMode ? 'SIMULATION (lecture seule, aucune écriture)' : 'APPLIQUER (écriture en base)'));
console.log('══════════════════════════════════════════════════════════════════\n');

if (!simulationMode) {
  console.log('ATTENTION : ce script va modifier les données en production.');
  console.log('Vérifiez qu\'une sauvegarde a été faite avec sauvegarde.mjs.\n');
}

// ── Table de correspondance Windows-1252 (0x80-0x9F) ─────────────────────────
// Code point Unicode du caractère mojibake → octet Windows-1252 d'origine.
// Identique à la table de fix-rdm-encoding.js (PR #6).

const W1252_REVERSE = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ  (crucial : σ = 0xCF 0x83)
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

/**
 * Tente de décoder une séquence de caractères mojibake en UTF-8 original.
 * Retourne la chaîne décodée, ou null si impossible.
 */
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
    if (decoded === seq) return null; // Pas de changement
    return decoded;
  } catch (_) {
    return null;
  }
}

/**
 * Corrige le mojibake dans une chaîne.
 * Idempotent : si la chaîne est déjà correcte, elle est renvoyée inchangée.
 */
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

// ── Chargement de rdm.json (version corrigée) ────────────────────────────────

const rdmPath = path.join(__dirname, '../seed/data/rdm.json');
let rdmData;
try {
  rdmData = JSON.parse(readFileSync(rdmPath, 'utf8'));
} catch (err) {
  console.error(`ERREUR : impossible de lire rdm.json (${rdmPath}) : ${err.message}`);
  process.exit(1);
}

const rdmQuestions = rdmData.questions;
if (!Array.isArray(rdmQuestions) || rdmQuestions.length === 0) {
  console.error('ERREUR : rdm.json ne contient aucune question.');
  process.exit(1);
}

// Construire une map : enonce_corrigé → question rdm.json
const rdmByEnonce = new Map();
for (const q of rdmQuestions) {
  if (q.enonce) rdmByEnonce.set(q.enonce, q);
}

console.log(`rdm.json chargé : ${rdmQuestions.length} question(s), ${rdmByEnonce.size} unique(s).\n`);

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

  // Les collections Mongoose : model 'Categorie' → 'categories', model 'Quiz' → 'quizzes'.
  // Si la base utilise des noms différents, adapter les deux lignes ci-dessous.
  // Pour vérifier : db.listCollections().toArray() dans un client Mongo.
  const categories = db.collection('categories');
  const quizzes = db.collection('quizzes');

  // ── Étape 1 : Vérifier la présence de la catégorie RDM ───────────────────
  console.log('── Étape 1 : Vérification de la catégorie RDM ───────────────────');

  const rdmCategorie = await categories.findOne({ slug: 'rdm' });

  if (!rdmCategorie) {
    console.log('  Catégorie RDM introuvable en base.');
    console.log('  Le seed RDM n\'a pas encore été lancé. Aucune action nécessaire.');
    await mongoose.disconnect();
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log(simulationMode
      ? ' SIMULATION terminée. Aucune question RDM en base. Rien à migrer.'
      : ' MIGRATION terminée. Aucune question RDM en base. Rien à migrer.');
    console.log('══════════════════════════════════════════════════════════════════\n');
    return;
  }

  console.log(`  Catégorie RDM présente en base. ID: ${rdmCategorie._id}\n`);

  // ── Étape 2 : Analyse des questions RDM ──────────────────────────────────
  console.log('── Étape 2 : Analyse des questions RDM en base ──────────────────');

  const cursor = quizzes.find({ categorieId: rdmCategorie._id });

  let totalChecked = 0;
  let totalToUpdate = 0;
  let totalNoMatch = 0;
  const toUpdate = []; // { _id, enonce, assertions, reponse }

  for await (const doc of cursor) {
    totalChecked++;

    // Appliquer la correction mojibake au texte de la question en base.
    // Si le texte est déjà correct, fixMojibake renvoie la chaîne inchangée.
    const fixedEnonce = fixMojibake(doc.enonce);
    const fixedAssertions = Array.isArray(doc.assertions)
      ? doc.assertions.map(fixMojibake)
      : [];
    const fixedReponse = fixMojibake(doc.reponse);

    // Chercher la version propre dans rdm.json par l'énoncé corrigé.
    const matched = rdmByEnonce.get(fixedEnonce);

    if (!matched) {
      totalNoMatch++;
      continue;
    }

    // Comparer les valeurs actuelles en base avec les valeurs de rdm.json.
    // On utilise les valeurs corrigées pour la comparaison (idempotence).
    const assertionsMatch =
      Array.isArray(matched.assertions) &&
      matched.assertions.length === fixedAssertions.length &&
      matched.assertions.every((a, i) => a === fixedAssertions[i]);

    const needsUpdate =
      doc.enonce !== matched.enonce ||
      doc.reponse !== matched.reponse ||
      !assertionsMatch;

    if (needsUpdate) {
      totalToUpdate++;
      toUpdate.push({
        _id: doc._id,
        enonce: matched.enonce,
        assertions: matched.assertions,
        reponse: matched.reponse,
      });
    }
  }

  console.log(`  Questions RDM vérifiées          : ${totalChecked}`);
  console.log(`  Questions à mettre à jour        : ${totalToUpdate}`);
  console.log(`  Questions sans équivalent rdm.json : ${totalNoMatch}`);

  if (totalNoMatch > 0) {
    console.log('  (Ces questions ont été ajoutées manuellement ou leur énoncé');
    console.log('   diffère trop du fichier rdm.json. Elles ne sont pas touchées.)');
  }

  if (totalToUpdate === 0) {
    console.log('\n  Aucune mise à jour : les données sont déjà correctes.');
    console.log('  (Migration déjà passée, ou seed lancé après le correctif PR #6.)');
  }

  // ── Étape 3 : Mise à jour (seulement en mode --appliquer) ─────────────────
  if (!simulationMode && totalToUpdate > 0) {
    console.log('\n── Étape 3 : Application des corrections ────────────────────────');

    let updated = 0;
    for (const patch of toUpdate) {
      const result = await quizzes.updateOne(
        { _id: patch._id },
        {
          $set: {
            enonce: patch.enonce,
            assertions: patch.assertions,
            reponse: patch.reponse,
          },
        },
      );
      if (result.modifiedCount > 0) updated++;
    }

    console.log(`  Questions effectivement modifiées : ${updated}`);
    if (updated < totalToUpdate) {
      console.log(`  (${totalToUpdate - updated} document(s) inchangé(s) : conflit ou déjà à jour.)`);
    }
  } else if (simulationMode && totalToUpdate > 0) {
    console.log('\n  (Simulation : aucune écriture effectuée.)');
  }

  await mongoose.disconnect();

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  if (simulationMode) {
    console.log(` SIMULATION terminée.`);
    console.log(`   - Catégorie RDM en base            : OUI (ID: ${rdmCategorie._id})`);
    console.log(`   - Questions qui seraient modifiées : ${totalToUpdate}`);
    console.log(`   - Questions sans équivalent        : ${totalNoMatch}`);
    console.log(' Aucune donnée modifiée. Relancez avec --appliquer pour écrire.');
  } else {
    console.log(` MIGRATION terminée.`);
    if (totalToUpdate === 0) {
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
