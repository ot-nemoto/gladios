/**
 * 戦闘の Canvas 2D 描画（骨格表示）。
 *
 * 体は判定領域（長方形・円）をそのまま塗る。描画用の別補間や見た目の調整はしない
 * （設計書 §5.4.2「描画も判定と同じ線形補間を使う」）。ドット絵に差し替えるときは
 * このモジュールだけを置き換える。
 */
import { HEAD_R, regionsOf, type Regions } from '../sim/body';
import type { Obb, Vec } from '../sim/geometry';
import type { Frame, GladFrame, LogEvent, Recording } from '../sim/record';
import type { GladId } from '../sim/sim';

export interface DrawOptions {
  /** 判定領域の輪郭と関節点を重ねて表示する。 */
  showRegions: boolean;
  /** 現在時刻の近くで起きた接触イベント（光らせる対象を決める）。 */
  recentContacts: readonly LogEvent[];
}

const PALETTE: Record<GladId, { body: string; limb: string; shield: string; label: string }> = {
  A: { body: '#4a78c8', limb: '#3a63ab', shield: '#2c4c86', label: '#9cc0ff' },
  B: { body: '#c8584a', limb: '#a8463a', shield: '#86342c', label: '#ffb0a4' },
};
const STEEL = '#d9dde3';
const VIEW_WIDTH_M = 7.0;
const ARENA_HALF = 12.0;

interface View {
  scale: number;
  camX: number;
  groundY: number;
  w: number;
  h: number;
}

const toPx = (v: View, p: Vec): [number, number] => [
  v.w / 2 + (p[0] - v.camX) * v.scale,
  v.groundY - p[1] * v.scale,
];

function obbPath(ctx: CanvasRenderingContext2D, v: View, b: Obb): void {
  const [cx, cy] = b.centre;
  const [ax, ay] = b.axis;
  const px = -ay;
  const py = ax;
  const corners: Vec[] = [
    [cx + ax * b.halfLen + px * b.halfWid, cy + ay * b.halfLen + py * b.halfWid],
    [cx + ax * b.halfLen - px * b.halfWid, cy + ay * b.halfLen - py * b.halfWid],
    [cx - ax * b.halfLen - px * b.halfWid, cy - ay * b.halfLen - py * b.halfWid],
    [cx - ax * b.halfLen + px * b.halfWid, cy - ay * b.halfLen + py * b.halfWid],
  ];
  ctx.beginPath();
  corners.forEach((c, i) => {
    const [x, y] = toPx(v, c);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function fillObb(ctx: CanvasRenderingContext2D, v: View, b: Obb, fill: string): void {
  obbPath(ctx, v, b);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawBackground(ctx: CanvasRenderingContext2D, v: View): void {
  const sky = ctx.createLinearGradient(0, 0, 0, v.groundY);
  sky.addColorStop(0, '#1d1a17');
  sky.addColorStop(1, '#3a3127');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, v.w, v.groundY);
  ctx.fillStyle = '#b89a6a';
  ctx.fillRect(0, v.groundY, v.w, v.h - v.groundY);
  ctx.fillStyle = '#a3865a';
  ctx.fillRect(0, v.groundY, v.w, 2);

  // 1m ごとの目盛り（全体座標）
  ctx.font = `${Math.round(v.scale * 0.07)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const left = v.camX - v.w / 2 / v.scale;
  const right = v.camX + v.w / 2 / v.scale;
  for (let m = Math.ceil(left); m <= Math.floor(right); m++) {
    const [x] = toPx(v, [m, 0]);
    ctx.fillStyle = 'rgba(60,45,25,0.55)';
    ctx.fillRect(x - 1, v.groundY + 2, 2, m % 5 === 0 ? 14 : 8);
    ctx.fillStyle = 'rgba(60,45,25,0.8)';
    ctx.fillText(`${m}`, x, v.groundY + 28);
  }
  // 移動範囲の端（±12m）
  for (const edge of [-ARENA_HALF, ARENA_HALF]) {
    if (edge < left || edge > right) continue;
    const [x] = toPx(v, [edge, 0]);
    ctx.fillStyle = '#5b4a36';
    ctx.fillRect(x - (edge < 0 ? 8 : 0), 0, 8, v.groundY);
  }
}

function drawGladiator(
  ctx: CanvasRenderingContext2D,
  v: View,
  id: GladId,
  rec: Recording,
  f: GladFrame,
  flash: 'hit' | 'block' | null,
  showRegions: boolean,
): Regions {
  const body = { ...rec.bodies[id], x: f.x };
  const { regs, P } = regionsOf(body, f.pose);
  const c = PALETTE[id];
  const hitTint = flash === 'hit' ? '#ffe2a0' : null;

  for (const b of regs.leg) fillObb(ctx, v, b, hitTint ?? c.limb);
  fillObb(ctx, v, regs.torso, hitTint ?? c.body);
  const [hx, hy] = toPx(v, regs.head);
  ctx.beginPath();
  ctx.arc(hx, hy, HEAD_R * v.scale, 0, Math.PI * 2);
  ctx.fillStyle = hitTint ?? c.body;
  ctx.fill();
  for (const b of regs.arm) fillObb(ctx, v, b, hitTint ?? c.limb);

  // 武器（握り点から先端までの線分）
  const [gx, gy] = toPx(v, regs.weapon[0]);
  const [tx, ty] = toPx(v, regs.weapon[1]);
  ctx.strokeStyle = STEEL;
  ctx.lineWidth = Math.max(2, v.scale * 0.025);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // 手（手首から握り点まで。判定領域ではない）
  const [wx, wy] = toPx(v, P.wri);
  ctx.strokeStyle = c.limb;
  ctx.lineWidth = Math.max(2, v.scale * 0.05);
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(gx, gy);
  ctx.stroke();

  if (regs.shield) {
    fillObb(ctx, v, regs.shield, c.shield);
    obbPath(ctx, v, regs.shield);
    ctx.strokeStyle = flash === 'block' ? '#fff6d0' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = flash === 'block' ? 3 : 1;
    ctx.stroke();
  }

  if (showRegions) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    for (const b of [regs.torso, ...regs.arm, ...regs.leg]) {
      obbPath(ctx, v, b);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_R * v.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const p of [P.hip, P.knee, P.ankle, P.sho, P.elb, P.wri, P.grip]) {
      const [x, y] = toPx(v, p);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  // 行動ラベル
  if (f.label) {
    const [lx] = toPx(v, [f.x, 0]);
    const ly = toPx(v, [0, 2.05])[1];
    ctx.font = `${Math.round(Math.max(11, v.scale * 0.075))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = c.label;
    const text = f.label.replace(/^[^:：]+[:：]\s*/, '');
    ctx.fillText((f.holding ? '構え: ' : '') + text, lx, ly);
  }
  return regs;
}

export type Flash = 'hit' | 'block';

/**
 * 接触ログ1行から、光らせる側（受けた側）と光らせ方を得る。光らせないものは null。
 * - 身体への命中 → hit（身体を明るくする）
 * - 盾・武器での受け止め、受け流し（成否とも）、盾が弾かれた、滑り落ちた、押し込まれた → block（盾の縁を光らせる）
 * - 回避中の接触、回避された押し込み → なし（防御処理が起きていない）
 */
export function contactFlash(text: string): { target: GladId; flash: Flash } | null {
  if (text.includes('回避中')) return null;
  const push = /^[AB] の盾が ([AB]) に接触（押し込み）/.exec(text);
  if (push) return { target: push[1] as GladId, flash: 'block' };
  const m = /→ ([AB]) (?:の|が)(.*)$/.exec(text);
  if (!m) return null;
  const target = m[1] as GladId;
  const rest = m[2]!;
  if (/^(頭部|胴体|腕|脚)に命中$/.test(rest)) return { target, flash: 'hit' };
  if (/^(盾|武器)に接触$|^(盾|武器)を滑り落ちた|^受け流した|^受け流しが合わない|^盾が弾かれた/.test(rest)) {
    return { target, flash: 'block' };
  }
  return null;
}

function flashOf(events: readonly LogEvent[], id: GladId): Flash | null {
  let out: Flash | null = null;
  for (const e of events) {
    const c = contactFlash(e.text);
    if (c?.target !== id) continue;
    if (c.flash === 'hit') return 'hit';
    out = 'block';
  }
  return out;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  rec: Recording,
  frame: Frame,
  opts: DrawOptions,
): void {
  const { width: w, height: h } = ctx.canvas;
  const scale = w / VIEW_WIDTH_M;
  const v: View = { w, h, scale, camX: (frame.A.x + frame.B.x) / 2, groundY: h * 0.82 };
  ctx.clearRect(0, 0, w, h);
  drawBackground(ctx, v);
  for (const id of ['A', 'B'] as const) {
    drawGladiator(ctx, v, id, rec, frame[id], flashOf(opts.recentContacts, id), opts.showRegions);
  }
  // 足裏の間隔
  const gap = Math.abs(frame.B.x - frame.A.x);
  const [ax] = toPx(v, [frame.A.x, 0]);
  const [bx] = toPx(v, [frame.B.x, 0]);
  const y = v.groundY + Math.max(40, v.scale * 0.32);
  ctx.strokeStyle = 'rgba(40,30,15,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax, y);
  ctx.lineTo(bx, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,30,15,0.9)';
  ctx.font = `${Math.round(Math.max(11, v.scale * 0.075))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`間隔 ${gap.toFixed(2)} m`, (ax + bx) / 2, y - 6);
}
