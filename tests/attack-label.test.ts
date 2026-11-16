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

  it('すべての攻撃一式で、表示名が一式の強さ・攻撃方法・部位と一致する', () => {
    const attacks = [...KF.values()].filter((s) => s.kind === 'attack');
    expect(attacks.length).toBeGreaterThan(0);
    const STR: Record<string, string> = { feint: '牽制', normal: '通常', strong: '強' };
    const MET: Record<string, string> = { slash: '斬る', thrust: '突く' };
    const PRT: Record<string, string> = { head: '頭部', torso: '胴体', arm: '腕', leg: '脚' };
    for (const s of attacks) {
      expect(attackLabel(s.id), s.id).toBe(`デフォルト: ${STR[s.strength!]}攻撃（${MET[s.method!]}・${PRT[s.part!]}）`);
    }
  });

  it('攻撃の指定が誤っていれば、戦闘を始める前にエラーにする', () => {
    expect(() => new Sim({ policies: { A: 'none', B: 'none' }, atkSets: { A: 'defence-scutum-block' } })).toThrow(/not an attack set/);
    expect(() => new Sim({ policies: { A: 'none', B: 'none' }, auto: { A: 'gladius-slash-mega' } })).toThrow(/unknown attack pattern/);
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
