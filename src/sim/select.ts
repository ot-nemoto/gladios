/** 攻撃対象部位の自動選択（v3.11、v3.37 で防御の薄さを軌道で評価）。 */
import { COMPAT, KF, PARTS, clampToArena, type Part } from './data';
import { HEAD_R, fkPoints, interpPose, regionsOf, type BodyRef, type Regions } from './body';
import { segCircle, segObb, type Obb } from './geometry';
import type { Glad } from './glad';
import { injuryDegree } from './rules';

const SCAN_STEPS = 240;

function partBoxes(regs: Regions, part: Exclude<Part, 'head'>): Obb[] {
  const r = regs[part];
  return Array.isArray(r) ? r : [r];
}

function touchesPart(w1: readonly [number, number], w2: readonly [number, number], regs: Regions, part: Part) {
  if (part === 'head') return segCircle(w1, w2, regs.head, HEAD_R);
  return partBoxes(regs, part).some((b) => segObb(w1, w2, b));
}

interface Scan {
  shieldStep: number | null;
  armStep: number | null;
  /** 軌道が部位に最初に触れるステップ。null なら届かない（足切り）。 */
  partStep: number | null;
}

/**
 * 一式の軌道を 0〜1 の 241 点で走査し、盾・相手の腕・狙う部位に最初に触れるステップを求める。
 * 部位に触れた時点で打ち切る（それ以降は防御の薄さの評価に影響しない）。
 */
function scanTrajectory(atk: BodyRef, setId: string, part: Part, regs: Regions): Scan {
  let shieldStep: number | null = null;
  let armStep: number | null = null;
  let partStep: number | null = null;
  for (let i = 0; i <= SCAN_STEPS; i++) {
    if (partStep !== null && i > partStep) break;
    const P = fkPoints(atk, interpPose(setId, i / SCAN_STEPS));
    const w1 = P.grip;
    const w2 = P.tip;
    if (shieldStep === null && regs.shield && segObb(w1, w2, regs.shield)) shieldStep = i;
    if (part !== 'arm' && armStep === null && regs.arm.some((b) => segObb(w1, w2, b))) armStep = i;
    if (partStep === null && touchesPart(w1, w2, regs, part)) partStep = i;
  }
  return { shieldStep, armStep, partStep };
}

/**
 * 防御の薄さ：0 = 部位より先に盾に触れる、1 = 先に相手の腕に触れる、
 * 2 = 防具のみで覆われる、3 = 露出。スィカは盾が先でも 1 とする。
 */
function exposureOf(atk: Glad, setId: string, part: Part, scan: Scan): number {
  const { shieldStep, armStep, partStep } = scan;
  let cover: [number, number] | null = null; // [step, tier]。同じステップなら盾が優先
  if (shieldStep !== null && (partStep === null || shieldStep <= partStep)) cover = [shieldStep, 0];
  if (armStep !== null && (partStep === null || armStep <= partStep)) {
    if (cover === null || armStep < cover[0]) cover = [armStep, 1];
  }
  if (cover !== null) {
    let tier = cover[1];
    if (tier === 0 && setId.startsWith('sica-')) tier = 1;
    return tier;
  }
  return (atk.opp.armour[part] ?? 0) > 0 ? 2 : 3;
}

export type PartScores = Record<Part, number | null>;

/**
 * 一式の基準間合いに立ったときの足裏の位置（v3.44）。基準間合いのない一式は今の位置。
 * その位置が移動範囲の外なら、移動範囲の端を使う。
 */
export function refTargetX(g: Glad, setId: string): number {
  const ref = KF.get(setId)?.refDistance;
  if (ref === undefined) return g.x;
  return clampToArena(g.opp.x - g.facing * ref);
}

/**
 * pattern は「武器-攻撃方法-強さ」（例: gladius-slash-normal）。
 * v3.44：各部位を、その部位を狙う一式の基準間合いに立った場合で採点する（相手の姿勢は判断時点）。
 * 基準間合いの位置が移動範囲の外なら、移動範囲の端に立った場合で採点する。
 */
export function selectPart(g: Glad, pattern: string): { part: Part | null; scores: PartScores } {
  const dfn = g.opp;
  const method = pattern.split('-')[1] as 'slash' | 'thrust';
  const { regs } = regionsOf(dfn, dfn.pose);
  const scores = {} as PartScores;
  for (const part of PARTS) {
    const sid = `${pattern}-${part}`;
    // 足切り（v3.11 / v3.44）：基準間合いでこの一式の軌道が部位に届くか（盾・腕による遮りは届く扱い）
    const atRef: BodyRef | null = KF.has(sid)
      ? { x: refTargetX(g, sid), facing: g.facing, wlen: g.wlen, shieldHalf: g.shieldHalf }
      : null;
    const scan = atRef ? scanTrajectory(atRef, sid, part, regs) : null;
    if (scan === null || scan.partStep === null) {
      scores[part] = null;
      continue;
    }
    const inj = ([0, 1, 1, 2] as const)[injuryDegree(dfn, part)];
    scores[part] = exposureOf(g, sid, part, scan) * 100 + COMPAT[method][part] * 10 + inj;
  }
  let best: Part | null = null;
  // 同点時の固定順（v3.44 で脚を腕より前に）
  for (const part of ['torso', 'head', 'leg', 'arm'] as const) {
    const s = scores[part];
    if (s !== null && (best === null || s > scores[best]!)) best = part;
  }
  return { part: best, scores };
}
