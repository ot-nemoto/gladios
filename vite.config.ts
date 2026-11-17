import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // 開発コンテナのポート転送から接続できるようにする。
    host: true,
    port: 5173,
    strictPort: true,
  },
});
