import { localStorageAdapter } from './local';
import { blobStorageAdapter } from './blob';

export type StoredFile = { url: string; key: string };

export type StorageAdapter = {
  put(key: string, file: File): Promise<StoredFile>;
  remove(key: string): Promise<void>;
};

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('storageNotConfigured');
    this.name = 'StorageNotConfiguredError';
  }
}

/**
 * Vercel Blob en production ; sans jeton (poste de dev) on retombe sur le disque.
 * En production le disque est en lecture seule : mieux vaut refuser clairement
 * que d'écrire dans le vide.
 */
export function getStorage(): StorageAdapter {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobStorageAdapter;
  if (process.env.NODE_ENV === 'production') throw new StorageNotConfiguredError();
  return localStorageAdapter;
}

export function buildPhotoKey(clientId: string, fileName: string): string {
  const extension = (fileName.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const unique = Math.random().toString(36).slice(2, 10);
  return `clients/${clientId}/${Date.now()}-${unique}.${extension || 'jpg'}`;
}
