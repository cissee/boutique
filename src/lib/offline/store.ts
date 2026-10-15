import type { CustomerSnapshot, PendingOperation } from "./types";

/** Stockage local des données hors ligne (IndexedDB en production, mémoire dans les tests). */
export interface OfflineStore {
  /** Opérations en ordre de saisie (la plus ancienne d'abord). */
  listOperations(): Promise<PendingOperation[]>;
  putOperation(op: PendingOperation): Promise<void>;
  deleteOperation(requestId: string): Promise<void>;
  getSnapshot(): Promise<CustomerSnapshot | null>;
  saveSnapshot(snapshot: CustomerSnapshot): Promise<void>;
  /** Efface tout (déconnexion). */
  clearAll(): Promise<void>;
}

const byCreatedAt = (a: PendingOperation, b: PendingOperation) => a.createdAt.localeCompare(b.createdAt);

export function createMemoryStore(): OfflineStore {
  const ops = new Map<string, PendingOperation>();
  let snapshot: CustomerSnapshot | null = null;
  return {
    async listOperations() {
      return [...ops.values()].map((op) => ({ ...op })).sort(byCreatedAt);
    },
    async putOperation(op) {
      ops.set(op.requestId, { ...op });
    },
    async deleteOperation(requestId) {
      ops.delete(requestId);
    },
    async getSnapshot() {
      return snapshot;
    },
    async saveSnapshot(s) {
      snapshot = s;
    },
    async clearAll() {
      ops.clear();
      snapshot = null;
    },
  };
}

const DB_NAME = "boutikdekk-offline";
const DB_VERSION = 1;
const OPS = "operations";
const META = "meta";
const SNAPSHOT_KEY = "customerSnapshot";

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function createIndexedDbStore(factory: IDBFactory = indexedDB): OfflineStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: "requestId" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  };

  return {
    async listOperations() {
      const db = await open();
      const ops = await promisify(db.transaction(OPS).objectStore(OPS).getAll());
      return (ops as PendingOperation[]).sort(byCreatedAt);
    },
    async putOperation(op) {
      const tx = (await open()).transaction(OPS, "readwrite");
      tx.objectStore(OPS).put(op);
      await done(tx);
    },
    async deleteOperation(requestId) {
      const tx = (await open()).transaction(OPS, "readwrite");
      tx.objectStore(OPS).delete(requestId);
      await done(tx);
    },
    async getSnapshot() {
      const db = await open();
      return ((await promisify(db.transaction(META).objectStore(META).get(SNAPSHOT_KEY))) as CustomerSnapshot) ?? null;
    },
    async saveSnapshot(snapshot) {
      const tx = (await open()).transaction(META, "readwrite");
      tx.objectStore(META).put(snapshot, SNAPSHOT_KEY);
      await done(tx);
    },
    async clearAll() {
      const tx = (await open()).transaction([OPS, META], "readwrite");
      tx.objectStore(OPS).clear();
      tx.objectStore(META).clear();
      await done(tx);
    },
  };
}
