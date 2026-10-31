/** Where raw save envelopes live. Implementations store opaque structured-cloneable values. */
export interface SaveStore {
  read(slot: string): Promise<unknown | undefined>;
  write(slot: string, value: unknown): Promise<void>;
  remove(slot: string): Promise<void>;
}

export class MemoryStore implements SaveStore {
  private data = new Map<string, unknown>();
  read(slot: string) {
    return Promise.resolve(this.data.has(slot) ? structuredClone(this.data.get(slot)) : undefined);
  }
  write(slot: string, value: unknown) {
    this.data.set(slot, structuredClone(value));
    return Promise.resolve();
  }
  remove(slot: string) {
    this.data.delete(slot);
    return Promise.resolve();
  }
}

const DB_NAME = 'frontier-protocol';
const STORE = 'saves';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** IndexedDB-backed store (one object store keyed by slot name). */
export class IndexedDbStore implements SaveStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = this.factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
      req.onblocked = () => reject(new Error('IndexedDB open was blocked'));
    });
    return this.db;
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async read(slot: string) {
    return request((await this.tx('readonly')).get(slot)) as Promise<unknown | undefined>;
  }
  async write(slot: string, value: unknown) {
    await request((await this.tx('readwrite')).put(value, slot));
  }
  async remove(slot: string) {
    await request((await this.tx('readwrite')).delete(slot));
  }
}

/** IndexedDB when available; otherwise in-memory (saves last only for the session). */
export function createDefaultStore(): { store: SaveStore; persistent: boolean } {
  try {
    if (typeof indexedDB !== 'undefined') return { store: new IndexedDbStore(), persistent: true };
  } catch {
    /* fall through */
  }
  return { store: new MemoryStore(), persistent: false };
}
