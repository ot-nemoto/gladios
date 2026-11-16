/** 2次元の幾何（線分と判定領域の交差）。 */

export type Vec = readonly [number, number];

/** 向き付き長方形：中心、長辺方向の単位ベクトル、長辺・短辺の半分の長さ。 */
export interface Obb {
  centre: Vec;
  axis: Vec;
  halfLen: number;
  halfWid: number;
}

export function segObb(p1: Vec, p2: Vec, box: Obb): boolean {
  const [cx, cy] = box.centre;
  const [ax, ay] = box.axis;
  const hl = box.halfLen;
  const hw = box.halfWid;
  const vx = -ay;
  const vy = ax;
  const tr = (p: Vec): Vec => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [dx * ax + dy * ay, dx * vx + dy * vy];
  };
  const a = tr(p1);
  const b = tr(p2);
  // Liang-Barsky で [-hl,hl] x [-hw,hw] に対して切り取る
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0.0;
  let t1 = 1.0;
  const checks: [number, number][] = [
    [-dx, a[0] + hl],
    [dx, hl - a[0]],
    [-dy, a[1] + hw],
    [dy, hw - a[1]],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

export function segCircle(p1: Vec, p2: Vec, c: Vec, r: number): boolean {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const L2 = dx * dx + dy * dy;
  const t =
    L2 === 0 ? 0.0 : Math.max(0.0, Math.min(1.0, ((c[0] - p1[0]) * dx + (c[1] - p1[1]) * dy) / L2));
  const px = p1[0] + t * dx - c[0];
  const py = p1[1] + t * dy - c[1];
  return px * px + py * py <= r * r;
}

export function segSeg(p1: Vec, p2: Vec, p3: Vec, p4: Vec): boolean {
  const cr = (o: Vec, a: Vec, b: Vec) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const d1 = cr(p3, p4, p1);
  const d2 = cr(p3, p4, p2);
  const d3 = cr(p1, p2, p3);
  const d4 = cr(p1, p2, p4);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}
