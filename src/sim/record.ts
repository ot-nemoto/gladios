/**
 * 再演方式のリプレイ（設計書 §5.9）：条件から戦闘を走らせ、表示用に状態を記録する。
 *
 * 記録は Sim.run() と同じ手順で進めるため、ログ・結果は run() と完全に同じになる
 * （tests/record.test.ts で確認）。描画はこの記録だけを読み、判定には関わらない。
 */
import { DT, HP_MAX, KF, STAMINA_MAX, type Pose } from './data';
import type { BodyRef } from './body';
import type { ActionKind, Glad, Policy } from './glad';
import { Sim, type GladId, type SimOptions, type Summary } from './sim';
import type { Decision, ReactionPlan, Trace } from './trace';

/** 攻撃の段階（実行開始印・完了直前開始印で区切る。設計書 §5.4）。 */
export type AttackStage = '準備' | '実行' | '完了直前';

/** その時点で何をしているか（判断パネルの「今の段階」）。 */
export type GladStatus =
  /** 行動の合間。判断の遅れが明けると次を決める。 */
  | { kind: 'idle'; decideAt: number }
  /** 構え：攻撃の開始を待っている。 */
  | { kind: 'hold'; set: string; start: number; until: number }
  /** 寄る・下がる：目標の間隔まで。 */
  | { kind: 'approach' | 'retreat'; gap: number; target: number }
  | { kind: 'attack'; set: string | null; progress: number; dur: number; stage: AttackStage | null }
  | { kind: 'defence'; set: string | null; policy: Policy; progress: number; phase: 'enter' | 'hold' | 'exit' | null }
  | { kind: 'push' | 'postureRecovery'; progress: number; dur: number }
  | { kind: 'wait' };

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
  status: GladStatus;
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
  /** 判断の過程（判断・反応の予定）。時刻の順に並ぶ。 */
  trace: Trace;
  /** 骨格計算用の固定情報（位置はフレーム側）。 */
  bodies: Record<GladId, Omit<BodyRef, 'x'> & { hpMax: number; staminaMax: number }>;
}

function attackStage(set: string | null, progress: number): AttackStage | null {
  const m = set !== null ? KF.get(set)?.markers : undefined;
  if (!m) return null;
  return progress < m.executionStart ? '準備' : progress < m.finalPhaseStart ? '実行' : '完了直前';
}

function statusOf(g: Glad, t: number): GladStatus {
  if (g.hold) return { kind: 'hold', set: g.hold.set, start: g.hold.start, until: g.hold.until };
  const a = g.action;
  if (a === null) return { kind: 'idle', decideAt: g.decisionAt };
  const progress = a.dur === Infinity ? 0 : (t - a.start) / a.dur;
  switch (a.kind) {
    case 'approach':
    case 'retreat':
      return { kind: a.kind, gap: Math.abs(g.opp.x - g.x), target: a.until! };
    case 'attack':
      return { kind: 'attack', set: a.set, progress, dur: a.dur, stage: attackStage(a.set, progress) };
    case 'defence':
      return { kind: 'defence', set: a.set, policy: a.policy ?? 'block', progress, phase: a.phase ?? null };
    case 'push':
    case 'postureRecovery':
      return { kind: a.kind, progress, dur: a.dur };
    case 'wait':
      return { kind: 'wait' };
  }
}

const snap = (g: Glad, t: number): GladFrame => ({
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
  status: statusOf(g, t),
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
      frames.push({ t: sim.t, logEnd: sim.log.length, A: snap(sim.a, sim.t), B: snap(sim.b, sim.t) });
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
    trace: sim.trace,
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

/** 時刻 t までに行った、その剣闘士の最後の判断（なければ null）。 */
export function lastDecision(rec: Recording, actor: GladId, t: number): Decision | null {
  let found: Decision | null = null;
  for (const d of rec.trace.decisions) {
    if (d.t > t) break;
    if (d.actor === actor) found = d;
  }
  return found;
}

/** 時刻 t までに立てた、その剣闘士の最後の反応の予定（なければ null）。 */
export function lastReaction(rec: Recording, actor: GladId, t: number): ReactionPlan | null {
  let found: ReactionPlan | null = null;
  for (const r of rec.trace.reactions) {
    if (r.t > t) break;
    if (r.actor === actor) found = r;
  }
  return found;
}
