import { localStorageAdapter } from './local';
import { blobStorageAdapter } from './blob';

export type StoredFile = { url: string; key: string };

export type StorageAdapter = {
  put(key: string, file: File): Promise<StoredFile>;
  remove(key: string): Promise<void>;
};

/**
 * Vercel Blob en production ; sans jeton (poste de dev) on retombe sur le disque
 * pour ne pas bloquer le travail hors ligne.
 */
export function getStorage(): StorageAdapter {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobStorageAdapter : localStorageAdapter;
}

export function buildPhotoKey(clientId: string, fileName: string): string {
  const extension = (fileName.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const unique = Math.random().toString(36).slice(2, 10);
  return `clients/${clientId}/${Date.now()}-${unique}.${extension || 'jpg'}`;
}
