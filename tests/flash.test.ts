import { describe, expect, it } from 'vitest';
import { contactFlash } from '../src/render/arena';

// 接触ログの全種類（tests/golden に出現するもの＋試作が出しうるもの）と、光らせ方の対応
describe('contactFlash', () => {
  it.each([
    ['A の攻撃 → B の脚に命中', { target: 'B', flash: 'hit' }],
    ['B の攻撃 → A の頭部に命中', { target: 'A', flash: 'hit' }],
    ['A の攻撃 → B の盾に接触', { target: 'B', flash: 'block' }],
    ['A の攻撃 → B の武器に接触', { target: 'B', flash: 'block' }],
    ['B の攻撃 → A が受け流した（武器を-30度そらし、威力P=30に低下）', { target: 'A', flash: 'block' }],
    ['B の攻撃 → A の受け流しが合わない（盾が弾かれる）', { target: 'A', flash: 'block' }],
    ['B の攻撃 → A の盾が弾かれた（受け流しが大きく外れた、威力P=50で継続）', { target: 'A', flash: 'block' }],
    ['B の攻撃 → A の武器を滑り落ちた（衝撃なし）', { target: 'A', flash: 'block' }],
    ['B の攻撃 → A の盾を滑り落ちた（衝撃なし）', { target: 'A', flash: 'block' }],
    ['A の盾が B に接触（押し込み）', { target: 'B', flash: 'block' }],
    ['B の攻撃 → A の盾に接触（回避中につき防御処理なし）', null],
    ['A の押し込み → B は回避中（押しは空振り）', null],
  ])('%s', (text, want) => {
    expect(contactFlash(text)).toEqual(want);
  });
});
