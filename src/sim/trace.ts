/**
 * 判断の過程の記録（#33）。戦闘ビューアの「判断」パネルが読む。
 *
 * 判定（sim.ts）が判断のたびに書き足すだけで、判定の結果・ログには影響しない
 * （Python 試作との一致は保たれる）。作戦ルール（設計書 §7、#7）が入っても、
 * ルールを上から順に評価して最初に当てはまったものを使う、という形はそのまま使える。
 */
import type { Part } from './data';
import type { PartScores } from './select';

export type TraceGladId = 'A' | 'B';

/** ルール1つぶんの評価。 */
export interface RuleEval {
  /** ルールの名前（例「ルール1: 体勢を立て直す」）。 */
  name: string;
  /** 条件（例「体勢 < 50」）。 */
  condition: string;
  /** 判断時点の値（例「体勢 42」）。 */
  value: string;
  /** matched = 当てはまった（これを使う）、unmatched = 外れた、notReached = 手前で決まったので見ていない。 */
  result: 'matched' | 'unmatched' | 'notReached';
}

/** 部位の自動選択（v3.11 / v3.37 / v3.44）。 */
export interface SelectTrace {
  /** 「武器-攻撃方法-強さ」（例: gladius-slash-normal）。 */
  pattern: string;
  /** 部位ごとの点数（null は基準間合いで届かない）。点数 = 防御の薄さ×100 + 相性×10 + 負傷。 */
  scores: PartScores;
  /** 防御の薄さ（0 盾が先、1 腕が先、2 防具のみ、3 露出）。届かない部位は null。 */
  exposure: Record<Part, number | null>;
  part: Part | null;
}

/** 間合い（v3.44）：今の間隔と一式の基準間合いを比べて、寄る・下がる・そのまま振る。 */
export interface SpacingTrace {
  setId: string;
  gap: number;
  ref: number | null;
  tolerance: number;
  /** approach = 寄る、retreat = 下がる、inRange = 間合いの内、wall = 下がれないのでそのまま振る、noRef = 基準間合いがない。 */
  move: 'approach' | 'retreat' | 'inRange' | 'wall' | 'noRef';
}

/** 判断1回ぶん。 */
export interface Decision {
  t: number;
  actor: TraceGladId;
  rules: RuleEval[];
  /** 選んだ行動（行動開始のログと同じ文言。構えは「構え（…）」）。 */
  action: string;
  select?: SelectTrace;
  spacing?: SpacingTrace;
}

/** 相手の攻撃の気配に対する、防御への切り替えの予定。 */
export interface ReactionPlan {
  /** 予定を立てた時刻（相手が構えた・盾押しを始めた時刻）。 */
  t: number;
  /** 反応する側。 */
  actor: TraceGladId;
  /** 何に反応したか（例「構え（デフォルト: 通常攻撃（斬る・胴体））」「盾押し: 押し込み」）。 */
  cause: string;
  /** 切り替える予定の時刻 = t + 検知 + 判断 + 読み。 */
  at: number;
  detect: number;
  judgment: number;
  /** 読み（v3.43）：構えから攻撃の長さを読み、防御開始を遅らせる量。 */
  read: number;
  /** 切り替える防御の方針。 */
  policy: 'block' | 'evade' | 'deflect';
  /**
   * 結果（予定の時刻に決まる）。switched = 防御に切り替えた、tooLate = 自分の行動が始まっていて切り替えられず、
   * cancelled = 自分の構えが先に攻撃になったので取りやめ。未定なら undefined。
   */
  outcome?: 'switched' | 'tooLate' | 'cancelled';
  /** 結果が決まった時刻（表示では、この時刻より前に結果を見せない）。 */
  settledAt?: number;
}

export interface Trace {
  decisions: Decision[];
  reactions: ReactionPlan[];
}
