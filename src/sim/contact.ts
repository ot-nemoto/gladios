/** 武器線分が相手のどこに触れたかの分類（戦闘の判定とモーション図鑑で共用）。 */
import { HEAD_R, type Regions } from './body';
import type { Part } from './data';
import { segCircle, segObb, segSeg, type Vec } from './geometry';

export type ContactTarget = 'shield' | 'weapon' | Part;

/** R1b（v3.40）：武器での受けは、攻撃の進行が実行開始印（0.35）に達してから成立する。 */
export const WEAPON_PARRY_FROM = 0.35;

/**
 * 同じステップ内で複数に触れていれば 盾 → 武器 → 腕 → 脚 → 胴体 → 頭部 の順に1つに決める（v3.7）。
 * - 武器は相手が防御行動中のときだけ数える。実行開始印より前の剣同士の接触は
 *   構え同士の触れ合い（'bind'）で、攻撃を解決しない
 * - shieldDown：受け流しが大きく外れて盾が弾かれた攻撃は、盾をすり抜ける
 */
export function classifyContact(
  w1: Vec,
  w2: Vec,
  regs: Regions,
  o: { defending: boolean; progress: number; shieldDown?: boolean },
): ContactTarget | 'bind' | null {
  if (regs.shield && !o.shieldDown && segObb(w1, w2, regs.shield)) return 'shield';
  if (o.defending && segSeg(w1, w2, regs.weapon[0], regs.weapon[1])) {
    return o.progress < WEAPON_PARRY_FROM ? 'bind' : 'weapon';
  }
  if (regs.arm.some((r) => segObb(w1, w2, r))) return 'arm';
  if (regs.leg.some((r) => segObb(w1, w2, r))) return 'leg';
  if (segObb(w1, w2, regs.torso)) return 'torso';
  if (segCircle(w1, w2, regs.head, HEAD_R)) return 'head';
  return null;
}
