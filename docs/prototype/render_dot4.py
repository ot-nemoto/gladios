#!/usr/bin/env python3
"""Game-feel sample: full battle on a generated arena background, with UI
(HP/stamina bars, damage numbers, banners, log line). Sim: battle-9 config."""
import math, pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import PIL.ImageChops as C
import sim_prototype as S
import render_dot3 as R3

BASE = pathlib.Path(__file__).resolve().parent
SCALE = 80
OX, OY = -2.6, 2.64
W, H = 416, 264
FONT = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

# rebind the dot3 drawing helpers to this canvas geometry
R3.SCALE, R3.OX, R3.OY, R3.W, R3.H = SCALE, OX, OY, W, H

def P(x, y):
    return ((x - OX) * SCALE, (OY - y) * SCALE)

BG_SRC = Image.open(BASE / "media-generation-arena-bg-empty-0-02c69f2e-b85f-436e-881f-e2bc0a3d5a89.webp").convert("RGB")
BG = BG_SRC.resize((W, H), Image.LANCZOS)

def text(dr, xy, s, size, fill=(255, 255, 255), anchor="mm", outline=None):
    f = ImageFont.truetype(FONT, size, index=0)
    if outline:
        for dx in (-2, 0, 2):
            for dy in (-2, 0, 2):
                if dx or dy:
                    dr.text((xy[0] + dx, xy[1] + dy), s, font=f, fill=outline, anchor=anchor)
    dr.text(xy, s, font=f, fill=fill, anchor=anchor)

def bar2x(dr, x, y, w, frac, color):
    dr.rectangle([x, y, x + w, y + 14], fill=(16, 14, 18), outline=(230, 230, 230), width=2)
    fw = int((w - 4) * max(0.0, min(1.0, frac)))
    if fw > 0:
        dr.rectangle([x + 2, y + 2, x + 2 + fw, y + 12], fill=color)

def main():
    sim = S.Sim({"A": "block", "B": "none"}, time_cap=40.0,
                atk_sets={"A": "gladius-slash-normal-leg"}, approach_until=1.45)
    sim.a.judgment_base = 80
    sim.b.judgment_base = 20
    prev = {"A": dict(sim.a.stats), "B": dict(sim.b.stats)}
    prev_hp = {"A": sim.a.hp, "B": sim.b.hp}
    sparks, popups = [], []
    frames = []
    step_i = 0
    winner = None
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
        if step_i % 60:
            continue
        for gid, g in (("A", sim.a), ("B", sim.b)):
            drop = prev_hp[gid] - g.hp
            if drop >= 1:
                popups.append([g.x, 2.05, int(round(drop)), 6])
            prev_hp[gid] = g.hp
        img = BG.copy().convert("RGBA")
        dr = ImageDraw.Draw(img, "RGBA")
        for g in (sim.a, sim.b):
            sx, sy = P(g.x, 0)
            dr.ellipse([sx - 32, sy - 3, sx + 32, sy + 4], fill=(90, 66, 38, 120))
        img.alpha_composite(R3.draw_glad_layer(sim.a, R3.PAL_A))
        img.alpha_composite(R3.draw_glad_layer(sim.b, R3.PAL_B))
        dr = ImageDraw.Draw(img, "RGBA")
        alive = []
        for sx, sy, ttl, col in sparks:
            xp, yp = P(sx, sy)
            r = 5 + (3 - ttl) * 3
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (0.7, 0.7), (-0.7, 0.7), (0.7, -0.7), (-0.7, -0.7)):
                dr.line([(xp, yp), (xp + dx * r, yp + dy * r)], fill=col + (255,), width=2)
            if ttl > 1:
                alive.append([sx, sy, ttl - 1, col])
        sparks = alive
        img = img.convert("RGB").resize((W * 2, H * 2), Image.NEAREST)
        dr = ImageDraw.Draw(img, "RGBA")
        # UI: bars + names
        bar2x(dr, 16, 12, 300, sim.a.hp / 150, (208, 60, 44))
        bar2x(dr, 16, 30, 300, sim.a.stamina / 100, (216, 178, 80))
        bar2x(dr, W * 2 - 316, 12, 300, sim.b.hp / 150, (70, 110, 190))
        bar2x(dr, W * 2 - 316, 30, 300, sim.b.stamina / 100, (216, 178, 80))
        text(dr, (20, 62), "A", 22, anchor="lm", outline=(0, 0, 0))
        text(dr, (W * 2 - 20, 62), "B", 22, anchor="rm", outline=(0, 0, 0))
        # damage popups
        alive = []
        for wx, wy, val, ttl in popups:
            xp, yp = P(wx, wy + (6 - ttl) * 0.05)
            text(dr, (xp * 2, yp * 2), f"-{val}", 34, fill=(255, 96, 64), outline=(20, 10, 8))
            if ttl > 1:
                alive.append([wx, wy, val, ttl - 1])
        popups = alive
        # banners
        if sim.t < 1.4:
            dr.rectangle([0, H - 44, W * 2, H + 44], fill=(10, 8, 14, 150))
            text(dr, (W, H), "試合開始", 54, outline=(0, 0, 0))
        # log strip
        dr.rectangle([0, H * 2 - 40, W * 2, H * 2], fill=(8, 8, 12, 190))
        last = sim.log[-1] if sim.log else ""
        text(dr, (12, H * 2 - 20), last[:52], 19, anchor="lm")
        frames.append(img)
    winner = "A" if sim.b.hp <= 0 else ("B" if sim.a.hp <= 0 else None)
    # closing frames with the verdict banner
    for _ in range(14):
        img = frames[-1].copy()
        dr = ImageDraw.Draw(img, "RGBA")
        dr.rectangle([0, H - 60, W * 2, H + 60], fill=(10, 8, 14, 170))
        text(dr, (W, H - 14), "決着", 62, outline=(0, 0, 0))
        if winner:
            text(dr, (W, H + 42), f"{winner} の勝利", 30, fill=(255, 214, 120), outline=(0, 0, 0))
        frames.append(img)
    pal = frames[len(frames) // 2].quantize(colors=256, dither=Image.NONE)
    qframes = [f.quantize(palette=pal, dither=Image.NONE) for f in frames]
    out = BASE / "dot-sample4.gif"
    qframes[0].save(out, save_all=True, append_images=qframes[1:], duration=80, loop=0, optimize=True)
    print("saved:", out, out.stat().st_size // 1024, "KB, frames:", len(frames), "winner:", winner)

if __name__ == "__main__":
    main()
