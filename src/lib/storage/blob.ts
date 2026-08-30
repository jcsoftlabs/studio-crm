import { del, put } from '@vercel/blob';
import type { StorageAdapter } from './index';

export const blobStorageAdapter: StorageAdapter = {
  async put(key, file) {
    const result = await put(key, file, { access: 'public', addRandomSuffix: false });
    return { url: result.url, key: result.pathname };
  },
  async remove(key) {
    await del(key);
  },
};
