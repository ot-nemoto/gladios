import type { Point, Pose } from "./sample-data";
const ns = "http://www.w3.org/2000/svg";
const make = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent: SVGElement,
): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.append(e);
  return e;
};
export function createFighter(g: SVGGElement, mirror: 1 | -1) {
  g.setAttribute("stroke", "var(--foreground)");
  g.setAttribute("stroke-width", "5");
  g.setAttribute("stroke-linecap", "round");
  g.setAttribute("stroke-linejoin", "round");
  g.setAttribute("fill", "none");
  const rear = make(
      "path",
      { "data-arm": "left", opacity: mirror === 1 ? "1" : ".45" },
      g,
    ),
    legs = make("path", {}, g),
    torso = make("path", { "stroke-width": 3, fill: "var(--background)" }, g),
    detail = make("path", { "stroke-width": 2 }, g),
    arm = make(
      "path",
      { "data-arm": "right", opacity: mirror === 1 ? ".45" : "1" },
      g,
    ),
    head = make("circle", { r: 13, fill: "var(--background)" }, g),
    face = make("path", { "stroke-width": 2 }, g);
  const sword = make("g", { "data-equipment": "sword" }, g);
  make(
    "path",
    { d: "M-12 0H0", stroke: "var(--muted-foreground)", "stroke-width": 5 },
    sword,
  );
  make("path", { d: "M0 -7V7", "stroke-width": 3 }, sword);
  make(
    "path",
    {
      d: "M2 -2L48 -2 55 0 48 2 2 2Z",
      fill: "var(--foreground)",
      stroke: "none",
    },
    sword,
  );
  const shield = make(
    "ellipse",
    {
      "data-equipment": "shield",
      rx: 15,
      ry: 24,
      fill: "var(--background)",
      "stroke-width": 3,
    },
    g,
  );
  // 左は前面が見えるので、右の剣腕が奥・左の盾腕が手前。
  // 右は背面が見えるので、左の盾腕が奥・右の剣腕が手前。
  if (mirror === 1) {
    g.insertBefore(rear, shield);
    g.prepend(arm, sword);
  } else {
    g.prepend(rear, shield);
  }
  return { g, rear, torso, detail, legs, arm, head, face, sword, shield };
}
const rad = (d: number) => (d * Math.PI) / 180;
const path = (p: readonly Point[]) =>
  "M" + p.map((a) => a.map((n) => n.toFixed(2)).join(" ")).join("L");
// Oblique camera: the left fighter faces toward the viewer;
// the opponent faces away. Depth separates shoulders, hips and hands.
const cameraForward: Point = [0.86, 0.35];
const cameraDepth: Point = [0.75, 0.38];
export const project = (x: number, y: number, z = 0): Point => [
  340 + (x - 340) * cameraForward[0] + z * cameraDepth[0],
  270 + (x - 340) * cameraForward[1] + (y - 284) + z * cameraDepth[1],
];
function joint(
  a: Point,
  b: Point,
  len1: number,
  len2: number,
  bend: number,
): Point {
  let dx = b[0] - a[0],
    dy = b[1] - a[1],
    dist = Math.hypot(dx, dy);
  const d = Math.max(0.001, Math.min(dist, len1 + len2 - 0.01));
  const base = Math.atan2(dy, dx),
    alpha = Math.acos(
      Math.max(
        -1,
        Math.min(1, (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d)),
      ),
    );
  return [
    a[0] + len1 * Math.cos(base + bend * alpha),
    a[1] + len1 * Math.sin(base + bend * alpha),
  ];
}
export function drawFighter(
  f: ReturnType<typeof createFighter>,
  p: Pose,
  mirror: 1 | -1,
) {
  const [x, y, tilt, hx, hy, angle, sx, sy, front, back, sweep = 0] = p;
  const at = (point: Point, depth = 0): Point =>
    project(x + mirror * point[0], point[1], depth);
  const line = (points: readonly Point[], depth = 0) =>
    path(points.map((v) => at(v, depth)));
  const hip: Point = [0, y],
    shoulder: Point = [Math.sin(rad(tilt)) * 60, y - Math.cos(rad(tilt)) * 60];
  const neck: Point = [
    shoulder[0] + Math.sin(rad(tilt)) * 10,
    shoulder[1] - Math.cos(rad(tilt)) * 10,
  ];
  const hand: Point = [shoulder[0] + hx, shoulder[1] + hy],
    sh: Point = [shoulder[0] + sx, shoulder[1] + sy];
  const elbow = joint(shoulder, hand, 34, 34, 1),
    leftElbow = joint(shoulder, sh, 34, 34, 1);
  const ff: Point = [front, 284],
    bf: Point = [back, 284],
    fk = joint(hip, ff, 47, 47, -1),
    bk = joint(hip, bf, 47, 47, -1);
  // Actor's right arm carries the sword; actor's left carries the shield.
  const swordDepth = -mirror * 14,
    shieldDepth = mirror * 14;
  f.rear.setAttribute("d", line([shoulder, leftElbow, sh], shieldDepth));
  f.legs.setAttribute(
    "d",
    line([bf, bk, hip], -9) +
      line([hip, fk, ff], 9) +
      line([bf, [bf[0] + 13, bf[1]]], -9) +
      line([ff, [ff[0] + 13, ff[1]]], 9),
  );
  f.torso.setAttribute(
    "d",
    path([at(shoulder, -16), at(shoulder, 16), at(hip, 11), at(hip, -11)]) +
      "Z" +
      line([shoulder, neck]),
  );
  if (mirror === 1) {
    // Collar and sternum make the front readable without a filled character.
    const chest: Point = [shoulder[0] + 2, shoulder[1] + 16];
    f.detail.setAttribute(
      "d",
      path([at(shoulder, -13), at(chest), at(shoulder, 13)]) +
        line([chest, [hip[0] + 2, hip[1] - 12]]),
    );
  } else {
    // Spine and shoulder-blade lines distinguish the back view.
    const spine: Point = [shoulder[0], shoulder[1] + 18];
    f.detail.setAttribute(
      "d",
      line([shoulder, [hip[0], hip[1] - 8]]) +
        path([
          at([shoulder[0], shoulder[1] + 10], -12),
          at(spine),
          at([shoulder[0], shoulder[1] + 10], 12),
        ]),
    );
  }
  // 剣腕を肩まわりで横に回す。0なら既存の側面姿勢と同じ描画になる。
  const yaw = rad(sweep);
  const swordPoint = (point: Point): Point => {
    const along = point[0] - shoulder[0];
    const side = -mirror * along * Math.sin(yaw);
    const base = at(
      [shoulder[0] + along * Math.cos(yaw), point[1]],
      swordDepth,
    );
    // 図として横振りを読めるよう、横方向の差は前後軸と交差する向きへ投影する。
    // 既存の身体の重なり用depthは保ち、sweep=0なら旧表示と一致させる。
    return [base[0] + side * cameraDepth[0], base[1] - side * cameraDepth[1]];
  };
  f.arm.setAttribute("d", path([shoulder, elbow, hand].map(swordPoint)));
  const head = at([
    neck[0] + Math.sin(rad(tilt)) * 14,
    neck[1] - Math.cos(rad(tilt)) * 14,
  ]);
  f.head.setAttribute("cx", String(head[0]));
  f.head.setAttribute("cy", String(head[1]));
  f.face.setAttribute(
    "d",
    mirror === 1
      ? path([
          [head[0] + 3, head[1] - 2],
          [head[0] + 7, head[1] - 1],
        ]) +
          path([
            [head[0] + 8, head[1] + 4],
            [head[0] + 5, head[1] + 6],
          ])
      : "",
  );
  const handScreen = swordPoint(hand),
    shieldScreen = at(sh, shieldDepth),
    a = rad(angle);
  const forward =
    mirror *
    (cameraForward[0] * Math.cos(yaw) - cameraDepth[0] * Math.sin(yaw));
  const rise =
    mirror *
    (cameraForward[1] * Math.cos(yaw) + cameraDepth[1] * Math.sin(yaw));
  f.sword.setAttribute(
    "transform",
    `matrix(${forward * Math.cos(a)} ${rise * Math.cos(a) + Math.sin(a)} ${-forward * Math.sin(a)} ${-rise * Math.sin(a) + Math.cos(a)} ${handScreen[0]} ${handScreen[1]})`,
  );
  f.shield.setAttribute(
    "transform",
    `translate(${shieldScreen}) rotate(${-tilt * 0.5})`,
  );
}
