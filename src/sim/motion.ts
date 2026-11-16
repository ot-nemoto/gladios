/**
 * モーション図鑑の計算（キーフレーム一式の時間・段階・軌道・最初の接触）。
 *
 * 画面から独立した純粋な関数。接触の判定は Sim の contactScan と同じ順序・規則で、
 * 相手が一定の姿勢で立っている場合の「最初の接触」を求める（tests/motion.test.ts で
 * 実際の戦闘の判定と一致することを確認している）。
 */
import { HEAD_R, fkPoints, interpPose, regionsOf, type BodyRef } from './body';
import {
  DT,
  SHIELDS,
  STANCE,
  WEAPONS,
  kf,
  type KeyframeSet,
  type Pose,
  type ShieldName,
  type WeaponName,
} from './data';
import { segCircle, segObb, segSeg, type Vec } from './geometry';

export const WEAPON_JP: Record<WeaponName, string> = {
  gladius: 'グラディウス',
  sica: 'スィカ',
  pugio: 'プギオ',
  trident: 'トライデント',
  hasta: 'ハスタ',
};
export const SHIELD_JP: Record<ShieldName | 'none', string> = {
  scutum: 'スクートゥム',
  parmula: 'パルムラ',
  small: '小盾',
  none: '盾なし',
};
const METHOD_JP = { slash: '斬る', thrust: '突く' } as const;
const STRENGTH_JP = { feint: '牽制', normal: '通常', strong: '強' } as const;
const PART_JP: Record<string, string> = { head: '頭部', torso: '胴体', arm: '腕', leg: '脚' };
const POLICY_JP: Record<string, string> = { block: '受け止め', deflect: '受け流し', evade: '回避' };
const COMMON_JP: Record<string, string> = {
  'common-advance-1m': '接近（1m）',
  'common-retreat-1m': '距離を取る（1m）',
  'common-posture-recovery': '体勢を立て直す',
  'common-shield-push': '盾の押し込み',
};
const DEFENCE_SHIELD: Record<string, ShieldName | null> = {
  scutum: 'scutum',
  parmula: 'parmula',
  smallshield: 'small',
  weapononly: null,
};

/** 防御一式の盾と方針（例: defence-parmula-deflect → parmula, deflect）。 */
export function defenceOf(set: KeyframeSet): { shield: ShieldName | null; policy: string } | null {
  const m = /^defence-(\w+)-(\w+)$/.exec(set.id);
  if (!m) return null;
  return { shield: DEFENCE_SHIELD[m[1]!] ?? null, policy: m[2]! };
}

/** 一式の日本語名。 */
export function setLabel(set: KeyframeSet): string {
  if (set.kind === 'attack') {
    return [
      WEAPON_JP[set.weapon as WeaponName],
      METHOD_JP[set.method!],
      STRENGTH_JP[set.strength!],
      PART_JP[set.part!],
    ].join('・');
  }
  const d = defenceOf(set);
  if (d) return `${SHIELD_JP[d.shield ?? 'none']}・${POLICY_JP[d.policy] ?? d.policy}`;
  return COMMON_JP[set.id] ?? set.id;
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
 * 実際の所要時間（秒）。全能力 50・スタミナ余裕・体勢通常のとき（倍率 1.0）。
 * Sim.startAction と同じ式：攻撃は基準時間 ×（0.85 + 0.15 × 武器重量）、防御 0.6、
 * 盾の押し込み 0.8、体勢を立て直す 1.2、移動は 1m あたり 0.55。
 */
export function actionDuration(set: KeyframeSet, weapon: WeaponName): number {
  if (set.kind === 'attack') return (set.baseTime ?? 1.0) * (0.85 + 0.15 * WEAPONS[weapon].weight);
  if (set.kind === 'defence') return 0.6;
  if (set.id === 'common-shield-push') return 0.8;
  if (set.id === 'common-posture-recovery') return 1.2;
  return 0.55; // 接近・距離を取る：1m ぶん
}

/** キーフレームの名前（作成標準 §5.4.2）。 */
export function keyframeNames(set: KeyframeSet): string[] {
  const n = set.keyframes.length;
  if (n === 5) return ['開始', '予備完了', set.method === 'thrust' ? '突き中間' : '振り中間', '到達想定', '終了'];
  if (set.kind === 'defence') return ['開始', '防御姿勢', '終了'];
  return set.keyframes.map((_, i) => (i === 0 ? '開始' : i === n - 1 ? '終了' : `中間${i}`));
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

export type ContactTarget = 'shield' | 'weapon' | 'arm' | 'leg' | 'torso' | 'head';
export const CONTACT_JP: Record<ContactTarget, string> = {
  shield: '盾',
  weapon: '武器',
  arm: '腕',
  leg: '脚',
  torso: '胴体',
  head: '頭部',
};

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
 * 戦闘の判定（Sim.contactScan）と同じ規則：開始姿勢では判定しない（R1）、
 * 盾 → 武器（相手が防御中のみ。実行開始印 0.35 より前は構え同士の触れ合いで解決しない）
 * → 腕 → 脚 → 胴体 → 頭部 の順に、同じステップ内の優先を決める。
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
    const w1 = P.grip;
    const w2 = P.tip;
    let target: ContactTarget | null = null;
    if (regs.shield && segObb(w1, w2, regs.shield)) target = 'shield';
    else if (opponentDefending && segSeg(w1, w2, regs.weapon[0], regs.weapon[1])) {
      if (tau < 0.35) continue; // R1b：構え同士の触れ合い
      target = 'weapon';
    } else if (regs.arm.some((r) => segObb(w1, w2, r))) target = 'arm';
    else if (regs.leg.some((r) => segObb(w1, w2, r))) target = 'leg';
    else if (segObb(w1, w2, regs.torso)) target = 'torso';
    else if (segCircle(w1, w2, regs.head, HEAD_R)) target = 'head';
    if (target) return { step, time: step * DT, tau, target };
  }
  return null;
}

export type OpponentPose = 'stance' | 'block' | 'deflect' | 'evade';
export const OPPONENT_POSE_JP: Record<OpponentPose, string> = {
  stance: '構え',
  block: '受け止め（防御姿勢）',
  deflect: '受け流し（防御姿勢）',
  evade: '回避（防御姿勢）',
};

/** 相手の姿勢：構え、または防御一式の防御姿勢（中央のキーフレーム）。 */
export function opponentPoseOf(pose: OpponentPose, shield: ShieldName | null): { pose: Pose; defending: boolean } {
  if (pose === 'stance') return { pose: { ...STANCE }, defending: false };
  const prefix = shield === null ? 'weapononly' : shield === 'small' ? 'smallshield' : shield;
  return { pose: interpPose(kf(`defence-${prefix}-${pose}`).id, 0.5), defending: true };
}
