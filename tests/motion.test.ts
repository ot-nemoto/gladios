import { describe, expect, it } from 'vitest';
import { DT, KF, STANCE, WEAPONS, defenceSetId, effectiveShield, kf, type ShieldName, type WeaponName } from '../src/sim/data';
import { interpPose } from '../src/sim/body';
import {
  actionDuration,
  actorEquipment,
  bodyRef,
  defenceOf,
  firstContact,
  opponentPoseOf,
  phasesOf,
  trajectory,
  type ContactTarget,
  type OpponentPose,
} from '../src/sim/motion';
import { keyframeNames, setLabel } from '../src/ui/motion-labels';
import { Sim, type SimOptions } from '../src/sim/sim';

/**
 * 実際の戦闘で、A の最初の攻撃が最初に接触したステップと対象を取り出す。
 * B は攻撃しない・防御しない（構えのまま）ので、図鑑の「構えの相手」と同じ条件になる。
 */
function battleFirstContact(o: SimOptions) {
  const sim = new Sim(o);
  // ダミーは判断させず、開始位置で構えたまま立たせる（間隔 1.5m 以上だと接近してしまうため。#26）
  sim.b.decisionAt = Infinity;
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
      return { steps: Math.round((sim.t - start) / DT), what, setId: setId!, gap, dur };
    }
    sim.t += DT;
  }
  throw new Error('no contact');
}

const JP: Record<string, string> = { 盾: 'shield', 武器: 'weapon', 腕: 'arm', 脚: 'leg', 胴体: 'torso', 頭部: 'head' };

describe('firstContact は戦闘の判定と一致する', () => {
  it.each<[string, SimOptions]>([
    ['斬り胴 → 盾', { policies: { A: 'none', B: 'none' }, passive: ['B'] }],
    ['突き胴', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'gladius-thrust-normal-torso' } }],
    ['ハスタ突き胴（小盾）', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'hasta-thrust-normal-torso' }, equip: { A: { weapon: 'hasta' }, B: { shield: 'small' } } }],
    ['斬り脚 → 脚', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'gladius-slash-normal-leg' } }],
    ['強斬り頭', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'gladius-slash-strong-head' } }],
    ['牽制斬り脚', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'gladius-slash-feint-leg' } }],
    ['スィカ斬り脚（パルムラ）', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'sica-slash-normal-leg' }, equip: { A: { weapon: 'sica' }, B: { shield: 'parmula' } } }],
    ['スィカ強斬り頭（小盾）', { policies: { A: 'none', B: 'none' }, passive: ['B'], atkSets: { A: 'sica-slash-strong-head' }, equip: { A: { weapon: 'sica' }, B: { shield: 'small' } } }],
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

  it('キーフレーム名：攻撃は作成標準の 5 枚、盾押しは押し、防御は 3 枚', () => {
    expect(keyframeNames(kf('gladius-thrust-normal-torso'))[2]).toBe('突き中間');
    expect(keyframeNames(kf('common-shield-push'))).toEqual(['開始', '予備完了', '押し中間', '到達想定', '終了']);
    expect(keyframeNames(kf('defence-scutum-block'))).toEqual(['開始', '防御姿勢', '終了']);
  });

  it('防御一式から盾と方針を逆引きできる', () => {
    expect(defenceOf(kf('defence-smallshield-evade'))).toEqual({ shield: 'small', policy: 'evade' });
    expect(defenceOf(kf('defence-weapononly-block'))).toEqual({ shield: null, policy: 'block' });
    expect(defenceOf(kf('common-shield-push'))).toBeNull();
  });

  it('相手の防御姿勢は防御一式の中央のキーフレーム', () => {
    const { pose, defending } = opponentPoseOf('deflect', 'parmula');
    expect(defending).toBe(true);
    expect(pose.torso).toBe(kf('defence-parmula-deflect').keyframes[1]!.torso);
  });
});

/**
 * 相手を一定の姿勢（構え・各防御姿勢）に固定し、戦闘の判定そのもの（Sim の contactScan）を
 * 試作と同じ手順（時刻を DT ずつ進め、姿勢を更新してから判定）で回して、最初の接触を求める。
 */
function simFirstContact(
  setId: string,
  weapon: WeaponName,
  gap: number,
  oppShield: ShieldName | null,
  oppPose: OpponentPose,
): { step: number; target: ContactTarget } | null {
  const sim = new Sim({
    policies: { A: 'none', B: 'none' },
    equip: { A: { weapon, shield: 'scutum' }, B: { shield: oppShield } },
  });
  // 判定の内部の手順を直接呼ぶ（テストのため）
  const internal = sim as unknown as {
    startAction(g: unknown, kind: string, label: string, o: { setId: string; holdStart: null }): void;
    contactScan(g: unknown): void;
  };
  sim.a.x = -gap / 2;
  sim.b.x = gap / 2;
  internal.startAction(sim.a, 'attack', 'test', { setId, holdStart: null });
  const { pose, defending } = opponentPoseOf(oppPose, oppShield);
  if (defending) {
    sim.b.action = { kind: 'defence', set: defenceSetId(oppShield, oppPose), start: 0, dur: Infinity, label: '', policy: 'block' };
  }
  sim.b.pose = pose;
  const a = sim.a.action!;
  for (let step = 1; ; step++) {
    sim.t += DT;
    if (sim.t >= a.start + a.dur) return null; // 試作では完了の判定が接触の判定より先
    sim.a.pose = interpPose(setId, (sim.t - a.start) / a.dur);
    internal.contactScan(sim.a);
    const line = sim.log.find((l) => /\] 接触/.test(l));
    if (line) {
      const what = /→ B の(.+?)(?:に命中|に接触)/.exec(line)![1]!;
      return { step, target: JP[what] as ContactTarget };
    }
  }
}

describe('firstContact は、相手が防御姿勢のときも戦闘の判定と一致する', () => {
  it('武器・攻撃・相手の盾・姿勢・間隔の組み合わせ', () => {
    const sets = [...KF.values()].filter((s) => s.kind === 'attack' && s.strength === 'normal');
    const mismatches: string[] = [];
    const seen = new Set<string>();
    let cases = 0;
    for (const set of sets) {
      const weapon = set.weapon as WeaponName;
      const base = set.refDistance ?? 1.4;
      for (const oppShield of ['scutum', 'small', null] as (ShieldName | null)[]) {
        for (const oppPose of ['stance', 'block', 'deflect', 'evade'] as OpponentPose[]) {
          for (const gap of [base - 0.2, base, base + 0.1]) {
            cases++;
            const want = simFirstContact(set.id, weapon, gap, oppShield, oppPose);
            const actor = bodyRef(weapon, effectiveShield(weapon, 'scutum'), -gap / 2, 1);
            const opp = bodyRef('gladius', oppShield, gap / 2, -1);
            const { pose, defending } = opponentPoseOf(oppPose, oppShield);
            const got = firstContact(set.id, actor, actionDuration(set, weapon), opp, pose, defending);
            const g = got && { step: got.step, target: got.target };
            if (JSON.stringify(g) !== JSON.stringify(want)) {
              mismatches.push(`${set.id} ${oppShield} ${oppPose} ${gap.toFixed(2)}: sim=${JSON.stringify(want)} motion=${JSON.stringify(g)}`);
            }
            if (want) seen.add(want.target);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(cases).toBeGreaterThan(800);
    // 防御姿勢の相手で、武器での受け（R1b の境界を越えた接触）まで実際に通っていること
    expect([...seen].sort()).toEqual(expect.arrayContaining(['shield', 'weapon', 'leg']));
  });
});
