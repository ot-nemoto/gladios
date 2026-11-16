/**
 * 戦闘判定のデータ表（設計書の決定値・仮置き値）とキーフレームの読み込み。
 * 値は Python 試作 sim_prototype.py と同じ。
 */
import keyframesJson from '../data/keyframes-full.json';
import conditionsJson from '../data/check-conditions-v1.json';

export type Part = 'head' | 'torso' | 'arm' | 'leg';
export const PARTS: readonly Part[] = ['head', 'torso', 'arm', 'leg'];
export const PART_JP: Record<Part, string> = { head: '頭部', torso: '胴体', arm: '腕', leg: '脚' };

export type Stage = '軽微' | '通常' | '重傷' | '致命傷';
export const STAGE_ORDER: readonly Stage[] = ['軽微', '通常', '重傷', '致命傷'];

export type WeaponName = 'gladius' | 'sica' | 'pugio' | 'trident' | 'hasta';
export type ShieldName = 'scutum' | 'parmula' | 'small';

export interface ShieldPose {
  dx: number;
  dy: number;
  angle: number;
}

/** 姿勢：各部位の絶対角度（度）、股関節点、武器角度、盾（任意）。 */
export interface Pose {
  torso: number;
  upperArm: number;
  forearm: number;
  thigh: number;
  shin: number;
  hip: readonly [number, number];
  weaponAngle: number;
  shield?: ShieldPose;
}

export interface Keyframe extends Pose {
  t: number;
}

export interface KeyframeSet {
  id: string;
  weapon?: string;
  kind: string;
  method?: 'slash' | 'thrust';
  strength?: 'feint' | 'normal' | 'strong';
  part?: string;
  baseTime?: number;
  refDistance?: number;
  markers?: { executionStart: number; finalPhaseStart: number };
  keyframes: Keyframe[];
}

export const KF: ReadonlyMap<string, KeyframeSet> = new Map(
  (keyframesJson.sets as unknown as KeyframeSet[]).map((s) => [s.id, s]),
);

export function kf(id: string): KeyframeSet {
  const s = KF.get(id);
  if (!s) throw new Error(`unknown keyframe set: ${id}`);
  return s;
}

export interface GladiatorSpec {
  id: string;
  startX: number;
  facing: 1 | -1;
  equipment?: {
    weapon?: WeaponName;
    shield?: ShieldName | null;
    armour?: Partial<Record<Part, number>>;
  };
}

export const CONDITIONS = conditionsJson as unknown as { gladiators: GladiatorSpec[] };

export const DT = 0.005;
/** 体力・スタミナの最大値（試作は能力 50 の標準値で固定。設計書 5.7／5.8）。 */
export const HP_MAX = 150.0;
export const STAMINA_MAX = 100.0;
export const STAGE: readonly [number, Stage][] = [
  [20, '軽微'],
  [50, '通常'],
  [80, '重傷'],
  [10 ** 9, '致命傷'],
];
export const HP_LOSS: Record<Stage, number> = { 軽微: 4, 通常: 12, 重傷: 30, 致命傷: 60 };
export const INJ_PTS: Record<Stage, number> = { 軽微: 1, 通常: 2, 重傷: 4, 致命傷: 7 };
export const POSTURE_LOSS: Record<Stage, number> = { 軽微: 5, 通常: 15, 重傷: 30, 致命傷: 60 };
export const BLOCK_POSTURE: Record<Stage, number> = { 軽微: 0, 通常: 5, 重傷: 15, 致命傷: 30 };
export const BLOCK_STAMINA: Record<Stage, number> = { 軽微: 0, 通常: 3, 重傷: 8, 致命傷: 15 };
export const PART_MOD: Record<Part, number> = { head: 10, torso: 0, arm: -5, leg: -5 };
export const ARMOUR: Record<Part, number> = { head: 25, torso: 30, arm: 20, leg: 20 };

export const STANCE: Pose = {
  torso: 8,
  upperArm: 30,
  forearm: 70,
  thigh: 10,
  shin: -5,
  hip: [0.0, 0.93],
  weaponAngle: 40,
  shield: { dx: 0.26, dy: 0.02, angle: 0 },
};
export const STANCE_SHIELD: ShieldPose = { dx: 0.26, dy: 0.02, angle: 0 };

/** 設計書 v3.22（仮置き）。 */
export const WEAPONS: Record<WeaponName, { len: number; atk: number; block: number; weight: number }> = {
  gladius: { len: 0.5, atk: 50, block: 25, weight: 1.0 },
  sica: { len: 0.45, atk: 46, block: 12, weight: 0.9 },
  pugio: { len: 0.25, atk: 36, block: 5, weight: 0.6 },
  trident: { len: 1.6, atk: 46, block: 20, weight: 1.3 },
  hasta: { len: 1.9, atk: 52, block: 12, weight: 1.2 },
};

/** 設計書 v3.23（仮置き）。half = 盾の判定領域の縦の半分の長さ。 */
export const SHIELDS: Record<ShieldName, { half: number; def: number; weight: number }> = {
  scutum: { half: 0.5, def: 40, weight: 1.5 },
  parmula: { half: 0.275, def: 28, weight: 0.8 },
  small: { half: 0.175, def: 20, weight: 0.5 },
};

/** 攻撃威力 P への行動補正（v3.12）。 */
export const STRENGTH_CORR: Record<string, number> = { feint: -20, normal: 0, strong: 20 };

/** 武器×部位の相性表（v3.23）。 */
export const COMPAT: Record<'slash' | 'thrust', Record<Part, number>> = {
  slash: { head: 2, torso: 1, arm: 2, leg: 2 },
  thrust: { head: 1, torso: 2, arm: 1, leg: 1 },
};
