// Migration ponctuelle — correction de l'encodage RDM (M-20261126-8).
//
// À exécuter UNE FOIS, APRÈS le déploiement de la branche fix/m8-rdm-encodage,
// sur la base de production (après une sauvegarde obligatoire) :
//
//   mongosh "$MONGO_URI" scripts/migrations/2026-11-rdm-encodage.mongodb.js
//
// Idempotent : le relancer après une première exécution ne modifie aucun document
// (les enonces sont déjà corrects, tryFix ne renvoie rien de différent).
//
// Contexte : scripts/seed/data/rdm.json a été généré en UTF-8, mais le texte a
// subi une double-encodage (UTF-8 → Windows-1252 → UTF-8), produisant des
// séquences comme "Ïƒ" (σ), "Â·" (·), "Ã©" (é). Si le seed a été exécuté
// avant ce correctif, les 200 questions RDM en base contiennent ces séquences.
// Ce script les corrige dans les champs enonce, assertions et reponse.

// ── Mapping Windows-1252 (0x80-0x9F) ─────────────────────────────────────────
// Clé : code point Unicode du caractère mojibake → valeur : octet W-1252 d'origine
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

function tryDecode(seq) {
  // Convertir chaque caractère en son octet W-1252 d'origine
  const bytes = [];
  for (let i = 0; i < seq.length; i++) {
    const cp = seq.codePointAt(i);
    if (cp <= 0xFF) {
      bytes.push(cp);
    } else if (W1252_REVERSE[cp] !== undefined) {
      bytes.push(W1252_REVERSE[cp]);
    } else {
      return null; // Impossible à encoder en W-1252
    }
  }
  // Reconstruire la chaîne UTF-8 à partir des octets
  // mongosh utilise JS natif, donc on peut décoder via TextDecoder
  try {
    const uint8 = new Uint8Array(bytes);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(uint8);
    if (decoded === seq) return null; // Pas de changement
    return decoded;
  } catch (_) {
    return null; // Séquence non valide en UTF-8
  }
}

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

// ── Migration ─────────────────────────────────────────────────────────────────
// IMPORTANT : vérifier les noms de collections avant d'exécuter.
// Mongoose pluralise automatiquement : model 'Quiz' → 'quizzes', 'Categorie' → 'categories'.
// Si la base utilise des noms différents, adapter les deux lignes ci-dessous.
// Pour vérifier : db.getCollectionNames() dans mongosh.

const categorie = db.categories.findOne({ slug: 'rdm' });
if (!categorie) {
  print('Catégorie RDM introuvable en base. Seed pas encore lancé, rien à faire.');
} else {
  print(`Catégorie RDM trouvée : ${categorie._id}`);

  let updated = 0;
  let checked = 0;

  db.quizzes.find({ categorieId: categorie._id }).forEach(function(doc) {
    checked++;
    const newEnonce = fixMojibake(doc.enonce);
    const newAssertions = (doc.assertions || []).map(fixMojibake);
    const newReponse = fixMojibake(doc.reponse);

    const changed =
      newEnonce !== doc.enonce ||
      newReponse !== doc.reponse ||
      newAssertions.some((a, i) => a !== (doc.assertions || [])[i]);

    if (changed) {
      db.quizzes.updateOne(
        { _id: doc._id },
        { $set: { enonce: newEnonce, assertions: newAssertions, reponse: newReponse } }
      );
      updated++;
    }
  });

  print(`Questions vérifiées : ${checked}`);
  print(`Questions mises à jour : ${updated}`);
  if (updated === 0) {
    print('Aucune mise à jour : les données sont déjà correctes (migration déjà passée ou seed pas encore lancé).');
  }
}
