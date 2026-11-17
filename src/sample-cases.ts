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
} as const;
export type SkillId = keyof typeof skillNames;
export type CaseId = "flow" | Scenario;
export interface SkillCue {
  from: number;
  to: number;
  skill: SkillId;
}
export interface SampleCase {
  id: CaseId;
  label: string;
  frames: Keyframe[];
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
    label: "連続攻防",
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
    label: "踏みとどまって防御",
    frames: branchKeys("hold"),
    left: [
      { from: 0, to: 700, skill: "slash" },
      { from: 740, to: 1250, skill: "shield" },
    ],
    right: branchCounter(1250),
  },
  {
    id: "hit",
    label: "崩れて被弾",
    frames: branchKeys("hit"),
    left: [{ from: 0, to: 700, skill: "slash" }],
    right: branchCounter(1180),
  },
  {
    id: "recover",
    label: "崩れた姿勢から防御",
    frames: branchKeys("recover"),
    left: [
      { from: 0, to: 700, skill: "slash" },
      { from: 800, to: 1680, skill: "lowShield" },
    ],
    right: branchCounter(1250),
  },
];
