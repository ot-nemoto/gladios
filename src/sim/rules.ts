/** 状態から導く値（段階・判断レベル・遅延・時間倍率など）。 */
import { KF, STAGE, type Part, type Stage } from './data';
import type { Glad, StaminaStageName } from './glad';

export function stageOf(E: number): Stage {
  for (const [lim, name] of STAGE) if (E < lim) return name;
  throw new Error(`unreachable stage for E=${E}`);
}

/** スタミナ段階：名前・行動時間倍率・判断レベル補正。 */
export function staminaStage(g: Glad): [StaminaStageName, number, number] {
  const r = g.stamina / 100.0;
  if (r > 0.5) return ['余裕', 1.0, 0];
  if (r >= 0.25) return ['低下', 1.1, 10];
  if (r >= 0.1) return ['不足', 1.25, 25];
  return ['枯渇', 1.5, 40];
}

export function injuryDegree(g: Glad, part: Part): 0 | 1 | 2 | 3 {
  const p = g.injury[part];
  return p === 0 ? 0 : p <= 2 ? 1 : p <= 6 ? 2 : 3;
}

const HEAD_PEN = [0, 5, 15, 30] as const;

export function judgmentLevel(g: Glad): number {
  let penSum: number = staminaStage(g)[2];
  if (g.posture < 50) penSum += 10;
  penSum += HEAD_PEN[injuryDegree(g, 'head')];
  return g.judgmentBase - penSum * (1 - 50 / 200);
}

export const holdTime = (g: Glad): number => Math.max(0.05, 0.3 + 0.004 * judgmentLevel(g));

export const judgmentDelay = (g: Glad): number => 0.25 - 0.002 * judgmentLevel(g);

/** 読み（v3.43）：構えから攻撃の長さを読み、防御開始を遅らせる量。 */
export function readShift(dfn: Glad, setId: string | null): number {
  const s = setId === null ? undefined : KF.get(setId);
  if (!s) return 0.0;
  return ((s.baseTime ?? 1.0) - 1.0) * judgmentLevel(dfn) / 100.0;
}

export const DETECTION_DELAY = 0.4 - 0.003 * 50; // 0.25s

export function totalTimeMult(g: Glad): number {
  const sm = staminaStage(g)[1];
  const pm = g.posture > 0 && g.posture < 50 ? 1.2 : 1.0;
  return Math.min(2.0, 1.0 * sm * pm);
}
