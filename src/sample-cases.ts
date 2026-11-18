import {
  shieldUpFrames,
  swordStopFrames,
  shieldPushFrames,
} from "./motion-samples";
import {
  branchKeys,
  flowFrames,
  type Keyframe,
  type Scenario,
} from "./sample-data";

// サンプルの動きを説明する仮称。正式なスキル仕様や習得条件ではない。
export const skillNames = {
  slash: "斬撃",
  parry: "剣で弾く",
  thrust: "突き",
  retreat: "後退回避",
  counter: "反撃の突き",
  shield: "盾受け",
  lowShield: "低い姿勢の盾受け",
  shieldUp: "盾で上へそらす",
  swordStop: "剣で受け止める",
  shieldPush: "盾の面で押す",
} as const;
export type SkillId = keyof typeof skillNames;
export type CaseId =
  | "flow"
  | Scenario
  | "shield-up"
  | "sword-stop"
  | "shield-push";
// 境目の開始姿勢そのものでは次の技を強調せず、from直後からto直前を使用中とする。
export interface SkillCue {
  from: number;
  to: number;
  skill: SkillId;
}
export interface SampleCase {
  id: CaseId;
  frames: Keyframe[];
  leftRole?: string;
  rightRole?: string;
  left: SkillCue[];
  right: SkillCue[];
}

const branchCounter = (end: number): SkillCue[] => [
  { from: 260, to: 740, skill: "retreat" },
  { from: 740, to: end, skill: "counter" },
];
export const sampleCases: SampleCase[] = [
  {
    id: "flow",
    frames: flowFrames,
    left: [
      { from: 0, to: 700, skill: "slash" },
      { from: 700, to: 1210, skill: "parry" },
      { from: 1210, to: 1510, skill: "thrust" },
    ],
    right: [
      { from: 280, to: 700, skill: "retreat" },
      { from: 700, to: 1110, skill: "counter" },
      { from: 1210, to: 1510, skill: "shield" },
    ],
  },
  {
    id: "hold",
    frames: branchKeys("hold"),
    left: [
      { from: 0, to: 700, skill: "slash" },
      { from: 740, to: 1250, skill: "shield" },
    ],
    right: branchCounter(1250),
  },
  {
    id: "hit",
    frames: branchKeys("hit"),
    left: [{ from: 0, to: 700, skill: "slash" }],
    right: branchCounter(1180),
  },
  {
    id: "recover",
    frames: branchKeys("recover"),
    left: [
      { from: 0, to: 700, skill: "slash" },
      { from: 800, to: 1680, skill: "lowShield" },
    ],
    right: branchCounter(1250),
  },
  {
    id: "shield-up",
    frames: shieldUpFrames,
    rightRole: "盾でそらして反撃する側",
    left: [
      { from: 0, to: 650, skill: "thrust" },
      { from: 750, to: 1100, skill: "shield" },
    ],
    right: [
      { from: 220, to: 750, skill: "shieldUp" },
      { from: 750, to: 1100, skill: "counter" },
    ],
  },
  {
    id: "sword-stop",
    frames: swordStopFrames,
    leftRole: "突きを繰り返す側",
    rightRole: "剣で止め、後退して避ける側",
    left: [
      { from: 0, to: 850, skill: "thrust" },
      { from: 850, to: 1400, skill: "thrust" },
    ],
    right: [
      { from: 220, to: 850, skill: "swordStop" },
      { from: 850, to: 1400, skill: "retreat" },
    ],
  },
  {
    id: "shield-push",
    frames: shieldPushFrames,
    leftRole: "盾の面で押す側",
    rightRole: "盾で支え、後退する側",
    left: [{ from: 0, to: 1200, skill: "shieldPush" }],
    right: [{ from: 250, to: 1200, skill: "shield" }],
  },
];
