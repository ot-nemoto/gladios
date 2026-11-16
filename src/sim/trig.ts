/**
 * 判定で使う三角関数・平方根系の唯一の入口。
 *
 * sim/ 配下では Math.sin / Math.cos / Math.hypot を直接呼ばず、必ずここを経由する。
 * 現在は Python 試作と値を一致させるため標準の Math を使う（案A）。
 * 環境間の完全一致が必要になったら（リプレイ実装時が目安）、ここだけを
 * 四則演算のみの自前実装（案B）に差し替える。
 */

/** Python の math.radians と同じ計算（x * (pi / 180)）。 */
const DEG_TO_RAD = Math.PI / 180;
export const radians = (deg: number): number => deg * DEG_TO_RAD;

export const sin = (rad: number): number => Math.sin(rad);
export const cos = (rad: number): number => Math.cos(rad);
export const hypot = (x: number, y: number): number => Math.hypot(x, y);
