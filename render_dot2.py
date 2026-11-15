#!/usr/bin/env python3
"""Higher-resolution shaped dot rendering of the same keyframe data (sample 2)."""
import math, pathlib, random
from PIL import Image, ImageDraw
import sim_prototype as S

BASE = pathlib.Path.home() / "workspace/gladiator-game"
SCALE = 100  # px per metre -> gladiator ~175 px tall
OX, OY = -0.8, 2.05
W, H = 280, 205

SKIN = (198, 132, 90); SKIN_D = (168, 106, 68)
METAL = (146, 150, 158); METAL_D = (110, 114, 122)
BRONZE = (186, 148, 70); BRONZE_D = (150, 114, 48)
LEATHER = (122, 82, 50)
TUNIC = (150, 44, 34)
SHIELD = (156, 40, 28); SHIELD_D = (128, 32, 22); GOLD = (219, 166, 66)
STEEL = (216, 222, 228); STEEL_D = (170, 178, 186)
SAND = (219, 186, 128); SAND_D = (196, 160, 100)

def P(x, y):
    return ((x - OX) * SCALE, (OY - y) * SCALE)

def quad(dr, p1, p2, w1, w2, fill, shade=None):
    """Tapered segment from p1 to p2 (world), widths w1/w2 (half, metres)."""
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    L = math.hypot(dx, dy) or 1e-6
    nx, ny = -dy / L, dx / L
    pts = [P(p1[0] + nx * w1, p1[1] + ny * w1), P(p2[0] + nx * w2, p2[1] + ny * w2),
           P(p2[0] - nx * w2, p2[1] - ny * w2), P(p1[0] - nx * w1, p1[1] - ny * w1)]
    dr.polygon(pts, fill=fill)
    if shade:  # darker strip on the back side
        pts2 = [P(p1[0], p1[1]), P(p2[0], p2[1]),
                P(p2[0] - nx * w2, p2[1] - ny * w2), P(p1[0] - nx * w1, p1[1] - ny * w1)]
        dr.polygon(pts2, fill=shade)

def draw_glad(dr, g):
    Pt = S.fk_points(g, g.pose)
    regs, _ = S.regions_of(g, g.pose)
    f = g.facing
    # ground shadow
    sx, sy = P(g.x, 0)
    dr.ellipse([sx - 42, sy - 4, sx + 42, sy + 4], fill=SAND_D)
    # far leg (darker)
    off = (-0.07 * f, 0)
    hip_f = (Pt["hip"][0] + off[0], Pt["hip"][1]); knee_f = (Pt["knee"][0] + off[0], Pt["knee"][1])
    ank_f = (Pt["ankle"][0] + off[0], Pt["ankle"][1])
    quad(dr, hip_f, knee_f, 0.055, 0.04, SKIN_D)
    quad(dr, knee_f, ank_f, 0.04, 0.028, METAL_D)
    # near leg: thigh skin, shin greave
    quad(dr, Pt["hip"], Pt["knee"], 0.065, 0.045, SKIN, SKIN_D)
    quad(dr, Pt["knee"], Pt["ankle"], 0.048, 0.032, METAL, METAL_D)
    # sandal
    dr.line([P(*Pt["ankle"]), P(Pt["ankle"][0] + 0.11 * f, Pt["ankle"][1] - 0.01)], fill=LEATHER, width=3)
    # torso: armour, tapered (waist -> chest)
    quad(dr, Pt["hip"], Pt["sho"], 0.105, 0.125, METAL, METAL_D)
    # belt + skirt (pteruges strips)
    hx, hy = Pt["hip"]
    dr.line([P(hx - 0.10, hy + 0.03), P(hx + 0.10, hy + 0.03)], fill=LEATHER, width=4)
    for i in range(-2, 3):
        x0 = hx + i * 0.045
        dr.polygon([P(x0 - 0.018, hy + 0.01), P(x0 + 0.018, hy + 0.01),
                    P(x0 + 0.012, hy - 0.11), P(x0 - 0.012, hy - 0.11)], fill=TUNIC)
    # shield: three vertical strips for curvature + gold border + boss + wing motif
    (cx, cy), (ax, ay), hl, _hw = regs["shield"]
    perp = (-ay, ax); vw = 0.085
    def corner(s1, s2):
        return P(cx + ax * hl * s1 + perp[0] * vw * s2, cy + ay * hl * s1 + perp[1] * vw * s2)
    dr.polygon([corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)], fill=SHIELD)
    mid1 = P(cx + perp[0] * vw * 0.33, cy + perp[1] * vw * 0.33)
    mid2 = P(cx - perp[0] * vw * 0.33, cy - perp[1] * vw * 0.33)
    top_c = P(cx + ax * hl, cy + ay * hl); bot_c = P(cx - ax * hl, cy - ay * hl)
    dr.line([top_c, bot_c], fill=SHIELD_D, width=2)
    dr.polygon([corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)], outline=GOLD, width=2)
    cc = P(cx, cy)
    dr.ellipse([cc[0] - 5, cc[1] - 5, cc[0] + 5, cc[1] + 5], fill=GOLD, outline=BRONZE_D)
    for sgn in (-1, 1):  # simple wing strokes
        dr.line([cc, (cc[0] + sgn * 16, cc[1] - 12)], fill=GOLD, width=2)
        dr.line([cc, (cc[0] + sgn * 20, cc[1] + 2)], fill=GOLD, width=2)
    # arm: upper skin, forearm manica with segment lines, hand
    quad(dr, Pt["sho"], Pt["elb"], 0.042, 0.036, SKIN, SKIN_D)
    quad(dr, Pt["elb"], Pt["wri"], 0.038, 0.03, METAL, METAL_D)
    for tt in (0.33, 0.66):
        mx = Pt["elb"][0] + (Pt["wri"][0] - Pt["elb"][0]) * tt
        my = Pt["elb"][1] + (Pt["wri"][1] - Pt["elb"][1]) * tt
        dr.ellipse([P(mx, my)[0] - 3, P(mx, my)[1] - 3, P(mx, my)[0] + 3, P(mx, my)[1] + 3], outline=METAL_D)
    dr.line([P(*Pt["wri"]), P(*Pt["grip"])], fill=SKIN, width=5)
    # sword: tapered blade + guard + pommel
    grip, tip = Pt["grip"], Pt["tip"]
    quad(dr, grip, tip, 0.016, 0.001, STEEL, STEEL_D)
    gx, gy = P(*grip)
    dr.line([(gx - 2, gy - 6), (gx + 2, gy + 6)], fill=GOLD, width=3)
    dr.ellipse([gx - 3, gy - 3, gx + 3, gy + 3], fill=BRONZE)
    # head: face + helmet dome/brim/cheek guards
    hxp, hyp = P(*Pt["head"]); r = 0.11 * SCALE
    dr.ellipse([hxp - r, hyp - r, hxp + r, hyp + r], fill=SKIN)
    dr.pieslice([hxp - r, hyp - r, hxp + r, hyp + r], start=180, end=360, fill=BRONZE)
    dr.line([(hxp - r - 2, hyp - 1), (hxp + r + 2, hyp - 1)], fill=BRONZE_D, width=3)
    dr.rectangle([hxp + (r - 3) * f, hyp, hxp + (r + 1) * f, hyp + r * 0.7], fill=BRONZE_D)
    dr.rectangle([hxp - (r + 1) * f, hyp, hxp - (r - 3) * f, hyp + r * 0.8], fill=BRONZE)

def frame(pose):
    img = Image.new("RGB", (W, H), SAND)
    dr = ImageDraw.Draw(img)
    rng = random.Random(42)
    for _ in range(300):
        x, y = rng.randrange(W), rng.randrange(int(P(0, 0)[1]), H)
        dr.point((x, y), fill=SAND_D)
    dr.line([(0, P(0, 0)[1]), (W, P(0, 0)[1])], fill=SAND_D, width=2)
    g = S.Glad(S.COND["gladiators"][0])
    g.x, g.pose = 0.0, pose
    draw_glad(dr, g)
    return img.resize((W * 2, H * 2), Image.NEAREST)

frames = []
for i in range(13):
    frames.append(frame(S.interp_pose("gladius-slash-normal-torso", min(1.0, i / 10))))
frames += [frame(S.interp_pose("defence-scutum-block", 0.5))] * 4
for i in range(13):
    frames.append(frame(S.interp_pose("gladius-slash-normal-leg", min(1.0, i / 10))))
out = BASE / "dot-sample2.gif"
frames[0].save(out, save_all=True, append_images=frames[1:], duration=110, loop=0)
print("saved:", out, out.stat().st_size // 1024, "KB, frames:", len(frames))
