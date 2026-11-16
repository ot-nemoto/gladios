import { describe, expect, it } from 'vitest';
import { KF } from '../src/sim/data';
import { Sim, attackLabel } from '../src/sim/sim';

// 攻撃の表示名は一式のデータ（強さ・攻撃方法・部位）から作る（#11）
describe('attackLabel', () => {
  it.each([
    ['gladius-slash-strong-torso', 'デフォルト: 強攻撃（斬る・胴体）'],
    ['gladius-thrust-normal-torso', 'デフォルト: 通常攻撃（突く・胴体）'],
    ['gladius-slash-feint-head', 'デフォルト: 牽制攻撃（斬る・頭部）'],
    ['pugio-thrust-strong-leg', 'デフォルト: 強攻撃（突く・脚）'],
    ['sica-slash-feint-arm', 'デフォルト: 牽制攻撃（斬る・腕）'],
  ])('%s', (id, want) => {
    expect(attackLabel(id)).toBe(want);
  });

  it('全 72 の攻撃一式で、表示名に undefined が入らない', () => {
    const attacks = [...KF.values()].filter((s) => s.kind === 'attack');
    expect(attacks).toHaveLength(72);
    for (const s of attacks) expect(attackLabel(s.id)).not.toMatch(/undefined/);
  });

  it('攻撃以外の一式はエラーにする（Python 試作も同じ）', () => {
    expect(() => attackLabel('common-advance-1m')).toThrow(/not an attack set/);
    expect(() => attackLabel('defence-scutum-block')).toThrow(/not an attack set/);
  });

  it('自動選択でも、強さ・攻撃方法を表示名に反映する（確認シナリオの自動選択は「通常」だけなので別に確かめる）', () => {
    const sim = new Sim({ policies: { A: 'none', B: 'none' }, passive: ['B'], auto: { A: 'gladius-thrust-strong' }, cap: 10 });
    sim.b.decisionAt = Infinity; // ダミーはその場に立たせる（1.5m 以上だと寄ってくるため、#26）
    const hold = sim.run().log.find((l) => /A: 構え（/.test(l));
    expect(hold).toMatch(/A: 構え（デフォルト: 強攻撃（突く・(頭部|胴体|腕|脚)））/);
  });
});
