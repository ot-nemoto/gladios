#!/usr/bin/env python3
"""Line-only expression of body yaw: square stance vs bladed (hanshin) stance."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.family"] = "Noto Serif CJK JP"
import pathlib

fig, axes = plt.subplots(1, 2, figsize=(8.6, 4.4))

def draw(ax, title, sho_f, sho_b, torso_hw, shield_dx, note):
    # legs (same for both): hip at (0, 0.95), front foot fwd, back foot back
    hip = (0.0, 0.95)
    ax.plot([hip[0], 0.16, 0.34], [hip[1], 0.5, 0.07], "o-", color="tab:blue", lw=2, ms=3)
    ax.plot([hip[0], -0.14, -0.30], [hip[1], 0.52, 0.07], "o-", color="gray", lw=1.5, ms=3)
    # torso: centre line + thickness hint
    top = (0.0, 1.47)
    ax.plot([hip[0], top[0]], [hip[1], top[1]], "-", color="tab:blue", lw=7, alpha=0.35)
    ax.plot([hip[0], top[0]], [hip[1], top[1]], "o-", color="tab:blue", lw=2, ms=3)
    # shoulders: front (shield side) and back (sword side)
    ax.plot([sho_b[0], sho_f[0]], [sho_b[1], sho_f[1]], "o-", color="black", lw=2, ms=4)
    # shield arm + shield (front shoulder)
    ax.plot([sho_f[0], sho_f[0] + 0.16, sho_f[0] + 0.22], [sho_f[1], 1.22, 1.18], "o-", color="tab:green", lw=2, ms=3)
    sc = (sho_f[0] + shield_dx, 1.21)
    ax.plot([sc[0], sc[0]], [sc[1] - 0.5, sc[1] + 0.5], "-", color="tab:green", lw=6, alpha=0.85)
    # sword arm (back shoulder) + sword
    ax.plot([sho_b[0], sho_b[0] + 0.05, sho_b[0] + 0.22], [sho_b[1], 1.24, 1.30], "o-", color="tab:orange", lw=2, ms=3)
    grip = (sho_b[0] + 0.22 + 0.18, 1.30)
    ax.plot([sho_b[0] + 0.22, grip[0]], [1.30, 1.30], "-", color="tab:orange", lw=2)
    ax.plot([grip[0], grip[0] + 0.5], [1.30, 1.38], "-", color="tab:red", lw=3)
    # head
    ax.add_patch(plt.Circle((top[0], 1.64), 0.11, fill=False, color="tab:blue", lw=2))
    ax.set_xlim(-0.75, 1.15); ax.set_ylim(-0.05, 1.9)
    ax.set_aspect("equal"); ax.axis("off")
    ax.set_title(title, fontsize=12)
    ax.text(0.2, -0.04 + 0.0, note, ha="center", fontsize=8.5, color="dimgray")

# square: shoulders overlap in projection (same x), torso thick, shield centred
draw(axes[0], "正面気味（肩が重なる）", (0.0, 1.47), (0.0, 1.47), 0.12, 0.30,
     "胴の厚みが見える／盾は胴の前")
# bladed: shield shoulder +0.18, sword shoulder -0.18, torso thin, shield forward
draw(axes[1], "半身（肩が前後に分かれる）", (0.18, 1.47), (-0.18, 1.47), 0.05, 0.33,
     "胴は薄く／盾が前へ／剣側の肩が下がる")
out = pathlib.Path(__file__).resolve().parent / "stance-yaw-demo.png"
fig.tight_layout(); fig.savefig(out, dpi=130)
print("saved:", out)
