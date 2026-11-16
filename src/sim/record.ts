/**
 * 再演方式のリプレイ（設計書 §5.9）：条件から戦闘を走らせ、表示用に状態を記録する。
 *
 * 記録は Sim.run() と同じ手順で進めるため、ログ・結果は run() と完全に同じになる
 * （tests/record.test.ts で確認）。描画はこの記録だけを読み、判定には関わらない。
 */
import { DT, type Pose } from './data';
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
  t: number;
  kind: string;
  /** 主語の剣闘士（A/B）。戦闘終了などは null。 */
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
  return log.map((line, index) => {
    const m = LINE.exec(line);
    if (!m) return { index, t: 0, kind: '', actor: null, text: line };
    const text = m[3]!;
    const actor = /^([AB])[ :]/.exec(text)?.[1] as GladId | undefined;
    return { index, t: Number(m[1]), kind: m[2]!, actor: actor ?? null, text };
  });
}

/** stepsPerFrame ステップごとに1フレーム記録する（既定 2 = 0.01秒）。 */
export function record(options: SimOptions, stepsPerFrame = 2): Recording {
  const sim = new Sim(options);
  const frames: Frame[] = [];
  let i = 0;
  while (!sim.over) {
    sim.step();
    if (i % stepsPerFrame === 0) frames.push({ t: sim.t, logEnd: sim.log.length, A: snap(sim.a), B: snap(sim.b) });
    sim.t += DT;
    i++;
  }
  const body = (g: Glad) => ({
    facing: g.facing,
    wlen: g.wlen,
    shieldHalf: g.shieldHalf,
    hpMax: 150,
    staminaMax: 100,
  });
  return {
    frameDt: DT * stepsPerFrame,
    frames,
    log: sim.log,
    events: parseLog(sim.log),
    summary: sim.summary!,
    bodies: { A: body(sim.a), B: body(sim.b) },
  };
}

/** 時刻 t に対応するフレーム番号。 */
export const frameIndexAt = (rec: Recording, t: number): number =>
  Math.max(0, Math.min(rec.frames.length - 1, Math.round(t / rec.frameDt)));
