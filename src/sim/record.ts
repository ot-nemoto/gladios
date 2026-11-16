/**
 * 再演方式のリプレイ（設計書 §5.9）：条件から戦闘を走らせ、表示用に状態を記録する。
 *
 * 記録は Sim.run() と同じ手順で進めるため、ログ・結果は run() と完全に同じになる
 * （tests/record.test.ts で確認）。描画はこの記録だけを読み、判定には関わらない。
 */
import { DT, HP_MAX, STAMINA_MAX, type Pose } from './data';
import type { BodyRef } from './body';
import type { ActionKind, Glad } from './glad';
import { Sim, type GladId, type SimOptions, type Summary } from './sim';

export interface GladFrame {
  x: number;
  pose: Pose;
  hp: number;
  stamina: number;
  posture: number;
  collapsed: boolean;
  action: ActionKind | null;
  label: string | null;
  /** 構え（攻撃開始前の待ち）の最中か。 */
  holding: boolean;
}

export interface Frame {
  t: number;
  /** このフレームまでに出たログの行数（ログ行とフレームの対応づけに使う）。 */
  logEnd: number;
  A: GladFrame;
  B: GladFrame;
}

export interface LogEvent {
  index: number;
  /** ログに印字された時刻（0.01 秒に丸めた値）。表示用。 */
  t: number;
  /** このイベントが起きた後の最初のフレーム番号（record() が設定。parseLog 単体では -1）。 */
  frame: number;
  kind: string;
  /** 主語の剣闘士（A/B）。結果の行は直前の接触の主語を引き継ぐ。戦闘終了などは null。 */
  actor: GladId | null;
  text: string;
}

export interface Recording {
  /** フレームの間隔（秒）。 */
  frameDt: number;
  frames: Frame[];
  log: string[];
  events: LogEvent[];
  summary: Summary;
  /** 骨格計算用の固定情報（位置はフレーム側）。 */
  bodies: Record<GladId, Omit<BodyRef, 'x'> & { hpMax: number; staminaMax: number }>;
}

const snap = (g: Glad): GladFrame => ({
  x: g.x,
  // pose は毎ステップ新しいオブジェクトに差し替わるため、参照を保持してよい
  pose: g.pose,
  hp: g.hp,
  stamina: g.stamina,
  posture: g.posture,
  collapsed: g.collapsed,
  action: g.action?.kind ?? null,
  label: g.hold ? g.hold.label : (g.action?.label ?? null),
  holding: g.hold !== null,
});

const LINE = /^\[\s*([\d.]+)\] (\S+)\s+(.*)$/;

export function parseLog(log: readonly string[]): LogEvent[] {
  let lastContactActor: GladId | null = null;
  return log.map((line, index) => {
    const m = LINE.exec(line);
    if (!m) return { index, t: 0, frame: -1, kind: '', actor: null, text: line };
    const kind = m[2]!;
    const text = m[3]!;
    let actor = (/^([AB])[ :]/.exec(text)?.[1] as GladId | undefined) ?? null;
    if (kind === '接触') lastContactActor = actor;
    // 「E=35 → 通常。B 体力-12…」「受け止め: …」「押し込み成立: …」は直前の接触の結果
    if (kind === '結果' && actor === null) actor = lastContactActor;
    return { index, t: Number(m[1]), frame: -1, kind, actor, text };
  });
}

/** stepsPerFrame ステップごとに1フレーム記録する（既定 2 = 0.01秒）。 */
export function record(options: SimOptions, stepsPerFrame = 2): Recording {
  const sim = new Sim(options);
  const frames: Frame[] = [];
  let i = 0;
  while (!sim.over) {
    sim.step();
    // 決着したステップは間引かずに必ず記録する（最後の画面に決め手の命中を残す）
    if (i % stepsPerFrame === 0 || sim.over) {
      frames.push({ t: sim.t, logEnd: sim.log.length, A: snap(sim.a), B: snap(sim.b) });
    }
    sim.t += DT;
    i++;
  }
  const body = (g: Glad) => ({
    facing: g.facing,
    wlen: g.wlen,
    shieldHalf: g.shieldHalf,
    hpMax: HP_MAX,
    staminaMax: STAMINA_MAX,
  });
  const events = parseLog(sim.log);
  let k = 0;
  for (const e of events) {
    while (frames[k]!.logEnd <= e.index) k++;
    e.frame = k;
  }
  return {
    frameDt: DT * stepsPerFrame,
    frames,
    log: sim.log,
    events,
    summary: sim.summary!,
    bodies: { A: body(sim.a), B: body(sim.b) },
  };
}

/** 時刻 t に最も近いフレーム番号（最後のフレームは間隔が不揃いなことがあるため二分探索）。 */
export function frameIndexAt(rec: Recording, t: number): number {
  const fr = rec.frames;
  let lo = 0;
  let hi = fr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (fr[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(fr[lo - 1]!.t - t) <= Math.abs(fr[lo]!.t - t)) return lo - 1;
  return lo;
}

/** フレーム k の時点までに起きた最後のイベント番号（なければ -1）。 */
export const lastEventAtFrame = (rec: Recording, k: number): number => rec.frames[k]!.logEnd - 1;
