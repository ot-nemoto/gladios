/** 剣闘士1人ぶんの戦闘中の状態。 */
import {
  ARMOUR,
  HP_MAX,
  PARTS,
  SHIELDS,
  STAMINA_MAX,
  STANCE,
  WEAPONS,
  effectiveShield,
  type GladiatorSpec,
  type Part,
  type Pose,
  type ShieldName,
  type WeaponName,
} from './data';

export type ActionKind = 'attack' | 'defence' | 'push' | 'postureRecovery' | 'approach' | 'wait';
export type Policy = 'block' | 'evade' | 'deflect' | 'none';

/** 実行中の行動。Python 試作の dict と同じ項目を持つ（種類ごとに使う項目が違う）。 */
export interface Action {
  kind: ActionKind;
  set: string | null;
  start: number;
  dur: number;
  label: string;
  // attack / push
  resolved?: boolean;
  P?: number;
  holdStart?: number | null;
  waOffset?: number;
  shieldDown?: boolean;
  deflected?: boolean;
  deflectJudged?: boolean;
  deflectFailed?: boolean;
  slide?: boolean;
  slideLogged?: boolean;
  // defence
  policy?: Policy;
  phase?: 'enter' | 'hold' | 'exit';
  forHold?: number | null;
  exitStart?: number;
  // approach
  travelled?: number;
  until?: number;
}

export interface Hold {
  set: string;
  label: string;
  until: number;
  start: number;
}

export interface GladStats {
  dealt: number;
  hits: number;
  blocks: number;
  blocked: number;
  maxHit: number;
  evades: number;
  deflects: number;
}

export type StaminaStageName = '余裕' | '低下' | '不足' | '枯渇';

export class Glad {
  readonly id: string;
  x: number;
  readonly facing: 1 | -1;
  hp = HP_MAX;
  stamina = STAMINA_MAX;
  posture = 100.0;
  injury: Record<Part, number> = { head: 0, torso: 0, arm: 0, leg: 0 };
  armour: Record<Part, number>;

  weaponName!: WeaponName;
  wlen!: number;
  watk!: number;
  wblock!: number;
  wweight!: number;
  shieldName!: ShieldName | null;
  shieldHalf!: number | null;
  shieldDef!: number;
  equipMult!: number;

  action: Action | null = null;
  judgmentBase = 50;
  techniqueBase = 50;
  decisionAt = 0;
  hold: Hold | null = null;
  /** この剣闘士の予定中の反応が、どの構え（開始時刻）に対するものか。 */
  switchFor: number | null = null;
  /** 現在・直前の回避がどの構え（開始時刻）に対するものか。 */
  evadeFor: number | null = null;
  /** 現在の行動の姿勢の進み具合（受け流しの判定用）。 */
  poseTau = 0.0;
  /** 予定された防御への切り替え時刻。 */
  switchAt: number | null = null;
  collapsed = false;
  pose: Pose = { ...STANCE };
  stats: GladStats = { dealt: 0, hits: 0, blocks: 0, blocked: 0, maxHit: 0, evades: 0, deflects: 0 };
  lastStaminaStage: StaminaStageName | null = null;

  // 相手は Sim の構築時に結ぶ
  opp!: Glad;

  constructor(spec: GladiatorSpec) {
    this.id = spec.id;
    this.x = spec.startX;
    this.facing = spec.facing;
    const eq = spec.equipment ?? {};
    const armour = {} as Record<Part, number>;
    for (const k of PARTS) armour[k] = eq.armour?.[k] ?? ARMOUR[k];
    this.armour = armour;
    applyEquip(this, eq.weapon ?? 'gladius', eq.shield === undefined ? 'scutum' : eq.shield);
  }
}

export function applyEquip(g: Glad, weaponName: WeaponName, shieldName: ShieldName | null): void {
  g.weaponName = weaponName;
  const w = WEAPONS[weaponName];
  g.wlen = w.len;
  g.watk = w.atk;
  g.wblock = w.block;
  g.wweight = w.weight;
  shieldName = effectiveShield(weaponName, shieldName); // 両手持ち（v3.22）は盾なし
  g.shieldName = shieldName;
  const sh = shieldName ? SHIELDS[shieldName] : null;
  g.shieldHalf = sh ? sh.half : null;
  g.shieldDef = sh ? sh.def : 0;
  g.equipMult = 0.8 + 0.04 * (g.wweight + (sh ? sh.weight : 0.0));
}
