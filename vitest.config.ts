import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
