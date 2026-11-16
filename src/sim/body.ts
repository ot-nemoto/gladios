/** 骨格：キーフレーム補間、関節点の算出、判定領域の生成。 */
import { STANCE_SHIELD, kf, type Pose } from './data';
import type { Obb, Vec } from './geometry';
import { cos, hypot, radians, sin } from './trig';

export interface Points {
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  sho: Vec;
  head: Vec;
  elb: Vec;
  wri: Vec;
  grip: Vec;
  tip: Vec;
  torsoC: Vec;
}

export interface Regions {
  torso: Obb;
  arm: [Obb, Obb];
  leg: [Obb, Obb];
  head: Vec;
  weapon: [Vec, Vec];
  shield?: Obb;
}

/** 骨格計算に要る剣闘士の情報（Glad も記録済みのフレームもこの形を満たす）。 */
export interface BodyRef {
  x: number;
  facing: 1 | -1;
  wlen: number;
  shieldHalf: number | null;
}

/** 頭部の判定半径（標準体型）。 */
export const HEAD_R = 0.11;

const rotPt = (g: BodyRef, lx: number, ly: number): Vec => [g.x + g.facing * lx, ly];

/** 姿勢から関節点を全体座標で求める（標準体型の寸法。試作と同じ）。 */
export function fkPoints(g: BodyRef, pose: Pose): Points {
  const d = radians;
  const hip: Vec = [pose.hip[0], pose.hip[1]];
  const knee: Vec = [hip[0] + 0.44 * sin(d(pose.thigh)), hip[1] - 0.44 * cos(d(pose.thigh))];
  const ankle: Vec = [knee[0] + 0.44 * sin(d(pose.shin)), knee[1] - 0.44 * cos(d(pose.shin))];
  const sho: Vec = [hip[0] + 0.52 * sin(d(pose.torso)), hip[1] + 0.52 * cos(d(pose.torso))];
  const head: Vec = [sho[0] + 0.17 * sin(d(pose.torso)), sho[1] + 0.17 * cos(d(pose.torso))];
  const elb: Vec = [sho[0] + 0.3 * sin(d(pose.upperArm)), sho[1] - 0.3 * cos(d(pose.upperArm))];
  const wri: Vec = [elb[0] + 0.28 * sin(d(pose.forearm)), elb[1] - 0.28 * cos(d(pose.forearm))];
  const grip: Vec = [
    wri[0] + 0.18 * cos(d(pose.weaponAngle)),
    wri[1] + 0.18 * sin(d(pose.weaponAngle)),
  ];
  const tip: Vec = [
    grip[0] + g.wlen * cos(d(pose.weaponAngle)),
    grip[1] + g.wlen * sin(d(pose.weaponAngle)),
  ];
  const torsoC: Vec = [(hip[0] + sho[0]) / 2, (hip[1] + sho[1]) / 2];
  const w = (p: Vec) => rotPt(g, p[0], p[1]);
  return {
    hip: w(hip),
    knee: w(knee),
    ankle: w(ankle),
    sho: w(sho),
    head: w(head),
    elb: w(elb),
    wri: w(wri),
    grip: w(grip),
    tip: w(tip),
    torsoC: w(torsoC),
  };
}

const obb = (centre: Vec, axis: Vec, halfLen: number, halfWid: number): Obb => ({
  centre,
  axis,
  halfLen,
  halfWid,
});

const axisOf = (a: Vec, b: Vec): Vec => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = hypot(dx, dy);
  return [dx / L, dy / L];
};

const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export function regionsOf(g: BodyRef, pose: Pose): { regs: Regions; P: Points } {
  const P = fkPoints(g, pose);
  const regs: Regions = {
    torso: obb(P.torsoC, axisOf(P.hip, P.sho), 0.26, 0.12),
    arm: [
      obb(mid(P.sho, P.elb), axisOf(P.sho, P.elb), 0.15, 0.045),
      obb(mid(P.elb, P.wri), axisOf(P.elb, P.wri), 0.14, 0.04),
    ],
    leg: [
      obb(mid(P.hip, P.knee), axisOf(P.hip, P.knee), 0.22, 0.07),
      obb(mid(P.knee, P.ankle), axisOf(P.knee, P.ankle), 0.22, 0.055),
    ],
    head: P.head,
    weapon: [P.grip, P.tip],
  };
  if (g.shieldHalf !== null) {
    const sh = pose.shield ?? STANCE_SHIELD;
    const a = radians(sh.angle);
    const centreLocal: Vec = [
      pose.hip[0] + 0.26 * sin(radians(pose.torso)) + sh.dx,
      pose.hip[1] + 0.26 * cos(radians(pose.torso)) + sh.dy,
    ];
    const centre = rotPt(g, centreLocal[0], centreLocal[1]);
    const axisv: Vec = [g.facing * sin(a), cos(a)];
    regs.shield = obb(centre, axisv, g.shieldHalf, 0.04);
  }
  return { regs, P };
}

const ANGLES = ['torso', 'upperArm', 'forearm', 'thigh', 'shin', 'weaponAngle'] as const;

/** キーフレーム一式を進み具合 tau（0〜1）で線形補間する。 */
export function interpPose(setId: string, tau: number): Pose {
  const kfs = kf(setId).keyframes;
  tau = Math.max(0.0, Math.min(1.0, tau));
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]!;
    const b = kfs[i + 1]!;
    if (a.t <= tau && tau <= b.t) {
      const f = b.t === a.t ? 0.0 : (tau - a.t) / (b.t - a.t);
      const out = {} as Record<(typeof ANGLES)[number], number>;
      for (const k of ANGLES) out[k] = a[k] + (b[k] - a[k]) * f;
      const pose: Pose = {
        ...out,
        hip: [a.hip[0] + (b.hip[0] - a.hip[0]) * f, a.hip[1] + (b.hip[1] - a.hip[1]) * f],
      };
      if (a.shield) {
        const bs = b.shield!;
        pose.shield = {
          dx: a.shield.dx + (bs.dx - a.shield.dx) * f,
          dy: a.shield.dy + (bs.dy - a.shield.dy) * f,
          angle: a.shield.angle + (bs.angle - a.shield.angle) * f,
        };
      }
      return pose;
    }
  }
  return { ...kfs[kfs.length - 1]! };
}
