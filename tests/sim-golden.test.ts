import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Sim, type SimOptions } from '../src/sim/sim';

// Python 試作の出力（scripts/dump_golden.py で生成）と、ログ・結果・最終状態を完全一致で比べる。
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'));
const scenarios: { name: string; options: SimOptions }[] = read('../src/scenarios/check-scenarios.json');
const golden: {
  scenarios: { name: string; log: string[]; summary: unknown; A: unknown; B: unknown }[];
} = read('./golden/sim-prototype.json');

const state = (g: Sim['a']) => ({
  hp: g.hp,
  stamina: g.stamina,
  posture: g.posture,
  x: g.x,
  injury: g.injury,
  stats: g.stats,
  collapsed: g.collapsed,
});

describe('Python 試作と一致する', () => {
  scenarios.forEach((sc, i) => {
    it(sc.name, () => {
      const want = golden.scenarios[i]!;
      expect(want.name).toBe(sc.name);
      const sim = new Sim(sc.options);
      const { log, summary } = sim.run();
      const firstDiff = log.findIndex((line, k) => line !== want.log[k]);
      expect(
        firstDiff === -1 ? null : { line: firstDiff, ts: log[firstDiff], py: want.log[firstDiff] },
      ).toBeNull();
      expect(log.length).toBe(want.log.length);
      expect(summary).toEqual(want.summary);
      expect(state(sim.a)).toEqual(want.A);
      expect(state(sim.b)).toEqual(want.B);
    });
  });
});

describe('決定論', () => {
  it('同じ条件で2回走らせるとログが完全に一致する', () => {
    const o = scenarios[0]!.options;
    expect(new Sim(o).run().log).toEqual(new Sim(o).run().log);
  });
});
