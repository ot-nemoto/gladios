/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // 開発コンテナでは localhost が IPv6（::1）だけに解決され、VS Code のポート転送（IPv4）から
    // つながらないため、全アドレスで待ち受ける。ポートは devcontainer.json の forwardPorts と揃える。
    host: true,
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
