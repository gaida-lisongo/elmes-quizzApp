import 'server-only';
import mongoose, { type ClientSession } from 'mongoose';
import connectToDb from './db';

let transactionsUnsupported = false;

const isTransactionUnsupported = (error: any) =>
  error?.code === 20 ||
  error?.codeName === 'IllegalOperation' ||
  /Transaction numbers are only allowed|replica set/i.test(String(error?.message || ''));

/**
 * Exécute `fn` dans une transaction MongoDB (EX-PAY-03) quand plusieurs documents
 * bougent ensemble (argent, parties, Bourse).
 *
 * `fn` peut être rejouée par le pilote en cas d'erreur transitoire : elle ne doit faire que
 * des opérations en base, toutes avec `{ session }`. Les e-mails se font après.
 *
 * Atlas est un replica set : les transactions y sont disponibles. Sur un MongoDB autonome
 * (développement local), on retombe sur une exécution sans transaction, en l'annonçant.
 */
export async function withTransaction<T>(fn: (session: ClientSession | null) => Promise<T>): Promise<T> {
  await connectToDb();
  if (transactionsUnsupported) return fn(null);

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      transactionsUnsupported = true;
      console.warn('[withTransaction] Transactions MongoDB indisponibles (pas de replica set) : exécution sans transaction.');
      return fn(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

/** Options Mongoose avec la session de transaction, si elle existe. */
export const tx = (session: ClientSession | null) => (session ? { session } : {});
