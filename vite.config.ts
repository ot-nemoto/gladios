/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (f: string) => fileURLToPath(new URL(f, import.meta.url));

export default defineConfig({
  build: {
    // 2 ページ構成：戦闘ビューア（index.html）とモーション図鑑（motions.html）
    rollupOptions: {
      input: { main: page('index.html'), motions: page('motions.html') },
    },
  },
  server: {
    // 開発コンテナでは localhost が IPv6（::1）だけに解決され、VS Code のポート転送（IPv4）から
    // つながらないため、全アドレスで待ち受ける。ポートは devcontainer.json の forwardPorts と揃える。
    host: true,
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // 全シナリオの戦闘を走らせるテストが並行すると、既定の 5 秒を超えることがある
    testTimeout: 30_000,
  },
});
