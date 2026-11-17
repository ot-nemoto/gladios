/**
 * 戦闘ビューアの設定（剣闘士ごとの考え方と装備）と、判定の入力（SimOptions）との相互変換（#33）。
 * 確認シナリオは「設定の初期値」として読み込み、画面で A・B それぞれを変えて戦わせる。
 */
import {
  CONDITIONS,
  KF,
  MIX_PUSH_WHILE,
  METHOD_JP,
  PART_JP,
  STRENGTH_JP,
  effectiveShield,
  isTwoHanded,
  type KeyframeSet,
  type Part,
  type ShieldName,
  type WeaponName,
} from '../sim/data';
import type { Policy } from '../sim/glad';
import type { GladId, SimOptions } from '../sim/sim';

export const GLAD_IDS: readonly GladId[] = ['A', 'B'];

/** 攻撃のしかた：攻撃しない（ダミー）／固定の一式／部位の自動選択。 */
export type AttackMode = 'none' | 'fixed' | 'auto';
export type PushMode = 'off' | 'push' | 'mix';

export interface GladSettings {
  weapon: WeaponName;
  shield: ShieldName | null;
  policy: Policy;
  attack: AttackMode;
  /** 固定のときの攻撃一式。 */
  set: string;
  /** 自動選択のときの「武器-攻撃方法-強さ」。 */
  pattern: string;
  push: PushMode;
  /** 判断能力（既定 50）。 */
  judgment: number;
  /** 防具の上書き（画面では変えず、シナリオの値をそのまま引き継ぐ）。 */
  armour?: Partial<Record<Part, number>>;
}

export interface BattleSettings {
  A: GladSettings;
  B: GladSettings;
  /** 時間上限（秒）。 */
  cap: number;
  /** 攻撃しない側の接近先（シナリオの値を引き継ぐ）。 */
  approachUntil?: number;
}

/** 試作の既定の攻撃一式（Sim の固定分岐と同じ）。 */
const DEFAULT_SET = 'gladius-slash-normal-torso';
const DEFAULT_CAP = 180;
const DEFAULT_JUDGMENT = 50;

const attackSets = (): KeyframeSet[] => [...KF.values()].filter((s) => s.kind === 'attack');

/** その武器で使える攻撃一式（データの順）。 */
export function setsFor(weapon: WeaponName): KeyframeSet[] {
  return attackSets().filter((s) => s.weapon === weapon);
}

/** その武器で使える自動選択のパターン（「武器-攻撃方法-強さ」）。 */
export function patternsFor(weapon: WeaponName): string[] {
  return [...new Set(setsFor(weapon).map((s) => `${s.weapon}-${s.method}-${s.strength}`))];
}

/** 一式の短い名前（例「通常・斬る・胴体」）。 */
export function setShortLabel(set: KeyframeSet): string {
  return `${STRENGTH_JP[set.strength!]}・${METHOD_JP[set.method!]}・${PART_JP[set.part as Part]}`;
}

/** パターンの短い名前（例「通常・斬る」）。 */
export function patternLabel(pattern: string): string {
  const [, method, strength] = pattern.split('-') as [string, keyof typeof METHOD_JP, keyof typeof STRENGTH_JP];
  return `${STRENGTH_JP[strength]}・${METHOD_JP[method]}`;
}

/**
 * 設定を、画面で選べる組み合わせに合わせる。
 * - 攻撃一式とパターンをその武器で使えるものにする（攻撃方法・強さ・部位はなるべく保つ）
 * - 両手持ちは盾なし
 * - 攻撃しない側・盾なしは盾押しを使わない（画面で選べないので、設定からも外す）
 */
export function fitToWeapon(g: GladSettings): GladSettings {
  const sets = setsFor(g.weapon);
  const pick = (want: string[]): KeyframeSet => {
    const [, method, strength, part] = want;
    return (
      sets.find((s) => s.method === method && s.strength === strength && s.part === part) ??
      sets.find((s) => s.method === method && s.strength === strength) ??
      sets.find((s) => s.strength === 'normal' && s.part === 'torso') ??
      sets[0]!
    );
  };
  const set = setsFor(g.weapon).some((s) => s.id === g.set) ? g.set : pick(g.set.split('-')).id;
  const patterns = patternsFor(g.weapon);
  let pattern = g.pattern;
  if (!patterns.includes(pattern)) {
    const [, method, strength] = pattern.split('-');
    pattern = patterns.find((p) => p.endsWith(`-${method}-${strength}`)) ?? patterns.find((p) => p.endsWith('-normal')) ?? patterns[0]!;
  }
  const shield = effectiveShield(g.weapon, g.shield);
  const push = g.attack === 'none' || shield === null ? 'off' : g.push;
  return { ...g, set, pattern, shield, push };
}

/** 確認シナリオの条件 → 画面の設定。 */
export function settingsFromOptions(o: SimOptions): BattleSettings {
  const one = (id: GladId): GladSettings => {
    const spec = CONDITIONS.gladiators.find((g) => g.id === id)!;
    const eq = o.equip?.[id];
    const weapon = eq?.weapon ?? spec.equipment?.weapon ?? 'gladius';
    const specShield = spec.equipment?.shield === undefined ? 'scutum' : spec.equipment.shield;
    const shield = effectiveShield(weapon, eq && 'shield' in eq ? (eq.shield ?? null) : specShield);
    const auto = o.auto?.[id];
    const fixed = o.atkSets?.[id] ?? DEFAULT_SET;
    const attack: AttackMode = o.passive?.includes(id) ? 'none' : auto !== undefined ? 'auto' : 'fixed';
    const base: GladSettings = {
      weapon,
      shield,
      policy: o.policies[id],
      attack,
      set: fixed,
      pattern: auto ?? fixed.split('-').slice(0, 3).join('-'),
      push: o.pushUsers?.[id] ?? 'off',
      judgment: o.judgment?.[id] ?? DEFAULT_JUDGMENT,
    };
    if (o.armour?.[id]) base.armour = { ...o.armour[id] };
    return fitToWeapon(base);
  };
  const s: BattleSettings = { A: one('A'), B: one('B'), cap: o.cap ?? DEFAULT_CAP };
  if (o.approachUntil !== undefined) s.approachUntil = o.approachUntil;
  return s;
}

/** 画面の設定 → 判定の入力。 */
export function optionsFromSettings(s: BattleSettings): SimOptions {
  const o: SimOptions = {
    policies: { A: s.A.policy, B: s.B.policy },
    cap: s.cap,
    atkSets: {},
    auto: {},
    passive: [],
    pushUsers: {},
    equip: {},
    judgment: {},
    armour: {},
  };
  for (const id of GLAD_IDS) {
    const g = s[id];
    o.equip![id] = { weapon: g.weapon, shield: effectiveShield(g.weapon, g.shield) };
    if (g.attack === 'none') o.passive!.push(id);
    else if (g.attack === 'auto') o.auto![id] = g.pattern;
    else o.atkSets![id] = g.set;
    if (g.push !== 'off') o.pushUsers![id] = g.push;
    if (g.judgment !== DEFAULT_JUDGMENT) o.judgment![id] = g.judgment;
    if (g.armour) o.armour![id] = { ...g.armour };
  }
  if (s.approachUntil !== undefined) o.approachUntil = s.approachUntil;
  return o;
}

export const WEAPON_CHOICES: readonly WeaponName[] = ['gladius', 'sica', 'pugio', 'trident', 'hasta'];
export const SHIELD_CHOICES: readonly (ShieldName | null)[] = ['scutum', 'parmula', 'small', null];
export const POLICY_CHOICES: readonly Policy[] = ['block', 'deflect', 'evade', 'none'];
export const POLICY_JP: Record<Policy, string> = { block: '受け止め', deflect: '受け流し', evade: '回避', none: '防御しない' };
export const ATTACK_JP: Record<AttackMode, string> = { fixed: '固定の一式', auto: '部位を自動選択', none: '攻撃しない' };
export const PUSH_JP: Record<PushMode, string> = { off: '使わない', push: '押しのみ', mix: `押し＋攻撃（相手の体勢${MIX_PUSH_WHILE}未満で攻撃）` };
export { isTwoHanded };
