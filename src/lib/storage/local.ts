import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import type { StorageAdapter } from './index';

const ROOT = path.join(process.cwd(), 'public', 'uploads');

export const localStorageAdapter: StorageAdapter = {
  async put(key, file) {
    const target = path.join(ROOT, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    return { url: `/uploads/${key}`, key };
  },
  async remove(key) {
    await unlink(path.join(ROOT, key)).catch(() => undefined);
  },
};
