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

describe('レビュー指摘の回帰テスト', () => {
  it('決着したステップのフレームを必ず記録する（最後の画面に決め手が映る）', () => {
    for (const [i, sc] of scenarios.entries()) {
      const rec = record(sc.options as SimOptions);
      const last = rec.frames[rec.frames.length - 1]!;
      expect(last.logEnd, `${i}: 最後のフレームに全ログ行が含まれる`).toBe(rec.log.length);
      if (rec.summary.reason === '体力0') {
        const loser = rec.summary.winner === 'A' ? last.B : last.A;
        const survivor = rec.summary.winner === 'A' ? last.A : last.B;
        expect(loser.hp, `${i}: 最後のフレームで負けた側の体力は 0 以下`).toBeLessThanOrEqual(0);
        expect(survivor.hp, `${i}: 勝った側の体力は残っている`).toBeGreaterThan(0);
      }
      if (rec.summary.reason === '相打ち') {
        // v3.45：同じステップで両者が戦闘不能なら引き分け
        expect(rec.summary.winner, `${i}: 相打ちは勝者なし`).toBeNull();
        expect(Math.max(last.A.hp, last.B.hp), `${i}: 相打ちは両者の体力が 0 以下`).toBeLessThanOrEqual(0);
      }
    }
  });

  it('各イベントは、それが起きた後の最初のフレームに対応づく', () => {
    const rec = record(opts(4));
    for (const e of rec.events) {
      expect(rec.frames[e.frame]!.logEnd).toBeGreaterThan(e.index);
      if (e.frame > 0) expect(rec.frames[e.frame - 1]!.logEnd).toBeLessThanOrEqual(e.index);
    }
  });

  it('最後のフレームの間隔が不揃いでも、frameIndexAt は最も近いフレームを返す', () => {
    const rec = record(opts(4));
    rec.frames.forEach((f, k) => {
      if (k % 97 === 0 || k === rec.frames.length - 1) expect(frameIndexAt(rec, f.t)).toBe(k);
    });
  });

  it('結果の行は直前の接触の主語を引き継ぐ', () => {
    const ev = parseLog([
      '[   2.34] 接触     A の攻撃 → B の脚に命中',
      '[   2.34] 結果     E=25 → 通常。B 体力-12（残138） 負傷点+2（計2） 体勢-15',
      '[   2.22] 接触     B の盾が A に接触（押し込み）',
      '[   2.22] 結果     押し込み成立: A 体勢-25（通常）、0.5m後退',
      '[   3.00] 結果     A: 体勢を立て直した（体勢80）',
    ]);
    expect(ev.map((e) => e.actor)).toEqual(['A', 'A', 'B', 'B', 'A']);
  });
});

describe('終了の判定（v3.45）', () => {
  const step = (hpA: number, hpB: number) => {
    const sim = new Sim({ policies: { A: 'none', B: 'none' }, passive: ['A', 'B'] });
    sim.a.hp = hpA;
    sim.b.hp = hpB;
    sim.step();
    return { over: sim.over, summary: sim.summary, last: sim.log[sim.log.length - 1] };
  };
  it('同じ刻みで両者の体力が 0 以下なら相打ち（引き分け）', () => {
    const r = step(-6, 0);
    expect(r.summary).toEqual({ winner: null, time: 0, reason: '相打ち' });
    expect(r.last).toContain('両者の体力が0。相打ち（引き分け）');
  });
  it('片方だけなら、もう片方の勝ち（A・B どちらでも）', () => {
    expect(step(0, 50).summary).toEqual({ winner: 'B', time: 0, reason: '体力0' });
    expect(step(50, -1).summary).toEqual({ winner: 'A', time: 0, reason: '体力0' });
  });
  it('両者に体力が残っていれば続く', () => {
    expect(step(1, 1).over).toBe(false);
  });
  it('確認シナリオに相打ちで終わるものがある（相打ちの経路が正解データで検証されている）', () => {
    const draws = scenarios.filter((sc) => new Sim(sc.options as SimOptions).run().summary.reason === '相打ち');
    expect(draws.length).toBeGreaterThan(0);
  });
});
