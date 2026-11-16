import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import FILES from '../scripts/sync-files.json';

// docs/prototype 側（正）と src/data 側の写しがずれていないかを検知する。
// 対象一覧は npm run sync:data と同じ scripts/sync-files.json を使う。
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
