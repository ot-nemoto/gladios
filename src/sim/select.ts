/** 攻撃対象部位の自動選択（v3.11、v3.37 で防御の薄さを軌道で評価）。 */
import { COMPAT, KF, PARTS, type Part } from './data';
import { HEAD_R, fkPoints, interpPose, regionsOf, type Regions } from './body';
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

/**
 * 防御の薄さ：0 = 部位より先に盾に触れる、1 = 先に相手の腕に触れる、
 * 2 = 防具のみで覆われる、3 = 露出。スィカは盾が先でも 1 とする。
 */
function exposureOf(atk: Glad, setId: string, part: Part, regs: Regions): number {
  const dfn = atk.opp;
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
  return (dfn.armour[part] ?? 0) > 0 ? 2 : 3;
}

/** 足切り：現在の距離で、この一式の軌道がその部位に届くか（盾・腕による遮りは届く扱い）。 */
function partReachable(atk: Glad, setId: string, part: Part, regs: Regions): boolean {
  for (let i = 0; i <= SCAN_STEPS; i++) {
    const P = fkPoints(atk, interpPose(setId, i / SCAN_STEPS));
    if (touchesPart(P.grip, P.tip, regs, part)) return true;
  }
  return false;
}

export type PartScores = Record<Part, number | null>;

/** pattern は「武器-攻撃方法-強さ」（例: gladius-slash-normal）。 */
export function selectPart(g: Glad, pattern: string): { part: Part | null; scores: PartScores } {
  const dfn = g.opp;
  const method = pattern.split('-')[1] as 'slash' | 'thrust';
  const { regs } = regionsOf(dfn, dfn.pose);
  const scores = {} as PartScores;
  for (const part of PARTS) {
    const sid = `${pattern}-${part}`;
    if (!KF.has(sid) || !partReachable(g, sid, part, regs)) {
      scores[part] = null;
      continue;
    }
    const inj = ([0, 1, 1, 2] as const)[injuryDegree(dfn, part)];
    scores[part] = exposureOf(g, sid, part, regs) * 100 + COMPAT[method][part] * 10 + inj;
  }
  let best: Part | null = null;
  for (const part of ['torso', 'head', 'arm', 'leg'] as const) {
    const s = scores[part];
    if (s !== null && (best === null || s > scores[best]!)) best = part;
  }
  return { part: best, scores };
}
