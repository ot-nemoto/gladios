/**
 * 「描画と判定が一致しているか」を目視の代わりに数値で確かめる。
 *
 * 描画は記録（Recording）だけを読み、判定と同じ regionsOf で体を描く。そこで、
 * ログに接触が出た瞬間のフレームについて、記録データだけから剣・盾・身体の
 * 図形を作り直し、ログの言うとおりに交わっているかを全シナリオで調べる。
 * あわせて、足が地面にめり込む・すれ違うなどの見た目の破綻がないかも調べる。
 */
import { describe, expect, it } from 'vitest';
import scenarios from '../src/scenarios/check-scenarios.json';
import { HEAD_R, regionsOf, type Regions } from '../src/sim/body';
import { segCircle, segObb, segSeg, type Vec } from '../src/sim/geometry';
import { ARENA_HALF } from '../src/sim/data';
import { record, type Frame, type Recording } from '../src/sim/record';
import type { GladId, SimOptions } from '../src/sim/sim';

const PART_BY_JP: Record<string, 'head' | 'torso' | 'arm' | 'leg'> = {
  頭部: 'head',
  胴体: 'torso',
  腕: 'arm',
  脚: 'leg',
};

const other = (id: GladId): GladId => (id === 'A' ? 'B' : 'A');

function geom(rec: Recording, f: Frame, id: GladId) {
  return regionsOf({ ...rec.bodies[id], x: f[id].x }, f[id].pose);
}

function touchesPart(w: [Vec, Vec], regs: Regions, part: 'head' | 'torso' | 'arm' | 'leg'): boolean {
  if (part === 'head') return segCircle(w[0], w[1], regs.head, HEAD_R);
  if (part === 'torso') return segObb(w[0], w[1], regs.torso);
  return regs[part].some((b) => segObb(w[0], w[1], b));
}

const touchesShield = (w: [Vec, Vec], regs: Regions) => !!regs.shield && segObb(w[0], w[1], regs.shield);
const touchesWeapon = (w: [Vec, Vec], regs: Regions) => segSeg(w[0], w[1], regs.weapon[0], regs.weapon[1]);

interface Check {
  ok: boolean;
  what: string;
}

/** 接触ログ1行を、そのフレームの図形で検証する。 */
function checkContact(rec: Recording, frames: Frame[], k: number, text: string): Check {
  const f = frames[k]!;
  const push = /^([AB]) の盾が ([AB]) に接触/.exec(text) ?? /^([AB]) の押し込み → ([AB]) は回避中/.exec(text);
  if (push) {
    const pusher = push[1] as GladId;
    const pushed = other(pusher);
    const { regs: ra } = geom(rec, f, pusher);
    // 押し込みが成立すると、試作は同じステップ内で相手を 0.5m 後退させる（記録は後退後）。
    // 接触の判定は後退前の位置で行われたので、前のフレームの位置に戻して確かめる
    const before = text.includes('（押し込み）') ? { ...f, [pushed]: { ...f[pushed], x: frames[k - 1]![pushed].x } } : f;
    const { regs: rd } = geom(rec, before, pushed);
    const s = ra.shield!;
    const s1: Vec = [s.centre[0] - s.axis[0] * s.halfLen, s.centre[1] - s.axis[1] * s.halfLen];
    const s2: Vec = [s.centre[0] + s.axis[0] * s.halfLen, s.centre[1] + s.axis[1] * s.halfLen];
    const seg: [Vec, Vec] = [s1, s2];
    const ok =
      touchesShield(seg, rd) ||
      touchesPart(seg, rd, 'arm') ||
      touchesPart(seg, rd, 'leg') ||
      touchesPart(seg, rd, 'torso') ||
      segCircle(s1, s2, rd.head, HEAD_R + 0.04);
    return { ok, what: '押し込み: 盾が相手に触れている' };
  }
  const m = /^([AB]) の攻撃 → ([AB]) /.exec(text);
  if (!m) return { ok: true, what: '対象外' };
  const atk = m[1] as GladId;
  const { regs: ra } = geom(rec, f, atk);
  const { regs: rd } = geom(rec, f, other(atk));
  const w = ra.weapon;
  const hit = /の(頭部|胴体|腕|脚)に命中$/.exec(text);
  if (hit) return { ok: touchesPart(w, rd, PART_BY_JP[hit[1]!]!), what: `剣が${hit[1]}に触れている` };
  if (text.includes('の盾に接触（回避中')) {
    // 試作のログは回避中の接触を武器への接触でも「盾」と書くため、どちらかでよい
    return { ok: touchesShield(w, rd) || touchesWeapon(w, rd), what: '剣が盾か武器に触れている（回避中）' };
  }
  if (/の盾に接触$|の盾を滑り落ちた|の盾が弾かれた/.test(text)) {
    return { ok: touchesShield(w, rd), what: '剣が盾に触れている' };
  }
  if (/の武器に接触$|の武器を滑り落ちた/.test(text)) {
    return { ok: touchesWeapon(w, rd), what: '剣が相手の剣に触れている' };
  }
  if (/が受け流した|の受け流しが合わない/.test(text)) {
    return { ok: touchesShield(w, rd) || touchesWeapon(w, rd), what: '剣が盾か武器に触れている（受け流し）' };
  }
  return { ok: false, what: `未分類の接触ログ: ${text}` };
}

/** 接触ログを、その瞬間の記録した図形で検証する。検証した件数と失敗を返す。 */
function verifyContacts(rec: Recording): { checked: number; failures: string[] } {
  const frames = rec.frames;
  let fi = 0;
  const failures: string[] = [];
  let checked = 0;
  for (const e of rec.events) {
    while (fi < frames.length && frames[fi]!.logEnd <= e.index) fi++;
    if (e.kind !== '接触') continue;
    const c = checkContact(rec, frames, fi, e.text);
    checked++;
    if (!c.ok) failures.push(`${e.t.toFixed(2)} ${e.text} — ${c.what} が成り立たない`);

    // 受け流した直後は、攻撃側の剣の角度が約30度ずれて描かれる
    const defl = /^([AB]) の攻撃 → [AB] が受け流した（武器を([+-]\d+)度/.exec(e.text);
    if (defl && frames[fi + 1]) {
      const id = defl[1] as GladId;
      const d = frames[fi + 1]![id].pose.weaponAngle - frames[fi]![id].pose.weaponAngle;
      const expected = Number(defl[2]) * rec.bodies[id].facing;
      if (Math.abs(d - expected) > 5) failures.push(`${e.t.toFixed(2)} 受け流し後の剣の角度変化 ${d.toFixed(1)}° (期待 ${expected}°)`);
    }
  }
  return { checked, failures };
}

describe('接触の瞬間、記録した図形はログどおりに交わっている', () => {
  scenarios.forEach((sc) => {
    it(sc.name, () => {
      // 接触が一度も起きないシナリオもある（間合いの取り合いなど、#26）。その場合は検証対象がないだけ
      expect(verifyContacts(record(sc.options as SimOptions, 1)).failures).toEqual([]);
    });
  });
  it('全シナリオの合計で、十分な数の接触を検証できている', () => {
    const total = scenarios.reduce((n, sc) => n + verifyContacts(record(sc.options as SimOptions, 1)).checked, 0);
    expect(total).toBeGreaterThan(500);
  });
});

describe('見た目の破綻がない（全フレーム）', () => {
  scenarios.forEach((sc) => {
    it(sc.name, () => {
      const rec = record(sc.options as SimOptions, 1);
      let minGap = Infinity;
      let maxAbsX = 0;
      let shieldBehind = 0;
      for (const f of rec.frames) {
        for (const id of ['A', 'B'] as const) {
          const body = { ...rec.bodies[id], x: f[id].x };
          maxAbsX = Math.max(maxAbsX, Math.abs(f[id].x));
          const { regs } = regionsOf(body, f[id].pose);
          // 盾は胴体より相手側（前）にある
          if (regs.shield && (regs.shield.centre[0] - regs.torso.centre[0]) * body.facing < 0) shieldBehind++;
        }
        minGap = Math.min(minGap, (f.B.x - f.A.x) * rec.bodies.A.facing);
      }
      expect(minGap, '足裏の間隔は最小 0.35m を割らず、すれ違わない').toBeGreaterThanOrEqual(0.35 - 1e-9);
      expect(maxAbsX, '移動範囲 ±12m の内側').toBeLessThanOrEqual(ARENA_HALF);
      expect(shieldBehind, '盾が胴体の後ろに回るフレーム数').toBe(0);
    });
  });
});
