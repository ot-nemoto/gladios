import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        equipment: fileURLToPath(new URL('./equipment.html', import.meta.url)),
        helmetFit: fileURLToPath(new URL('./helmet-fit.html', import.meta.url)),
        scene: fileURLToPath(new URL('./scene.html', import.meta.url)),
      },
    },
  },
  server: {
    // 開発コンテナのポート転送から接続できるようにする。
    host: true,
    port: 5173,
    strictPort: true,
  },
});
