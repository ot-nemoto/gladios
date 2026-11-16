import { describe, expect, it } from 'vitest';
import { fkPoints, interpPose } from '../src/sim/body';
import { KF } from '../src/sim/data';

/**
 * キーフレームのデータの検査（戦闘中の姿勢はすべてキーフレームか標準の構えから作られる）。
 * 足首が地面より下に入る一式は、既知のもの（28）だけを、記録した深さまで許す。
 * 新しく沈む一式が出たり、既知のものが深くなったりしたら落ちる。
 */
const KNOWN_SINK: Record<string, number> = {
  'pugio-thrust-normal-leg': -0.046,
  'pugio-thrust-strong-leg': -0.046,
  'pugio-thrust-feint-leg': -0.011,
  'gladius-thrust-normal-leg': -0.0053,
  'gladius-thrust-strong-leg': -0.0053,
  'common-posture-recovery': -0.0038,
};

describe('キーフレーム一式の姿勢', () => {
  it('足首が地面より下に入らない（既知の一式は記録した深さまで）', () => {
    const body = { x: 0, facing: 1 as const, wlen: 0.5, shieldHalf: null };
    const bad: string[] = [];
    for (const id of KF.keys()) {
      let min = Infinity;
      for (let i = 0; i <= 200; i++) min = Math.min(min, fkPoints(body, interpPose(id, i / 200)).ankle[1]);
      const limit = KNOWN_SINK[id] ?? 0;
      if (min < limit) bad.push(`${id}: ${min.toFixed(4)}（許容 ${limit}）`);
    }
    expect(bad).toEqual([]);
  });
});
