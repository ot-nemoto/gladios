import { describe, expect, it } from 'vitest';
import { pyFixed, pyRound, pySigned } from '../src/sim/format';

// 期待値は Python 3 の f"{x:.Nf}" / round(x, N) の結果
describe('Python と同じ数値整形', () => {
  it.each([
    [2.5, 0, '2'],
    [3.5, 0, '4'],
    [-2.5, 0, '-2'],
    [0.125, 2, '0.12'],
    [0.375, 2, '0.38'],
    [0.25, 1, '0.2'],
    [1.005, 2, '1.00'],
    [-0.3, 0, '-0'],
    [-0, 0, '-0'],
    [149.99999, 0, '150'],
    [12.344, 2, '12.34'],
    [0.5, 0, '0'],
    [1.5, 0, '2'],
  ])('pyFixed(%f, %i) = %s', (x, d, want) => {
    expect(pyFixed(x, d)).toBe(want);
  });
  it('pyRound', () => {
    expect(pyRound(2.675, 2)).toBe(2.67);
    expect(pyRound(0.125, 2)).toBe(0.12);
  });
  it('pySigned', () => {
    expect(pySigned(30)).toBe('+30');
    expect(pySigned(-30)).toBe('-30');
  });
});
