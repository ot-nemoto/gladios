#!/usr/bin/env python3
"""What two independent legs look like from the side: split stance and passing step."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.family"] = "Noto Serif CJK JP"
import math, pathlib

def leg(ax, hip, thigh_deg, shin_deg, color, lw=2.5):
    ta = math.radians(thigh_deg - 90)   # 0deg thigh = straight down
    knee = (hip[0] + 0.44 * math.cos(ta), hip[1] + 0.44 * math.sin(ta))
    sa = math.radians(shin_deg - 90)
    ank = (knee[0] + 0.44 * math.cos(sa), knee[1] + 0.44 * math.sin(sa))
    ax.plot([hip[0], knee[0], ank[0]], [hip[1], knee[1], ank[1]], "o-", color=color, lw=lw, ms=3)
    ax.plot([ank[0], ank[0] + 0.12], [ank[1], ank[1] - 0.02], "-", color=color, lw=lw)

fig, axes = plt.subplots(1, 2, figsize=(8.4, 4.2))
for ax, title in zip(axes, ("構え：前脚と後脚で角度が違う", "歩行：脚が交差して重なる")):
    ax.set_xlim(-0.8, 0.9); ax.set_ylim(-0.05, 1.9)
    ax.set_aspect("equal"); ax.axis("off"); ax.set_title(title, fontsize=11)
    ax.axhline(0.02, color="gray", lw=1)

hip = (0.0, 0.86)
# stance: far leg back straight-ish, near leg front bent
leg(axes[0], hip, -28, 6, "gray", 2)
leg(axes[0], hip, 42, -38, "tab:blue", 2.5)
axes[0].plot([hip[0], hip[0] + 0.03], [hip[1], 1.38], "o-", color="tab:blue", lw=2, ms=3)
axes[0].add_patch(plt.Circle((0.03, 1.55), 0.11, fill=False, color="tab:blue", lw=2))
# walking pass: support leg near-vertical, swing leg crossing in front of it in projection
hip2 = (0.0, 0.93)
leg(axes[1], hip2, -6, 4, "tab:blue", 2.5)      # support (near)
leg(axes[1], hip2, 34, -52, "gray", 2)          # swing (far), crosses the support leg's line
axes[1].plot([hip2[0], hip2[0] + 0.02], [hip2[1], 1.45], "o-", color="tab:blue", lw=2, ms=3)
axes[1].add_patch(plt.Circle((0.02, 1.62), 0.11, fill=False, color="tab:blue", lw=2))
out = pathlib.Path.home() / "workspace/gladiator-game/legs-demo.png"
fig.tight_layout(); fig.savefig(out, dpi=130)
print("saved:", out)
