import Dexie, { type Table } from 'dexie';
import type { LocalCache } from './storage.ts';

interface CachedState {
  id: string;
  cache: LocalCache;
}

class BenbiDatabase extends Dexie {
  caches!: Table<CachedState, string>;

  constructor() {
    super('benbi-db');
    this.version(1).stores({ caches: 'id' });
  }
}

export const db = new BenbiDatabase();

export async function dbGetCache(id: string): Promise<LocalCache | null> {
  try {
    const row = await db.caches.get(id);
    return row?.cache ?? null;
  } catch {
    return null;
  }
}

export async function dbPutCache(cache: LocalCache): Promise<boolean> {
  try {
    await db.caches.put({ id: cache.account.id, cache });
    return true;
  } catch {
    return false;
  }
}

export async function dbDeleteCache(id: string): Promise<void> {
  try {
    await db.caches.delete(id);
  } catch {
    // Fall back to the localStorage copy; callers also remove it.
  }
}
