import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// sim/ 配下で三角関数を直接呼んでいないことを確かめる（trig.ts 以外）。
const simDir = fileURLToPath(new URL('../src/sim', import.meta.url));
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('sim/ の三角関数は trig.ts 経由', () => {
  it('Math.sin / Math.cos / Math.tan / Math.atan2 などを直接使わない', () => {
    const offenders = walk(simDir)
      .filter((p) => p.endsWith('.ts') && !p.endsWith('trig.ts'))
      .filter((p) => /Math\.(a?sin|a?cos|a?tan|atan2|hypot)\b/.test(readFileSync(p, 'utf-8')));
    expect(offenders).toEqual([]);
  });
});
