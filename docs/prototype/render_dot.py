#!/usr/bin/env python3
"""Render a dot/pixel sprite animation from the actual keyframe data (sample)."""
import math, pathlib
from PIL import Image, ImageDraw
import sim_prototype as S

BASE = pathlib.Path(__file__).resolve().parent
SCALE = 50  # px per metre -> gladiator is ~88 px tall
OX, OY = -0.8, 2.0  # world coords of the canvas top-left
W, H = 140, 100

PAL = {
    "sand": (217, 183, 124), "ground": (176, 141, 87), "skin": (201, 141, 95),
    "armour": (138, 143, 152), "bronze": (176, 141, 63), "tunic": (163, 51, 39),
    "shield": (158, 43, 30), "gold": (217, 164, 65), "steel": (215, 221, 227),
    "dark": (43, 35, 32),
}

def px(x, y):
    return ((x - OX) * SCALE, (OY - y) * SCALE)

def draw_glad(dr, g):
    P = S.fk_points(g, g.pose)
    regs, _ = S.regions_of(g, g.pose)
    back = (-0.07 * g.facing, 0.0)  # far-side leg offset (visual only)
    def sh(pt, off=(0.0, 0.0)):
        return (pt[0] + off[0], pt[1] + off[1])
    # far leg (darker, visual only)
    dr.line([px(*sh(P["hip"], back)), px(*sh(P["knee"], back))], fill=PAL["ground"], width=4)
    dr.line([px(*sh(P["knee"], back)), px(*sh(P["ankle"], back))], fill=PAL["ground"], width=3)
    # near leg (shin in silver = greaves)
    dr.line([px(*P["hip"]), px(*P["knee"])], fill=PAL["skin"], width=5)
    dr.line([px(*P["knee"]), px(*P["ankle"])], fill=PAL["armour"], width=4)
    # torso (metal armour) + tunic skirt across the hip, perpendicular to the torso
    dr.line([px(*P["hip"]), px(*P["sho"])], fill=PAL["armour"], width=9)
    tx, ty = P["sho"][0] - P["hip"][0], P["sho"][1] - P["hip"][1]
    tl = math.hypot(tx, ty); tx, ty = tx / tl, ty / tl
    dr.line([px(P["hip"][0] - ty * 0.10, P["hip"][1] + tx * 0.10),
             px(P["hip"][0] + ty * 0.10, P["hip"][1] - tx * 0.10)], fill=PAL["tunic"], width=5)
    # shield: visual width is wider than the hit thickness (readability)
    (cx, cy), (ax, ay), hl, hw = regs["shield"]
    perp = (-ay, ax)
    vw = 0.085
    corners = [px(cx + ax * hl * sx + perp[0] * vw * sy, cy + ay * hl * sx + perp[1] * vw * sy)
               for sx, sy in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
    dr.polygon(corners, fill=PAL["shield"], outline=PAL["gold"], width=1)
    cc = px(cx, cy)
    dr.ellipse([cc[0] - 2, cc[1] - 2, cc[0] + 2, cc[1] + 2], fill=PAL["gold"])
    # arm (forearm in silver = manica) + hand segment up to the grip
    dr.line([px(*P["sho"]), px(*P["elb"])], fill=PAL["skin"], width=4)
    dr.line([px(*P["elb"]), px(*P["wri"])], fill=PAL["armour"], width=4)
    dr.line([px(*P["wri"]), px(*P["grip"])], fill=PAL["skin"], width=3)
    # weapon
    dr.line([px(*P["grip"]), px(*P["tip"])], fill=PAL["steel"], width=2)
    # head: helmet (bronze) with face below
    hx, hy = px(*P["head"])
    r = 0.11 * SCALE
    dr.ellipse([hx - r, hy - r, hx + r, hy + r], fill=PAL["skin"])
    dr.pieslice([hx - r, hy - r, hx + r, hy + r], start=180, end=360, fill=PAL["bronze"])
    dr.line([hx - r, hy, hx + r, hy], fill=PAL["bronze"], width=1)

def frame(pose):
    img = Image.new("RGB", (W, H), PAL["sand"])
    dr = ImageDraw.Draw(img)
    dr.line([(0, px(0, 0)[1]), (W, px(0, 0)[1])], fill=PAL["ground"], width=3)
    g = S.Glad(S.COND["gladiators"][0])
    g.x, g.pose = 0.0, pose
    draw_glad(dr, g)
    return img.resize((W * 4, H * 4), Image.NEAREST)

frames = []
for i in range(13):
    tau = min(1.0, i / 10)
    frames += [frame(S.interp_pose("gladius-slash-normal-torso", tau))]
frames += [frame(S.interp_pose("defence-scutum-block", 0.5))] * 4
frames += [frame(S.interp_pose("gladius-slash-normal-leg", min(1.0, i / 10))) for i in range(13)]
out = BASE / "dot-sample.gif"
frames[0].save(out, save_all=True, append_images=frames[1:], duration=110, loop=0)
print("saved:", out, out.stat().st_size // 1024, "KB, frames:", len(frames))
