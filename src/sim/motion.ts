/**
 * モーション図鑑の計算（キーフレーム一式の所要時間・段階・軌道・最初の接触）。
 *
 * 判定（sim.ts）と同じ関数・定数を使う補助モジュールで、Python 試作の移植ではない。
 * 接触の分類は戦闘の判定と共通の classifyContact を使い、所要時間も Sim.startAction と
 * 同じ定数から求める。表示用の名前は src/ui/motion-labels.ts に置く。
 */
import { fkPoints, interpPose, regionsOf, type BodyRef } from './body';
import { classifyContact, type ContactTarget } from './contact';
import {
  DEFENCE_SET_PREFIX,
  DEFENCE_TIME,
  DT,
  MOVE_TIME_PER_M,
  POSTURE_RECOVERY_TIME,
  PUSH_TIME,
  SHIELDS,
  STANCE,
  WEAPONS,
  attackWeightFactor,
  defenceSetId,
  type KeyframeSet,
  type Pose,
  type ShieldName,
  type WeaponName,
} from './data';
import type { Vec } from './geometry';

export type { ContactTarget } from './contact';

/** 防御一式 ID → 盾（DEFENCE_SET_PREFIX の逆引き）。 */
const SHIELD_BY_DEFENCE_PREFIX = new Map(
  (Object.entries(DEFENCE_SET_PREFIX) as [ShieldName | 'none', string][]).map(([shield, prefix]) => [
    prefix,
    shield === 'none' ? null : shield,
  ]),
);

/** 防御一式の盾と方針（例: defence-parmula-deflect → parmula, deflect）。 */
export function defenceOf(set: KeyframeSet): { shield: ShieldName | null; policy: string } | null {
  for (const [prefix, shield] of SHIELD_BY_DEFENCE_PREFIX) {
    if (set.id.startsWith(prefix)) return { shield, policy: set.id.slice(prefix.length) };
  }
  return null;
}

/** その一式を演じる剣闘士の装備。攻撃は一式の武器、防御は一式の盾。 */
export function actorEquipment(
  set: KeyframeSet,
  attackShield: ShieldName | null,
): { weapon: WeaponName; shield: ShieldName | null } {
  if (set.kind === 'attack') {
    const weapon = set.weapon as WeaponName;
    return { weapon, shield: weapon === 'trident' ? null : attackShield }; // トライデントは両手持ち
  }
  const d = defenceOf(set);
  if (d) return { weapon: 'gladius', shield: d.shield };
  return { weapon: 'gladius', shield: 'scutum' };
}

export function bodyRef(weapon: WeaponName, shield: ShieldName | null, x: number, facing: 1 | -1): BodyRef {
  return { x, facing, wlen: WEAPONS[weapon].len, shieldHalf: shield ? SHIELDS[shield].half : null };
}

/**
 * 実際の所要時間（秒）。全能力 50・スタミナ余裕・体勢通常のとき（状態の倍率 1.0）。
 * Sim.startAction と同じ定数：攻撃は基準時間 × 武器重量の倍率、防御・盾の押し込み・
 * 体勢を立て直すは各基準時間、移動は 1m ぶん。
 */
export function actionDuration(set: KeyframeSet, weapon: WeaponName): number {
  if (set.kind === 'attack') return (set.baseTime ?? 1.0) * attackWeightFactor(WEAPONS[weapon].weight);
  if (set.kind === 'defence') return DEFENCE_TIME;
  if (set.id === 'common-shield-push') return PUSH_TIME;
  if (set.id === 'common-posture-recovery') return POSTURE_RECOVERY_TIME;
  return MOVE_TIME_PER_M; // 接近・距離を取る：1m ぶん
}

export interface Phase {
  name: '準備' | '実行' | '完了直前';
  from: number;
  to: number;
}

/** 行動の段階（実行開始印・完了直前開始印を持つ一式のみ）。 */
export function phasesOf(set: KeyframeSet): Phase[] | null {
  const m = set.markers;
  if (!m) return null;
  return [
    { name: '準備', from: 0, to: m.executionStart },
    { name: '実行', from: m.executionStart, to: m.finalPhaseStart },
    { name: '完了直前', from: m.finalPhaseStart, to: 1 },
  ];
}

/** 移動の一式は、進み具合に応じて体ごと前後へ動く（1m ぶん）。 */
export function travelOf(set: KeyframeSet, tau: number): number {
  if (set.id === 'common-advance-1m') return tau;
  if (set.id === 'common-retreat-1m') return -tau;
  return 0;
}

export interface TrajectoryPoint {
  tau: number;
  grip: Vec;
  tip: Vec;
}

/** 武器の握り点と先端の軌道を samples 等分で求める。 */
export function trajectory(set: KeyframeSet, actor: BodyRef, samples = 120): TrajectoryPoint[] {
  const out: TrajectoryPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const tau = i / samples;
    const P = fkPoints({ ...actor, x: actor.x + actor.facing * travelOf(set, tau) }, interpPose(set.id, tau));
    out.push({ tau, grip: P.grip, tip: P.tip });
  }
  return out;
}

export interface Contact {
  /** 何ステップ目（DT 刻み、1 から）で接触したか。 */
  step: number;
  /** 行動開始からの秒。 */
  time: number;
  /** 進み具合（0〜1）。 */
  tau: number;
  target: ContactTarget;
}

/**
 * 攻撃一式が、一定の姿勢で立つ相手に最初に触れる瞬間を求める。
 * 戦闘の判定と同じく、開始姿勢では判定せず（R1）、DT 刻みの各ステップで classifyContact する。
 * 構え同士の触れ合い（R1b）は解決しないので、その先の接触を探し続ける。
 */
export function firstContact(
  setId: string,
  actor: BodyRef,
  duration: number,
  opponent: BodyRef,
  opponentPose: Pose,
  opponentDefending: boolean,
): Contact | null {
  const { regs } = regionsOf(opponent, opponentPose);
  for (let step = 1; step * DT < duration; step++) {
    const tau = (step * DT) / duration;
    const P = fkPoints(actor, interpPose(setId, tau));
    const target = classifyContact(P.grip, P.tip, regs, { defending: opponentDefending, progress: tau });
    if (target && target !== 'bind') return { step, time: step * DT, tau, target };
  }
  return null;
}

export type OpponentPose = 'stance' | 'block' | 'deflect' | 'evade';
export const OPPONENT_POSES: readonly OpponentPose[] = ['stance', 'block', 'deflect', 'evade'];

/** 相手の姿勢：構え、または防御一式の防御姿勢（中央のキーフレーム）。 */
export function opponentPoseOf(pose: OpponentPose, shield: ShieldName | null): { pose: Pose; defending: boolean } {
  if (pose === 'stance') return { pose: { ...STANCE }, defending: false };
  return { pose: interpPose(defenceSetId(shield, pose), 0.5), defending: true };
}
