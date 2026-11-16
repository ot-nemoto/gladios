import { describe, expect, it } from 'vitest';
import { KF, STANCE, WEAPONS, kf } from '../src/sim/data';
import {
  actionDuration,
  actorEquipment,
  bodyRef,
  firstContact,
  keyframeNames,
  opponentPoseOf,
  phasesOf,
  setLabel,
  trajectory,
} from '../src/sim/motion';
import { Sim, type SimOptions } from '../src/sim/sim';

/**
 * 実際の戦闘で、A の最初の攻撃が最初に接触したステップと対象を取り出す。
 * B は攻撃しない・防御しない（構えのまま）ので、図鑑の「構えの相手」と同じ条件になる。
 */
function battleFirstContact(o: SimOptions) {
  const sim = new Sim(o);
  let start: number | null = null;
  let setId: string | null = null;
  let gap = 0;
  let dur = 0;
  let seen = 0;
  while (!sim.over && sim.t < 30) {
    sim.step();
    const a = sim.a.action;
    if (start === null && a?.kind === 'attack') {
      start = a.start;
      setId = a.set;
      dur = a.dur;
      gap = sim.b.x - sim.a.x;
    }
    const lines = sim.log.slice(seen);
    seen = sim.log.length;
    const hit = lines.find((l) => /\] 接触\s+A の攻撃 → B の(.+?)(に命中|に接触)/.test(l));
    if (hit && start !== null) {
      const what = /→ B の(.+?)(に命中|に接触)/.exec(hit)![1]!;
      return { steps: Math.round((sim.t - start) / 0.005), what, setId: setId!, gap, dur };
    }
    sim.t += 0.005;
  }
  throw new Error('no contact');
}

const JP: Record<string, string> = { 盾: 'shield', 武器: 'weapon', 腕: 'arm', 脚: 'leg', 胴体: 'torso', 頭部: 'head' };

describe('firstContact は戦闘の判定と一致する', () => {
  it.each<[string, SimOptions]>([
    ['斬り胴 → 盾', { policies: { A: 'none', B: 'none' }, passive: ['B'] }],
    ['斬り脚 → 脚', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'gladius-slash-normal-leg' }, approachUntil: 1.45 }],
    ['突き胴', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'gladius-thrust-normal-torso' } }],
    ['強斬り頭', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'gladius-slash-strong-head' } }],
    ['ハスタ突き胴（小盾）', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'hasta-thrust-normal-torso' }, equip: { A: { weapon: 'hasta' }, B: { shield: 'small' } } }],
    ['スィカ斬り脚（パルムラ）', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'sica-slash-normal-leg' }, equip: { A: { weapon: 'sica' }, B: { shield: 'parmula' } } }],
  ])('%s', (_name, o) => {
    const want = battleFirstContact(o);
    const set = kf(want.setId);
    const eq = actorEquipment(set, o.equip?.A?.shield === undefined ? 'scutum' : (o.equip.A.shield ?? null));
    const actor = bodyRef(eq.weapon, eq.shield, 0, 1);
    const oppShield = o.equip?.B?.shield === undefined ? 'scutum' : (o.equip.B.shield ?? null);
    const opp = bodyRef('gladius', oppShield, want.gap, -1);
    const dur = actionDuration(set, eq.weapon);
    expect(dur).toBeCloseTo(want.dur, 12);
    const got = firstContact(want.setId, actor, dur, opp, { ...STANCE }, false);
    expect(got).not.toBeNull();
    expect(got!.step).toBe(want.steps);
    expect(got!.target).toBe(JP[want.what]);
  });
});

describe('モーション図鑑の計算', () => {
  it('88 一式すべてに名前・時間・キーフレーム名・軌道がある', () => {
    expect(KF.size).toBe(88);
    for (const set of KF.values()) {
      const eq = actorEquipment(set, 'scutum');
      expect(setLabel(set)).not.toMatch(/undefined/);
      expect(actionDuration(set, eq.weapon)).toBeGreaterThan(0);
      expect(keyframeNames(set)).toHaveLength(set.keyframes.length);
      const tr = trajectory(set, bodyRef(eq.weapon, eq.shield, 0, 1), 20);
      expect(tr).toHaveLength(21);
      for (const p of tr) expect(Number.isFinite(p.tip[0] + p.tip[1] + p.grip[0] + p.grip[1])).toBe(true);
    }
  });

  it('攻撃の所要時間は 基準時間 ×（0.85 + 0.15 × 武器重量）', () => {
    expect(actionDuration(kf('gladius-slash-normal-torso'), 'gladius')).toBeCloseTo(1.0, 12);
    expect(actionDuration(kf('hasta-thrust-strong-torso'), 'hasta')).toBeCloseTo(1.5 * (0.85 + 0.15 * WEAPONS.hasta.weight), 12);
  });

  it('段階は実行開始印・完了直前開始印で区切る', () => {
    expect(phasesOf(kf('gladius-slash-normal-torso'))!.map((p) => [p.from, p.to])).toEqual([
      [0, 0.35],
      [0.35, 0.8],
      [0.8, 1],
    ]);
    expect(phasesOf(kf('defence-scutum-block'))).toBeNull();
  });

  it('トライデントは両手持ちで盾を持たない', () => {
    expect(actorEquipment(kf('trident-thrust-normal-torso'), 'scutum').shield).toBeNull();
  });

  it('相手の防御姿勢は防御一式の中央のキーフレーム', () => {
    const { pose, defending } = opponentPoseOf('deflect', 'parmula');
    expect(defending).toBe(true);
    expect(pose.torso).toBe(kf('defence-parmula-deflect').keyframes[1]!.torso);
  });
});
