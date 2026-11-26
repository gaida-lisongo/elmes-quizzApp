/**
 * fix-rdm-encoding.js  —  M-20261126-8
 *
 * Corrige le mojibake de scripts/seed/data/rdm.json.
 * Cause : le texte a été généré en UTF-8, puis mal relu comme Windows-1252,
 * puis ré-enregistré en UTF-8, créant une double-encodage.
 * Exemples : "Ïƒ" → "σ", "Â·" → "·", "Ã©" → "é".
 *
 * Usage :
 *   node scripts/seed/fix-rdm-encoding.js [--dry-run]
 *
 * Idempotent : si le fichier est déjà correct, aucun changement n'est écrit.
 * Le JSON reste valide et conserve exactement le même nombre de questions.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Mapping Windows-1252 bytes 0x80-0x9F vers leur code point Unicode.
// Ces bytes ne sont pas définis dans Latin-1 / ISO-8859-1 mais le sont dans W-1252.
const W1252_HIGH = {
  0x80: 0x20AC, // €
  0x82: 0x201A, // ‚
  0x83: 0x0192, // ƒ  <-- ici apparaît σ (0xCF 0x83)
  0x84: 0x201E, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02C6, // ˆ
  0x89: 0x2030, // ‰
  0x8A: 0x0160, // Š
  0x8B: 0x2039, // ‹
  0x8C: 0x0152, // Œ
  0x8E: 0x017D, // Ž
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201C, // "
  0x94: 0x201D, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02DC, // ˜
  0x99: 0x2122, // ™
  0x9A: 0x0161, // š
  0x9B: 0x203A, // ›
  0x9C: 0x0153, // œ
  0x9E: 0x017E, // ž
  0x9F: 0x0178, // Ÿ
};

// Table inverse : code point Unicode → octet Windows-1252
const UNICODE_TO_W1252 = {};
for (const [byte, cp] of Object.entries(W1252_HIGH)) {
  UNICODE_TO_W1252[cp] = parseInt(byte);
}

/**
 * Convertit un caractère Unicode en son octet Windows-1252 (si possible).
 * Pour les caractères U+0000–U+00FF, l'octet = le code point.
 * Pour les caractères spéciaux Windows-1252 (0x80-0x9F), on utilise la table.
 * Retourne null si le caractère ne peut pas être encodé en W-1252.
 */
function charToW1252Byte(cp) {
  if (cp <= 0xFF) return cp;
  if (UNICODE_TO_W1252[cp] !== undefined) return UNICODE_TO_W1252[cp];
  return null;
}

/**
 * Teste si un code point peut être un octet W-1252 d'une séquence mojibake.
 */
function isMojiChar(cp) {
  if (cp >= 0x80 && cp <= 0xFF) return true;
  if (UNICODE_TO_W1252[cp] !== undefined) return true;
  return false;
}

/**
 * Tente de décoder une séquence de caractères mojibake.
 * Stratégie : chaque caractère → son octet W-1252, puis on décode le buffer en UTF-8.
 * Retourne la chaîne corrigée, ou null si le décodage échoue / produit des caractères
 * de remplacement U+FFFD.
 */
function tryDecode(seq) {
  const bytes = [];
  for (let i = 0; i < seq.length; i++) {
    const byte = charToW1252Byte(seq.charCodeAt(i));
    if (byte === null) return null;
    bytes.push(byte);
  }
  const buf = Buffer.from(bytes);
  try {
    const decoded = buf.toString('utf-8');
    if (decoded.includes('�')) return null; // octet non valide en UTF-8
    if (decoded === seq) return null;             // pas de changement → déjà correct
    return decoded;
  } catch (_) {
    return null;
  }
}

/**
 * Corrige toutes les séquences mojibake dans une chaîne.
 * Ne touche pas aux parties déjà correctes.
 */
function fixMojibake(str) {
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (isMojiChar(str.charCodeAt(i))) {
      // Collecter le run de caractères potentiellement mojibake
      let j = i;
      while (j < str.length && isMojiChar(str.charCodeAt(j))) j++;
      const seq = str.slice(i, j);
      const fixed = tryDecode(seq);
      if (fixed !== null) {
        result += fixed;
      } else {
        // Séquence déjà correcte (ex. "²·" dans "π²·EI") — conserver telle quelle
        result += seq;
      }
      i = j;
    } else {
      result += str[i];
      i++;
    }
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const FILE_PATH = path.join(__dirname, 'data', 'rdm.json');

const original = fs.readFileSync(FILE_PATH, 'utf-8');

// Compter les séquences mojibake avant correction
let beforeCount = 0;
{
  let i = 0;
  while (i < original.length) {
    if (isMojiChar(original.charCodeAt(i))) {
      let j = i;
      while (j < original.length && isMojiChar(original.charCodeAt(j))) j++;
      const seq = original.slice(i, j);
      if (seq.length >= 2 && tryDecode(seq) !== null) beforeCount++;
      i = j;
    } else {
      i++;
    }
  }
}

const fixed = fixMojibake(original);

// Compter les séquences restantes après correction
let afterCount = 0;
{
  let i = 0;
  while (i < fixed.length) {
    if (isMojiChar(fixed.charCodeAt(i))) {
      let j = i;
      while (j < fixed.length && isMojiChar(fixed.charCodeAt(j))) j++;
      const seq = fixed.slice(i, j);
      if (seq.length >= 2 && tryDecode(seq) !== null) afterCount++;
      i = j;
    } else {
      i++;
    }
  }
}

// Validation JSON
let parsedOriginal, parsedFixed;
try {
  parsedOriginal = JSON.parse(original);
} catch (e) {
  console.error('ERREUR : le fichier source n\'est pas un JSON valide :', e.message);
  process.exit(1);
}
try {
  parsedFixed = JSON.parse(fixed);
} catch (e) {
  console.error('ERREUR : le fichier corrigé n\'est pas un JSON valide :', e.message);
  process.exit(1);
}

const origQCount = parsedOriginal.questions.length;
const fixedQCount = parsedFixed.questions.length;
if (origQCount !== fixedQCount) {
  console.error(`ERREUR : nombre de questions différent avant (${origQCount}) et après (${fixedQCount}).`);
  process.exit(1);
}

console.log(`Séquences mojibake avant : ${beforeCount}`);
console.log(`Séquences mojibake après  : ${afterCount}`);
console.log(`Questions conservées      : ${fixedQCount}`);
console.log(`JSON valide               : oui`);

if (beforeCount === 0) {
  console.log('Le fichier est déjà propre. Aucune écriture.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('[--dry-run] Aucune écriture effectuée.');
  // Afficher quelques exemples de corrections
  console.log('\nExemples de corrections :');
  let shown = 0;
  const lines = original.split('\n');
  for (const line of lines) {
    const fixedLine = fixMojibake(line);
    if (fixedLine !== line && shown < 5) {
      console.log(`  AVANT : ${line.trim()}`);
      console.log(`  APRÈS : ${fixedLine.trim()}`);
      shown++;
    }
  }
  process.exit(0);
}

fs.writeFileSync(FILE_PATH, fixed, 'utf-8');
console.log(`\nFichier écrit : ${FILE_PATH}`);
console.log('Correction terminée.');
