#!/usr/bin/env python3
"""Show torso lean and crouch/leg motion already present in the keyframe data."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.family"] = "Noto Serif CJK JP"
import pathlib
import sim_prototype as S

def draw_pose(ax, set_id, tau, dx):
    pose = S.interp_pose(set_id, tau)
    g = S.Glad(S.COND["gladiators"][0]); g.pose = pose; g.x = 0.0
    P = S.fk_points(g, pose)
    def L(pts, c, lw=2):
        ax.plot([p[0] + dx for p in pts], [p[1] for p in pts], "o-", color=c, lw=lw, ms=2.5)
    L([P["hip"], P["knee"], P["ankle"]], "tab:blue")
    L([P["hip"], P["sho"]], "tab:blue")
    L([P["sho"], P["elb"], P["wri"]], "tab:orange")
    L([P["grip"], P["tip"]], "tab:red", 3)
    ax.add_patch(plt.Circle((P["head"][0] + dx, P["head"][1]), 0.11, fill=False, color="tab:blue", lw=1.5))
    regs, _ = S.regions_of(g, pose)
    (cx, cy), (axx, ayy), hl, _ = regs["shield"]
    ax.plot([cx - axx * hl + dx, cx + axx * hl + dx], [cy - ayy * hl, cy + ayy * hl], "-", color="tab:green", lw=4, alpha=0.8)
    ax.text(dx + 0.45, -0.22, f"胴{pose['torso']:.0f}° 腰{pose['hip'][1]:.2f}m", ha="center", fontsize=8, color="dimgray")

fig, axes = plt.subplots(2, 1, figsize=(10.5, 4.6))
for ax, set_id, taus, title in (
    (axes[0], "gladius-slash-normal-torso", [0, 0.35, 0.6, 0.8, 1.0], "胴斬り：前屈みになっていく"),
    (axes[1], "gladius-slash-normal-leg", [0, 0.35, 0.55, 0.85, 1.0], "脚斬り：腰を落として脚を曲げ伸ばす"),
):
    for i, tau in enumerate(taus):
        draw_pose(ax, set_id, tau, i * 1.55)
    ax.set_xlim(-0.6, 7.6); ax.set_ylim(-0.35, 1.95)
    ax.set_aspect("equal"); ax.axis("off"); ax.set_title(title, fontsize=11, loc="left")
out = pathlib.Path(__file__).resolve().parent / "posture-demo.png"
fig.tight_layout(); fig.savefig(out, dpi=120)
print("saved:", out)
