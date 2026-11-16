#!/usr/bin/env python3
"""Render the prototype battle as an animated GIF (stick figures)."""
import pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.family"] = "Noto Serif CJK JP"
from matplotlib import animation
import sim_prototype as S

BASE = pathlib.Path(__file__).resolve().parent
DURATION = 30.0          # sim seconds to show
SAMPLE_EVERY = 20        # sim steps (DT=0.005) -> one frame per 0.10s

sim = S.Sim({"A": "block", "B": "block"}, time_cap=DURATION)
frames = []
step_i = 0
while not sim.over:
    sim.step()
    sim.t += S.DT
    step_i += 1
    if step_i % SAMPLE_EVERY == 0:
        snap = {"t": sim.t, "last": sim.log[-1] if sim.log else "", "g": {}}
        for g in (sim.a, sim.b):
            P = S.fk_points(g, g.pose)
            regs, _ = S.regions_of(g, g.pose)
            (cx, cy), (ax, ay), hl, _hw = regs["shield"]
            snap["g"][g.id] = {
                "P": P,
                "shield": ((cx - ax * hl, cy - ay * hl), (cx + ax * hl, cy + ay * hl)),
                "hp": max(0, g.hp), "st": g.stamina, "po": g.posture,
            }
        frames.append(snap)

fig, ax = plt.subplots(figsize=(7.2, 3.9))
ax.set_xlim(-3.4, 3.4)
ax.set_ylim(-0.15, 2.3)
ax.set_aspect("equal")
ax.axis("off")

def draw_glad(d, color):
    P = d["P"]
    ax.plot([P["hip"][0], P["knee"][0], P["ankle"][0]], [P["hip"][1], P["knee"][1], P["ankle"][1]], "o-", color=color, lw=2, ms=3)
    ax.plot([P["hip"][0], P["sho"][0]], [P["hip"][1], P["sho"][1]], "o-", color=color, lw=2, ms=3)
    ax.plot([P["sho"][0], P["elb"][0], P["wri"][0]], [P["sho"][1], P["elb"][1], P["wri"][1]], "o-", color="tab:orange", lw=2, ms=3)
    ax.plot([P["grip"][0], P["tip"][0]], [P["grip"][1], P["tip"][1]], "-", color="tab:red", lw=3)
    ax.add_patch(plt.Circle(P["head"], 0.11, fill=False, color=color, lw=2))
    s = d["shield"]
    ax.plot([s[0][0], s[1][0]], [s[0][1], s[1][1]], "-", color="tab:green", lw=5, alpha=0.8)

def bar(x, y, frac, color, label):
    ax.add_patch(plt.Rectangle((x, y), 1.2, 0.07, fill=False, edgecolor="gray", lw=0.7))
    ax.add_patch(plt.Rectangle((x, y), 1.2 * max(0.0, min(1.0, frac)), 0.07, color=color))
    ax.text(x - 0.06, y + 0.035, label, ha="right", va="center", fontsize=7)

def render(i):
    ax.clear()
    ax.set_xlim(-3.4, 3.4); ax.set_ylim(-0.15, 2.3)
    ax.set_aspect("equal"); ax.axis("off")
    ax.axhline(0, color="gray", lw=1)
    f = frames[i]
    draw_glad(f["g"]["A"], "tab:blue")
    draw_glad(f["g"]["B"], "tab:purple")
    ax.text(-3.35, 2.22, f"t = {f['t']:.1f}s", fontsize=9)
    for j, gid in enumerate(("A", "B")):
        d = f["g"][gid]
        x0 = -3.35 if gid == "A" else 1.55
        ax.text(x0 + 0.6, 2.13, gid, ha="center", fontsize=9, fontweight="bold")
        bar(x0, 2.02, d["hp"] / 150, "tab:red", "HP")
        bar(x0, 1.92, d["st"] / 100, "tab:blue", "ST")
        bar(x0, 1.82, d["po"] / 100, "tab:green", "PO")
    ax.text(0, -0.14, f["last"][:95], ha="center", fontsize=6.5)
    return []

anim = animation.FuncAnimation(fig, render, frames=len(frames), interval=100, blit=False)
out = BASE / "battle-viz.gif"
anim.save(out, writer="pillow", fps=10)
print("frames:", len(frames), "saved:", out, out.stat().st_size // 1024, "KB")
