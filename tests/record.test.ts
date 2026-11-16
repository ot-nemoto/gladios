import { describe, expect, it } from 'vitest';
import scenarios from '../src/scenarios/check-scenarios.json';
import { Sim, type SimOptions } from '../src/sim/sim';
import { frameIndexAt, parseLog, record } from '../src/sim/record';

const opts = (i: number) => scenarios[i]!.options as SimOptions;

describe('record（リプレイ用の記録）', () => {
  it('ログと結果は Sim.run() と完全に同じ', () => {
    for (const i of [0, 4, 9, 17]) {
      const rec = record(opts(i));
      const run = new Sim(opts(i)).run();
      expect(rec.log).toEqual(run.log);
      expect(rec.summary).toEqual(run.summary);
    }
  });

  it('フレームは 0.01 秒間隔で、frameIndexAt で時刻から引ける', () => {
    const rec = record(opts(4));
    expect(rec.frameDt).toBeCloseTo(0.01, 12);
    const k = frameIndexAt(rec, 10.0);
    expect(rec.frames[k]!.t).toBeCloseTo(10.0, 6);
    expect(frameIndexAt(rec, -1)).toBe(0);
    expect(frameIndexAt(rec, 1e9)).toBe(rec.frames.length - 1);
  });

  it('ログ行から時刻・種類・主語を取り出す', () => {
    const ev = parseLog([
      '[   1.23] 行動開始 A: 構え（デフォルト: 通常攻撃（斬る・脚））',
      '[  12.00] 接触     B の攻撃 → A の盾に接触',
      '[ 180.00] 終了     時間上限 180秒に到達。決着せず（確認用の打ち切り）',
    ]);
    expect(ev.map((e) => [e.t, e.kind, e.actor])).toEqual([
      [1.23, '行動開始', 'A'],
      [12.0, '接触', 'B'],
      [180.0, '終了', null],
    ]);
  });
});
