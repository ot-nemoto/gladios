#!/usr/bin/env python3
"""Free-route ceiling sample: polished procedural dot rendering of a live battle.
Arena background, outlines, team colours, impact sparks, HP bars. All from the sim."""
import math, pathlib, random
from PIL import Image, ImageDraw, ImageFilter
import sim_prototype as S

BASE = pathlib.Path(__file__).resolve().parent
SCALE = 80
OX, OY = -3.3, 2.75
W, H = 528, 248

SKIN = (198, 132, 90); SKIN_D = (166, 104, 66)
METAL = (146, 150, 158); METAL_D = (108, 112, 120)
BRONZE = (186, 148, 70); BRONZE_D = (148, 112, 46)
LEATHER = (122, 82, 50); GOLD = (219, 166, 66)
STEEL = (216, 222, 228); STEEL_D = (168, 176, 184)
OUTLINE = (38, 30, 26)

PAL_A = {"shield": (158, 42, 30), "shield_d": (126, 32, 22), "tunic": (150, 44, 34), "trim": GOLD}
PAL_B = {"shield": (44, 68, 116), "shield_d": (32, 50, 88), "tunic": (52, 74, 110), "trim": (196, 200, 208)}

def P(x, y):
    return ((x - OX) * SCALE, (OY - y) * SCALE)

def quad(dr, p1, p2, w1, w2, fill, shade=None):
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    L = math.hypot(dx, dy) or 1e-6
    nx, ny = -dy / L, dx / L
    pts = [P(p1[0] + nx * w1, p1[1] + ny * w1), P(p2[0] + nx * w2, p2[1] + ny * w2),
           P(p2[0] - nx * w2, p2[1] - ny * w2), P(p1[0] - nx * w1, p1[1] - ny * w1)]
    dr.polygon(pts, fill=fill + (255,))
    if shade:
        pts2 = [P(p1[0], p1[1]), P(p2[0], p2[1]),
                P(p2[0] - nx * w2, p2[1] - ny * w2), P(p1[0] - nx * w1, p1[1] - ny * w1)]
        dr.polygon(pts2, fill=shade + (255,))

def draw_glad_layer(g, pal):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    Pt = S.fk_points(g, g.pose)
    regs, _ = S.regions_of(g, g.pose)
    f = g.facing
    off = (-0.07 * f, 0)
    hip_f = (Pt["hip"][0] + off[0], Pt["hip"][1]); knee_f = (Pt["knee"][0] + off[0], Pt["knee"][1])
    ank_f = (Pt["ankle"][0] + off[0], Pt["ankle"][1])
    quad(dr, hip_f, knee_f, 0.055, 0.04, SKIN_D)
    quad(dr, knee_f, ank_f, 0.04, 0.028, METAL_D)
    quad(dr, Pt["hip"], Pt["knee"], 0.065, 0.045, SKIN, SKIN_D)
    quad(dr, Pt["knee"], Pt["ankle"], 0.048, 0.032, METAL, METAL_D)
    dr.line([P(*Pt["ankle"]), P(Pt["ankle"][0] + 0.11 * f, Pt["ankle"][1] - 0.01)], fill=LEATHER + (255,), width=3)
    quad(dr, Pt["hip"], Pt["sho"], 0.105, 0.125, METAL, METAL_D)
    hx, hy = Pt["hip"]
    dr.line([P(hx - 0.10, hy + 0.03), P(hx + 0.10, hy + 0.03)], fill=LEATHER + (255,), width=4)
    for i in range(-2, 3):
        x0 = hx + i * 0.045
        dr.polygon([P(x0 - 0.018, hy + 0.01), P(x0 + 0.018, hy + 0.01),
                    P(x0 + 0.012, hy - 0.11), P(x0 - 0.012, hy - 0.11)], fill=pal["tunic"] + (255,))
    (cx, cy), (ax, ay), hl, _hw = regs["shield"]
    perp = (-ay, ax); vw = 0.085
    def corner(s1, s2):
        return P(cx + ax * hl * s1 + perp[0] * vw * s2, cy + ay * hl * s1 + perp[1] * vw * s2)
    dr.polygon([corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)], fill=pal["shield"] + (255,))
    top_c = P(cx + ax * hl, cy + ay * hl); bot_c = P(cx - ax * hl, cy - ay * hl)
    dr.line([top_c, bot_c], fill=pal["shield_d"] + (255,), width=2)
    dr.polygon([corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)], outline=pal["trim"] + (255,), width=2)
    cc = P(cx, cy)
    dr.ellipse([cc[0] - 4, cc[1] - 4, cc[0] + 4, cc[1] + 4], fill=pal["trim"] + (255,), outline=BRONZE_D + (255,))
    for sgn in (-1, 1):
        dr.line([cc, (cc[0] + sgn * 13, cc[1] - 10)], fill=pal["trim"] + (255,), width=2)
        dr.line([cc, (cc[0] + sgn * 16, cc[1] + 2)], fill=pal["trim"] + (255,), width=2)
    quad(dr, Pt["sho"], Pt["elb"], 0.042, 0.036, SKIN, SKIN_D)
    quad(dr, Pt["elb"], Pt["wri"], 0.038, 0.03, METAL, METAL_D)
    dr.line([P(*Pt["wri"]), P(*Pt["grip"])], fill=SKIN + (255,), width=4)
    quad(dr, Pt["grip"], Pt["tip"], 0.016, 0.001, STEEL, STEEL_D)
    gx, gy = P(*Pt["grip"])
    dr.line([(gx - 2, gy - 5), (gx + 2, gy + 5)], fill=GOLD + (255,), width=3)
    dr.ellipse([gx - 3, gy - 3, gx + 3, gy + 3], fill=BRONZE + (255,))
    hxp, hyp = P(*Pt["head"]); r = 0.11 * SCALE
    dr.ellipse([hxp - r, hyp - r, hxp + r, hyp + r], fill=SKIN + (255,))
    dr.pieslice([hxp - r, hyp - r, hxp + r, hyp + r], start=180, end=360, fill=BRONZE + (255,))
    dr.line([(hxp - r - 2, hyp - 1), (hxp + r + 2, hyp - 1)], fill=BRONZE_D + (255,), width=3)
    _xa, _xb = hxp + (r - 3) * f, hxp + (r + 1) * f
    dr.rectangle([min(_xa, _xb), hyp, max(_xa, _xb), hyp + r * 0.7], fill=BRONZE_D + (255,))
    # outline pass: dilate alpha, paint dark, put under the layer
    alpha = layer.split()[3]
    dil = alpha.filter(ImageFilter.MaxFilter(3))
    outline = Image.new("RGBA", (W, H), OUTLINE + (255,))
    import PIL.ImageChops as C
    outline.putalpha(C.subtract(dil, alpha))
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(outline)
    canvas.alpha_composite(layer)
    return canvas

def make_bg_static():
    img = Image.new("RGB", (W, H), (52, 48, 84))
    dr = ImageDraw.Draw(img)
    # sky bands
    for i, c in enumerate([(38, 36, 70), (52, 48, 84), (74, 62, 102), (104, 78, 104)]):
        y0 = P(0, 2.75 - i * 0.11)[1]
        dr.rectangle([0, y0, W, y0 + 0.11 * SCALE + 2], fill=c)
    # main wall
    wy0, wy1 = P(0, 2.35)[1], P(0, 0.55)[1]
    dr.rectangle([0, wy0, W, wy1], fill=(138, 122, 96))
    for i in range(7):
        y = wy0 + i * (wy1 - wy0) / 6
        dr.line([(0, y), (W, y)], fill=(118, 102, 78), width=1)
    # arches
    for k in range(-3, 4):
        cxp = P(k * 1.15, 0)[0]
        dr.rectangle([cxp - 26, P(0, 2.05)[1], cxp + 26, P(0, 1.18)[1]], fill=(104, 88, 66))
        dr.pieslice([cxp - 26, P(0, 2.18)[1], cxp + 26, P(0, 1.92)[1]], start=180, end=360, fill=(104, 88, 66))
        dr.rectangle([cxp - 22, P(0, 2.02)[1], cxp + 22, P(0, 1.22)[1]], fill=(70, 60, 52))
        dr.pieslice([cxp - 22, P(0, 2.13)[1], cxp + 22, P(0, 1.91)[1]], start=180, end=360, fill=(70, 60, 52))
    # crowd band
    cy0, cy1 = P(0, 2.12)[1], P(0, 1.66)[1]
    dr.rectangle([0, cy0, W, cy1], fill=(44, 38, 52))
    rng = random.Random(7)
    cloth = [(150, 120, 90), (120, 90, 80), (90, 100, 130), (160, 140, 110), (110, 80, 70), (200, 170, 130)]
    for _ in range(900):
        x = rng.randrange(W); y = rng.randrange(int(cy0) + 2, int(cy1) - 3)
        c = cloth[rng.randrange(len(cloth))]
        dr.rectangle([x, y, x + 2, y + 2], fill=c)
    # banners
    for bx in (-2.2, 2.2):
        x0, x1 = P(bx - 0.17, 0)[0], P(bx + 0.17, 0)[0]
        y0, y1 = P(0, 2.3)[1], P(0, 1.62)[1]
        dr.rectangle([x0, y0, x1, y1], fill=(142, 36, 28))
        dr.rectangle([x0, y0, x1, y1], outline=GOLD, width=2)
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        dr.polygon([(mx, my - 9), (mx + 7, my), (mx, my + 9), (mx - 7, my)], fill=GOLD)
    # podium wall
    py0, py1 = P(0, 0.55)[1], P(0, 0.0)[1]
    dr.rectangle([0, py0, W, py1], fill=(168, 148, 112))
    dr.line([(0, py0), (W, py0)], fill=(196, 176, 136), width=2)
    for k in range(-6, 7):
        x = P(k * 0.55, 0)[0]
        dr.line([(x, py0 + 3), (x, py1)], fill=(146, 126, 92), width=1)
    # floor
    fy = P(0, 0)[1]
    dr.rectangle([0, fy, W, H], fill=(216, 184, 124))
    dr.rectangle([0, fy, W, fy + 5], fill=(188, 156, 98))
    rng = random.Random(11)
    for _ in range(500):
        x = rng.randrange(W); y = rng.randrange(int(fy) + 4, H)
        dr.point((x, y), fill=(196, 160, 100))
    for ex in (-1.8, 0.4, 2.4):
        xp, yp = P(ex, 0)[0], fy + 16
        dr.ellipse([xp - 30, yp - 4, xp + 30, yp + 4], fill=(202, 168, 106))
    return img

BG = make_bg_static()
TORCH_X = (-2.75, -0.95, 0.95, 2.75)

def draw_bg(frame_i):
    img = BG.copy()
    dr = ImageDraw.Draw(img, "RGBA")
    for tx in TORCH_X:
        xp, yp = P(tx, 0.62)
        dr.ellipse([xp - 16, yp - 16, xp + 16, yp + 12], fill=(255, 140, 40, 36))
        dr.rectangle([xp - 1, yp, xp + 2, yp + 10], fill=(60, 44, 30))
        fl = 3 if (frame_i + int(tx * 10)) % 2 == 0 else 2
        dr.polygon([(xp - 3, yp + 1), (xp + 4, yp + 1), (xp + 1, yp - 6 - fl), (xp - 1, yp - 4 - fl)], fill=(255, 166, 48))
        dr.polygon([(xp - 1, yp), (xp + 2, yp), (xp + 1, yp - 4 - fl)], fill=(255, 220, 120))
    return img

def bar(img, x, y, frac, color, back=(30, 26, 24)):
    dr = ImageDraw.Draw(img)
    w = 118
    dr.rectangle([x, y, x + w, y + 8], fill=back)
    dr.rectangle([x + 1, y + 1, x + 1 + (w - 2) * max(0.0, min(1.0, frac)), y + 7], fill=color)

def main():
    sim = S.Sim({"A": "block", "B": "block"}, time_cap=14.0)
    prev = {"A": dict(sim.a.stats), "B": dict(sim.b.stats)}
    sparks = []
    frames = []
    step_i = 0
    while not sim.over:
        sim.step(); sim.t += S.DT; step_i += 1
        for gid, g, foe in (("A", sim.a, sim.b), ("B", sim.b, sim.a)):
            st = g.stats
            if st["blocks"] + st["deflects"] > prev[gid]["blocks"] + prev[gid]["deflects"]:
                regs, _ = S.regions_of(g, g.pose)
                (cx, cy), _, _, _ = regs["shield"]
                sparks.append([cx, cy, 3, (255, 226, 140)])
            if st["hits"] > prev[gid]["hits"]:
                Pt = S.fk_points(foe, foe.pose)
                sparks.append([Pt["sho"][0] - 0.1 * foe.facing, Pt["sho"][1] - 0.15, 3, (255, 120, 70)])
            prev[gid] = dict(st)
        if step_i % 20:
            continue
        img = draw_bg(len(frames)).convert("RGBA")
        dr = ImageDraw.Draw(img, "RGBA")
        for g in (sim.a, sim.b):
            sx, sy = P(g.x, 0)
            dr.ellipse([sx - 34, sy - 3, sx + 34, sy + 4], fill=(120, 92, 58, 110))
        img.alpha_composite(draw_glad_layer(sim.a, PAL_A))
        img.alpha_composite(draw_glad_layer(sim.b, PAL_B))
        dr = ImageDraw.Draw(img, "RGBA")
        alive = []
        for sx, sy, ttl, col in sparks:
            xp, yp = P(sx, sy)
            r = 5 + (3 - ttl) * 3
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (0.7, 0.7), (-0.7, 0.7), (0.7, -0.7), (-0.7, -0.7)):
                dr.line([(xp, yp), (xp + dx * r, yp + dy * r)], fill=col + (255,), width=2)
            dr.point((xp, yp), fill=(255, 255, 255, 255))
            if ttl > 1:
                alive.append([sx, sy, ttl - 1, col])
        sparks = alive
        img = img.convert("RGB")
        bar(img, 10, 8, sim.a.hp / 150, (208, 60, 44))
        bar(img, 10, 19, sim.a.stamina / 100, (216, 178, 80))
        bar(img, W - 128, 8, sim.b.hp / 150, (70, 110, 190))
        bar(img, W - 128, 19, sim.b.stamina / 100, (216, 178, 80))
        frames.append(img.resize((W * 2, H * 2), Image.NEAREST))
    out = BASE / "dot-sample3.gif"
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=100, loop=0)
    print("saved:", out, out.stat().st_size // 1024, "KB, frames:", len(frames))

if __name__ == "__main__":
    main()
