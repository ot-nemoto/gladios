import { describe, expect, it } from 'vitest';
import scenarios from '../src/scenarios/check-scenarios.json';
import { pyFixed } from '../src/sim/format';
import { record, type Recording } from '../src/sim/record';
import type { SimOptions } from '../src/sim/sim';
import { decisionPanelHtml, statusText } from '../src/ui/decision-panel';

/**
 * 判断の過程（#33）が、ログ（判定の正式な記録）と食い違わないことを確かめる。
 * 判断の過程は表示用で、ログ・結果は Python と一致したまま（sim-golden.test.ts）。
 */
const recs: [string, Recording][] = scenarios.map((sc) => [sc.name, record(sc.options as SimOptions)]);
const stamp = (t: number) => `[${pyFixed(t, 2).padStart(7)}]`;
/** ログ1行の頭（時刻と種類。判定の ev() と同じ書式）。 */
const head = (t: number, kind: string) => `${stamp(t)} ${kind.padEnd(6)} `;

describe('判断の過程の記録', () => {
  it('どの判断も、当てはまったルールはちょうど1つで、その手前は外れ、その先は見ていない', () => {
    for (const [name, rec] of recs) {
      for (const d of rec.trace.decisions) {
        const i = d.rules.findIndex((r) => r.result === 'matched');
        expect(i, `${name} ${d.t}`).toBeGreaterThanOrEqual(0);
        expect(d.rules.slice(0, i).every((r) => r.result === 'unmatched'), name).toBe(true);
        expect(d.rules.slice(i + 1).every((r) => r.result === 'notReached'), name).toBe(true);
      }
    }
  });

  it('判断で選んだ行動は、同じ時刻の行動開始のログと同じ', () => {
    for (const [name, rec] of recs) {
      expect(rec.trace.decisions.length, name).toBeGreaterThan(0);
      for (const d of rec.trace.decisions) {
        const line = `${head(d.t, '行動開始')}${d.actor}: ${d.action}`;
        expect(rec.log, `${name}`).toContain(line);
      }
    }
  });

  it('自動選択の判断には部位の点数があり、選んだ部位は選択のログと同じ', () => {
    let seen = 0;
    for (const [name, rec] of recs) {
      for (const d of rec.trace.decisions) {
        if (!d.select) continue;
        seen++;
        const line = rec.log.find((l) => l.startsWith(head(d.t, '選択')) && l.includes(` ${d.actor}: 自動選択`));
        expect(line, name).toBeDefined();
        if (d.select.part !== null) expect(line).toMatch(/→ (頭部|胴体|腕|脚)$/);
        for (const [p, sc] of Object.entries(d.select.scores)) {
          expect(sc === null, `${name} ${p}`).toBe(d.select.exposure[p as keyof typeof d.select.exposure] === null);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('反応の予定の結果は、防御への切り替えのログと対応する', () => {
    const outcomes = new Set<string>();
    for (const [name, rec] of recs) {
      for (const r of rec.trace.reactions) {
        expect(r.at, name).toBeCloseTo(r.t + r.detect + r.judgment + r.read, 9);
        if (r.outcome === undefined) continue;
        outcomes.add(r.outcome);
        const at = r.settledAt!;
        if (r.outcome === 'switched') {
          expect(rec.log.some((l) => l.startsWith(`${head(at, '行動開始')}${r.actor}: 防御に切替`)), name).toBe(true);
        } else if (r.outcome === 'tooLate') {
          expect(rec.log, name).toContain(`${head(at, '状態変化')}${r.actor}: 防御に切り替えられず（行動開始済み）`);
        } else {
          expect(rec.log.some((l) => l.startsWith(`${head(at, '行動開始')}${r.actor}: `)), name).toBe(true);
        }
      }
    }
    // 確認シナリオで、3 つの結果がどれも実際に起きている
    expect([...outcomes].sort()).toEqual(['cancelled', 'switched', 'tooLate']);
  });
});

describe('判断パネル', () => {
  it('どのシナリオのどの時点でも、パネルの文言に未定義や非数が出ない', () => {
    for (const [name, rec] of recs) {
      const step = Math.max(1, Math.floor(rec.frames.length / 300));
      for (let k = 0; k < rec.frames.length; k += step) {
        for (const id of ['A', 'B'] as const) {
          const out = decisionPanelHtml(rec, id, k, false);
          expect(out, `${name} ${k} ${id}`).not.toMatch(/undefined|NaN|null/);
          expect(statusText(rec.frames[k]![id].status, rec.frames[k]!.t)).not.toBe('');
        }
      }
    }
  });

  it('判断の過程と段階が、その時点の状態を表す', () => {
    // 戦闘3：A は脚狙いの固定、B は受け止め
    const rec = recs.find(([n]) => n.startsWith('戦闘3'))![1];
    const d = rec.trace.decisions.find((x) => x.actor === 'A' && x.spacing)!;
    expect(d.rules.at(-1)!.result).toBe('matched');
    expect(d.spacing!.setId).toBe('gladius-slash-normal-leg');
    const k = rec.frames.findIndex((f) => f.A.status.kind === 'attack');
    const html = decisionPanelHtml(rec, 'A', k, false);
    expect(html).toContain('攻撃：通常攻撃（斬る・脚）');
    expect(html).toContain('デフォルト: 攻撃');
    // B は A の構えを見て、受け止めへの切り替えを予定している
    const kb = rec.frames.findIndex((f) => f.A.status.kind === 'hold');
    expect(decisionPanelHtml(rec, 'B', kb, false)).toMatch(/受け止めへ切り替える予定/);
  });
});
