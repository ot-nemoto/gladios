import { describe, expect, it } from 'vitest';
import scenarios from '../src/scenarios/check-scenarios.json';
import { drawFrame } from '../src/render/arena';
import { record } from '../src/sim/record';
import type { SimOptions } from '../src/sim/sim';

/** 呼び出しを数えるだけの Canvas 2D の代用品（ブラウザなしで描画処理を通す）。 */
function stubContext() {
  const calls: Record<string, number> = {};
  const canvas = { width: 960, height: 480 };
  const ctx = new Proxy({ canvas } as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls[key] = (calls[key] ?? 0) + 1;
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${key}: non-finite arg`);
        }
        if (key === 'createLinearGradient') return { addColorStop() {} };
        return undefined;
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('drawFrame（骨格表示）', () => {
  it.each([0, 5, 17, 22])('シナリオ %i の全フレームを例外なく描ける', (i) => {
    const rec = record(scenarios[i]!.options as SimOptions);
    const { ctx, calls } = stubContext();
    for (let k = 0; k < rec.frames.length; k += 7) {
      drawFrame(ctx, rec, rec.frames[k]!, {
        showRegions: k % 2 === 0,
        recentContacts: rec.events.slice(0, 3),
      });
    }
    expect(calls.fill).toBeGreaterThan(0);
    expect(calls.stroke).toBeGreaterThan(0);
  });
});
