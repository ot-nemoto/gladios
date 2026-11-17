import { describe, expect, it } from 'vitest';
import scenarios from '../src/scenarios/check-scenarios.json';
import { Sim, type SimOptions } from '../src/sim/sim';
import {
  fitToWeapon,
  optionsFromSettings,
  patternsFor,
  settingsFromOptions,
  setsFor,
  WEAPON_CHOICES,
} from '../src/ui/settings';

describe('ビューアの設定と判定の入力の変換（#33）', () => {
  it('確認シナリオを設定に読み込んで戻すと、同じ戦闘になる', () => {
    for (const sc of scenarios) {
      const o = sc.options as SimOptions;
      const back = optionsFromSettings(settingsFromOptions(o));
      const a = new Sim(o).run();
      const b = new Sim(back).run();
      expect(b.log, sc.name).toEqual(a.log);
      expect(b.summary, sc.name).toEqual(a.summary);
    }
  }, 60_000);

  it('読み込んだ設定の一式・パターンは、その武器の選択肢にある', () => {
    for (const sc of scenarios) {
      const s = settingsFromOptions(sc.options as SimOptions);
      for (const g of [s.A, s.B]) {
        expect(setsFor(g.weapon).map((x) => x.id), sc.name).toContain(g.set);
        expect(patternsFor(g.weapon), sc.name).toContain(g.pattern);
      }
    }
  });

  it('武器を変えると、一式・パターンをその武器のものに合わせ、両手持ちは盾を外す', () => {
    const s = settingsFromOptions({ policies: { A: 'block', B: 'block' }, atkSets: { A: 'gladius-thrust-strong-leg' } });
    const t = fitToWeapon({ ...s.A, weapon: 'trident' });
    expect(t.shield).toBeNull();
    expect(setsFor('trident').map((x) => x.id)).toContain(t.set);
    expect(patternsFor('trident')).toContain(t.pattern);
    // 攻撃方法・強さ・部位が同じ一式があればそれを選ぶ
    const sica = fitToWeapon({ ...s.A, weapon: 'sica', set: 'gladius-slash-strong-head' });
    expect(sica.set).toBe('sica-slash-strong-head');
  });

  it('攻撃しない側・盾なしの盾押しは、読み込み時に外す（画面で選べない設定を判定に渡さない）', () => {
    const s = settingsFromOptions({
      policies: { A: 'block', B: 'block' },
      passive: ['A'],
      pushUsers: { A: 'push', B: 'mix' },
      equip: { B: { shield: null } },
    });
    expect([s.A.push, s.B.push]).toEqual(['off', 'off']);
    expect(optionsFromSettings(s).pushUsers).toEqual({});
  });

  it('どの武器にも攻撃一式と自動選択のパターンがある', () => {
    for (const w of WEAPON_CHOICES) {
      expect(setsFor(w).length, w).toBeGreaterThan(0);
      expect(patternsFor(w).length, w).toBeGreaterThan(0);
    }
  });
});
