/** 表示用の名前（判定には使わない）。段階の境界は設計書 5.8 と同じ。 */
export function staminaStageName(stamina: number): string {
  const r = stamina / 100;
  if (r > 0.5) return '余裕';
  if (r >= 0.25) return '低下';
  if (r >= 0.1) return '不足';
  return '枯渇';
}
