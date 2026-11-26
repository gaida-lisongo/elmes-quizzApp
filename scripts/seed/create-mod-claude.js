// Usage : node scripts/seed/create-mod-claude.js
// Crée le compte MOD "claude" utilisé pour la modération via l'interface admin.
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');

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

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEY_LENGTH = 64;

function hashPassword(pw) {
  return new Promise((res, rej) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(pw, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) rej(err);
      else res(`scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`);
    });
  });
}

const UserSchema = new mongoose.Schema({
  pseudo: { type: String, required: true, trim: true },
  telephone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, sparse: true, trim: true },
  photo: { type: String, default: '' },
  solde: { type: Number, default: 0 },
  soldeBloque: { type: Number, default: 0 },
  role: { type: String, enum: ['PLAYER', 'MOD', 'ADMIN'], default: 'PLAYER' },
  secure: { type: String },
  sessionVersion: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const CLAUDE_PHONE    = '+243000000001';
const CLAUDE_EMAIL    = 'claude@elmes-solution.site';
const CLAUDE_PSEUDO   = 'claude';
// Mot de passe lu depuis .env.local (CLAUDE_MOD_PASSWORD) : ne jamais l'écrire en dur, le dépôt est public.
const CLAUDE_PASSWORD = process.env.CLAUDE_MOD_PASSWORD;

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI introuvable. Vérifiez .env.local');
    process.exit(1);
  }
  if (!CLAUDE_PASSWORD || CLAUDE_PASSWORD.length < 12) {
    console.error('CLAUDE_MOD_PASSWORD absent ou trop court (12 caractères minimum). Ajoutez-le dans .env.local');
    process.exit(1);
  }

  console.log('Connexion à MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connexion établie.\n');

  const existing = await User.findOne({ telephone: CLAUDE_PHONE }).lean();
  if (existing) {
    console.log(`Utilisateur "${CLAUDE_PSEUDO}" existe déjà.`);
    console.log(`  _id  : ${existing._id}`);
    console.log(`  role : ${existing.role}`);
    await mongoose.disconnect();
    return;
  }

  const hash = await hashPassword(CLAUDE_PASSWORD);
  const user = await User.create({
    pseudo: CLAUDE_PSEUDO,
    telephone: CLAUDE_PHONE,
    email: CLAUDE_EMAIL,
    role: 'MOD',
    secure: hash,
    sessionVersion: 0,
  });

  console.log('✓ Compte MOD créé :');
  console.log(`  pseudo    : ${CLAUDE_PSEUDO}`);
  console.log(`  téléphone : ${CLAUDE_PHONE}`);
  console.log(`  email     : ${CLAUDE_EMAIL}`);
  console.log(`  role      : MOD`);
  console.log(`  _id       : ${user._id}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
