/**
 * Python の書式（f"{x:.Nf}"・round(x, N)）と同じ結果を返す数値整形。
 *
 * JS の toFixed は、2進数で厳密に「ちょうど半分」になる値（例: 2.5, 0.125）を
 * 大きい側へ丸めるが、Python は偶数側へ丸める。ログを Python 試作と一致させるため、
 * その場合だけ偶数側へ直す。それ以外は toFixed と Python の結果は同じになる。
 */
export function pyFixed(x: number, digits: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const ax = Math.abs(x);
  let body = ax.toFixed(digits);
  // ax * 10^digits が厳密に n + 0.5 になるのは、ax * 2^(digits+1) が奇数の整数のときだけ
  const k = ax * 2 ** (digits + 1);
  if (Number.isInteger(k) && k % 2 === 1) {
    // ax * 10^digits = k * 5^digits / 2。候補 floor / ceil のうち偶数を選ぶ
    const twice = k * 5 ** digits;
    const lo = (twice - 1) / 2;
    const n = lo % 2 === 0 ? lo : lo + 1;
    const s = String(n).padStart(digits + 1, '0');
    body = digits === 0 ? s : `${s.slice(0, -digits)}.${s.slice(-digits)}`;
  }
  return (neg ? '-' : '') + body;
}

/** Python の round(x, digits)。 */
export const pyRound = (x: number, digits: number): number => Number(pyFixed(x, digits));

/** Python の f"{n:+d}"。 */
export const pySigned = (n: number): string => (n >= 0 ? `+${n}` : String(n));
