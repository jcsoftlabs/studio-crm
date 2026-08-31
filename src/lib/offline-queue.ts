/**
 * File d'attente des écritures faites hors ligne.
 *
 * Seules y entrent les opérations que le serveur peut **revalider** au moment du
 * rejeu. La création et le déplacement d'un rendez-vous en sont exclus : leur règle
 * de non-chevauchement ne peut pas s'appliquer hors ligne, et rejouer à l'aveugle
 * mettrait deux clientes sur le même créneau.
 */
export type QueuedOperation =
  | { kind: 'appointment.setStatus'; appointmentId: string; status: string }
  | { kind: 'client.create'; firstName: string; lastName: string; phone: string }
  | { kind: 'client.updateNotes'; clientId: string; notes: string; allergies: string; preferences: string };

export type QueuedItem = { id: string; queuedAt: number; operation: QueuedOperation };

export type ReplayOutcome = {
  id: string;
  status: 'applied' | 'conflict' | 'rejected';
  detail?: string;
};

const DB_NAME = 'studio-crm-offline';
const STORE = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function enqueue(operation: QueuedOperation): Promise<QueuedItem> {
  const item: QueuedItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    operation,
  };
  await withStore('readwrite', (store) => store.add(item));
  return item;
}

export async function pending(): Promise<QueuedItem[]> {
  const items = await withStore<QueuedItem[]>('readonly', (store) => store.getAll());
  return items.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function remove(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clear(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
