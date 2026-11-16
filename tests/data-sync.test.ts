import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// docs/prototype 側（正）と src/data 側の写しがずれていないかを検知する。
const FILES = ['keyframes-full.json', 'check-conditions-v1.json'];
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf-8');

describe('src/data は docs/prototype の写しと一致する', () => {
  for (const f of FILES) {
    it(f, () => {
      expect(read(`src/data/${f}`), `npm run sync:data を実行してください`).toBe(
        read(`docs/prototype/${f}`),
      );
    });
  }
});
