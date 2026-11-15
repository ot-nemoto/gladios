#!/usr/bin/env python3
"""Build the vertical-slice keyframe sets (gladius 24 + scutum defence 3 + common 4)
in the style approved for set 1 (gladius / normal / slash / torso).
Angles are absolute degrees: torso 0=up, limbs 0=down, + toward opponent.
Weapon angle: 0 = horizontal toward opponent, + = up.
Shield: offset (dx, dy) in metres from the torso centre point, angle 0 = upright, + = top toward opponent.
"""
import json, math, pathlib

OUT = pathlib.Path.home() / "workspace/gladiator-game"

# rows: [t, torso, upperArm, forearm, thigh, shin, hipX, hipY, weapon]
SLASH = {
    "torso": [
        [0.00, 8, 30, 70, 10, -5, 0.00, 0.93, 40],
        [0.35, -6, -35, 15, 12, -8, -0.03, 0.92, 130],
        [0.60, 12, 55, 95, 16, -4, 0.05, 0.93, 55],
        [0.80, 18, 85, 115, 20, 0, 0.10, 0.94, 5],
        [1.00, 14, 65, 85, 16, -2, 0.07, 0.93, -35],
    ],
    "head": [
        [0.00, 8, 35, 75, 10, -5, 0.00, 0.93, 55],
        [0.35, -8, -45, 20, 12, -8, -0.03, 0.92, 145],
        [0.60, 10, 70, 110, 16, -4, 0.05, 0.93, 80],
        [0.80, 14, 105, 125, 20, 0, 0.10, 0.95, 18],
        [1.00, 12, 80, 100, 16, -2, 0.07, 0.93, -5],
    ],
    "arm": [
        [0.00, 8, 30, 65, 10, -5, 0.00, 0.93, 35],
        [0.35, -6, -30, 10, 12, -8, -0.03, 0.92, 120],
        [0.60, 12, 50, 85, 16, -4, 0.05, 0.93, 40],
        [0.80, 16, 75, 105, 20, 0, 0.10, 0.94, -8],
        [1.00, 13, 58, 78, 16, -2, 0.07, 0.93, -40],
    ],
    "leg": [
        [0.00, 10, 28, 60, 12, -4, 0.00, 0.92, 30],
        [0.35, 0, -20, 10, 14, -6, -0.03, 0.90, 105],
        [0.55, 20, 5, 12, 20, -2, 0.05, 0.87, -25],
        [0.85, 36, 65, 5, 26, 2, 0.16, 0.84, -32],
        [1.00, 30, 50, 0, 22, 0, 0.10, 0.86, -58],
    ],
}
THRUST = {
    "torso": [
        [0.00, 8, 35, 60, 10, -5, 0.00, 0.93, 10],
        [0.35, 2, 5, 35, 12, -8, -0.04, 0.92, 8],
        [0.60, 12, 60, 85, 16, -4, 0.05, 0.93, 4],
        [0.80, 20, 88, 92, 20, 0, 0.12, 0.94, 2],
        [1.00, 14, 70, 80, 16, -2, 0.07, 0.93, -6],
    ],
    "head": [
        [0.00, 8, 38, 62, 10, -5, 0.00, 0.93, 16],
        [0.35, 2, 10, 38, 12, -8, -0.04, 0.92, 14],
        [0.60, 10, 72, 95, 16, -4, 0.05, 0.94, 12],
        [0.80, 16, 100, 105, 20, 0, 0.12, 0.95, 14],
        [1.00, 12, 80, 88, 16, -2, 0.07, 0.93, 4],
    ],
    "arm": [
        [0.00, 8, 33, 58, 10, -5, 0.00, 0.93, 6],
        [0.35, 2, 2, 32, 12, -8, -0.04, 0.92, 4],
        [0.60, 12, 55, 80, 16, -4, 0.05, 0.93, 0],
        [0.80, 18, 80, 88, 20, 0, 0.12, 0.94, -4],
        [1.00, 13, 64, 76, 16, -2, 0.07, 0.93, -12],
    ],
    "leg": [
        [0.00, 10, 30, 55, 12, -4, 0.00, 0.92, 0],
        [0.35, 4, 2, 30, 14, -6, -0.04, 0.90, -4],
        [0.55, 22, 15, 30, 20, -2, 0.06, 0.87, -10],
        [0.85, 40, 68, 30, 26, 2, 0.18, 0.83, -34],
        [1.00, 32, 52, 28, 22, 0, 0.11, 0.85, -46],
    ],
}

def feint(rows):
    s = rows[0]
    out = [list(s)]
    for r in rows[1:]:
        nr = [r[0]]
        for i in range(1, 9):
            if i == 6:  # hipX
                nr.append(round(r[i] * 0.5, 2))
            elif i == 7:  # hipY
                nr.append(round(s[i] + (r[i] - s[i]) * 0.65, 2))
            else:
                nr.append(round(s[i] + (r[i] - s[i]) * 0.65))
        out.append(nr)
    return out

def strong(rows, method):
    out = [list(r) for r in rows]
    w = out[1]
    w[1] -= 4                      # torso leans back more in windup
    if method == "slash":
        w[8] += 15                 # bigger raise
    else:
        w[2] -= 8                  # arm pulled back more
    r = out[3]
    r[6] = round(r[6] + 0.05, 2)   # deeper step
    r[1] += 4                      # deeper lean at reach
    if method == "slash":
        out[4][8] -= 10            # deeper follow-through
    return out

PART_JP = {"head": "頭部", "torso": "胴体", "arm": "腕", "leg": "脚"}
sets = []
for method, table in (("slash", SLASH), ("thrust", THRUST)):
    for part, base in table.items():
        for strength, rows in (("feint", feint(base)), ("normal", base), ("strong", strong(base, method))):
            sets.append({
                "id": f"gladius-{method}-{strength}-{part}",
                "weapon": "gladius", "kind": "attack", "method": method,
                "strength": strength, "part": part,
                "baseTime": {"feint": 0.7, "normal": 1.0, "strong": 1.5}[strength],
                "markers": {"executionStart": 0.35,
                            "finalPhaseStart": 0.85 if part == "leg" else 0.80},
                "keyframes": [
                    {"t": r[0], "torso": r[1], "upperArm": r[2], "forearm": r[3],
                     "thigh": r[4], "shin": r[5], "hip": [r[6], r[7]], "weaponAngle": r[8]}
                    for r in rows
                ],
            })

STANCE_SHIELD = {"dx": 0.26, "dy": 0.02, "angle": 0}
def defence_set(sid, rows):
    return {"id": sid, "weapon": "gladius+scutum", "kind": "defence", "baseTime": 0.6,
            "keyframes": [
                {"t": r[0], "torso": r[1], "upperArm": r[2], "forearm": r[3], "thigh": r[4],
                 "shin": r[5], "hip": [r[6], r[7]], "weaponAngle": r[8],
                 "shield": {"dx": r[9], "dy": r[10], "angle": r[11]}} for r in rows]}

sets.append(defence_set("defence-scutum-block", [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40, 0.26, 0.02, 0],
    [0.5, 2, 28, 66, 14, -2, -0.03, 0.92, 35, 0.34, 0.03, 6],
    [1.0, 6, 30, 68, 11, -4, -0.01, 0.93, 38, 0.28, 0.02, 2],
]))
sets.append(defence_set("defence-scutum-deflect", [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40, 0.26, 0.02, 0],
    [0.5, 14, 32, 72, 12, -4, 0.01, 0.93, 42, 0.30, 0.06, 38],
    [1.0, 10, 30, 70, 10, -5, 0.00, 0.93, 40, 0.27, 0.03, 12],
]))
sets.append(defence_set("defence-scutum-evade", [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40, 0.26, 0.02, 0],
    [0.5, -4, 26, 62, -16, 6, -0.28, 0.92, 30, 0.24, 0.02, -4],
    [1.0, 4, 28, 66, -6, -2, -0.38, 0.93, 36, 0.25, 0.02, 0],
]))

def common_set(sid, base_time, rows, shield=False):
    kfs = []
    for r in rows:
        kf = {"t": r[0], "torso": r[1], "upperArm": r[2], "forearm": r[3], "thigh": r[4],
              "shin": r[5], "hip": [r[6], r[7]], "weaponAngle": r[8]}
        if shield:
            kf["shield"] = {"dx": r[9], "dy": r[10], "angle": r[11]}
        kfs.append(kf)
    return {"id": sid, "kind": "common", "baseTime": base_time, "keyframes": kfs}

sets.append(common_set("common-advance-1m", 0.55, [
    [0.00, 8, 30, 70, 10, -5, 0.00, 0.93, 40],
    [0.35, 9, 30, 70, 34, 12, 0.35, 0.94, 40],
    [0.70, 9, 30, 70, -6, 18, 0.70, 0.93, 40],
    [1.00, 8, 30, 70, 10, -5, 1.00, 0.93, 40],
]))
sets.append(common_set("common-retreat-1m", 0.55, [
    [0.00, 8, 30, 70, 10, -5, 0.00, 0.93, 40],
    [0.35, 7, 30, 70, -30, -14, -0.35, 0.94, 40],
    [0.70, 7, 30, 70, 8, -16, -0.70, 0.93, 40],
    [1.00, 8, 30, 70, 10, -5, -1.00, 0.93, 40],
]))
sets.append(common_set("common-posture-recovery", 1.2, [
    [0.00, 28, 15, 40, 22, 8, 0.00, 0.84, 10],
    [0.50, 16, 22, 55, 14, 0, 0.00, 0.89, 25],
    [1.00, 8, 30, 70, 10, -5, 0.00, 0.93, 40],
]))
sets.append(common_set("common-shield-push", 1.0, [
    [0.00, 8, 30, 70, 10, -5, 0.00, 0.93, 20, 0.26, 0.02, 0],
    [0.35, -2, 28, 64, 12, -8, -0.04, 0.92, 15, 0.20, 0.02, -4],
    [0.60, 12, 29, 62, 16, -4, 0.04, 0.93, 18, 0.32, 0.02, 2],
    [0.80, 22, 30, 60, 24, 0, 0.14, 0.93, 20, 0.42, 0.02, 4],
    [1.00, 14, 30, 66, 16, -2, 0.08, 0.93, 22, 0.30, 0.02, 2],
], shield=True))
sets[-1]["markers"] = {"executionStart": 0.35, "finalPhaseStart": 0.80}

data = {
    "note": "Vertical slice v1. Style approved on set gladius-slash-normal-torso (2026-11-15). "
            "Angles: absolute degrees, torso 0=up, limbs 0=down, + toward opponent. "
            "Weapon angle: 0 = horizontal toward opponent, + = up. "
            "Shield: offset from torso centre (dx toward opponent, dy up), angle 0 = upright, + = top toward opponent. "
            "Standard build (design doc v3.5) is assumed.",
    "sets": sets,
}
(OUT / "keyframes-vertical-slice.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

# ---- Markdown rendering ----
lines = ["# キーフレーム一式（縦割り31セット）v1", "",
         "様式はセット1（グラディウス／通常／斬る／胴体）で承認済み。角度は絶対角度（胴体0°＝真上、四肢0°＝真下、+は相手方向）。",
         "武器角度は0°＝相手へ水平、+は上向き。盾は胴体中心点からのオフセット（dx＝相手方向、dy＝上）と角度（0°＝直立、+は上端が相手側へ）。",
         "標準体格（設計書v3.5）を前提とする。攻撃の印：予備完了＝実行開始印、到達＝完了直前開始印。", ""]
NAME = {"slash": "斬る", "thrust": "突く", "feint": "牽制", "normal": "通常", "strong": "強"}
for s in sets:
    if s["kind"] == "attack":
        title = f"グラディウス／{NAME[s['strength']]}／{NAME[s['method']]}／{PART_JP[s['part']]}狙い（{s['baseTime']}秒）"
    elif s["kind"] == "defence":
        title = {"defence-scutum-block": "防御／スクートゥム／受け止める", "defence-scutum-deflect": "防御／スクートゥム／受け流す",
                 "defence-scutum-evade": "防御／スクートゥム／回避する"}[s["id"]] + f"（{s['baseTime']}秒）"
    else:
        title = {"common-advance-1m": "共通／前進（1mあたり）", "common-retreat-1m": "共通／後退（1mあたり）",
                 "common-posture-recovery": "共通／体勢を立て直す", "common-shield-push": "共通／盾押し"}[s["id"]] + f"（{s['baseTime']}秒）"
    has_shield = any("shield" in k for k in s["keyframes"])
    lines.append(f"## {title}")
    lines.append("")
    hdr = "| 時刻 | 胴体 | 上腕 | 前腕 | 太腿 | 下腿 | 股関節(x, y) | 武器 |" + (" 盾(dx, dy, 角度) |" if has_shield else "")
    sep = "|---|---|---|---|---|---|---|---|" + ("---|" if has_shield else "")
    lines += [hdr, sep]
    for k in s["keyframes"]:
        row = f"| {k['t']:.2f} | {k['torso']} | {k['upperArm']} | {k['forearm']} | {k['thigh']} | {k['shin']} | ({k['hip'][0]:.2f}, {k['hip'][1]:.2f}) | {k['weaponAngle']} |"
        if has_shield:
            sh = k["shield"]
            row += f" ({sh['dx']:.2f}, {sh['dy']:.2f}, {sh['angle']}) |"
        lines.append(row)
    lines.append("")
(OUT / "keyframes-vertical-slice.md").write_text("\n".join(lines), encoding="utf-8")

# ---- Pose check plot (forward kinematics, standard build) ----
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def fk(kf):
    d = math.radians
    hip = (kf["hip"][0], kf["hip"][1])
    knee = (hip[0] + 0.44 * math.sin(d(kf["thigh"])), hip[1] - 0.44 * math.cos(d(kf["thigh"])))
    ankle = (knee[0] + 0.44 * math.sin(d(kf["shin"])), knee[1] - 0.44 * math.cos(d(kf["shin"])))
    sho = (hip[0] + 0.52 * math.sin(d(kf["torso"])), hip[1] + 0.52 * math.cos(d(kf["torso"])))
    head = (sho[0] + 0.17 * math.sin(d(kf["torso"])), sho[1] + 0.17 * math.cos(d(kf["torso"])))
    elb = (sho[0] + 0.30 * math.sin(d(kf["upperArm"])), sho[1] - 0.30 * math.cos(d(kf["upperArm"])))
    wri = (elb[0] + 0.28 * math.sin(d(kf["forearm"])), elb[1] - 0.28 * math.cos(d(kf["forearm"])))
    grip = (wri[0] + 0.18 * math.cos(d(kf["weaponAngle"])), wri[1] + 0.18 * math.sin(d(kf["weaponAngle"])))
    tip = (grip[0] + 0.50 * math.cos(d(kf["weaponAngle"])), grip[1] + 0.50 * math.sin(d(kf["weaponAngle"])))
    return hip, knee, ankle, sho, head, elb, wri, grip, tip

def get(sid):
    return next(s for s in sets if s["id"] == sid)

fig, axes = plt.subplots(1, 4, figsize=(13, 4.2))
checks = [
    ("gladius-slash-normal-torso", 3, "slash / torso / reach"),
    ("gladius-slash-normal-leg", 3, "slash / leg / reach"),
    ("gladius-thrust-normal-head", 3, "thrust / head / reach"),
    ("defence-scutum-block", 1, "scutum block / contact"),
]
for ax, (sid, idx, title) in zip(axes, checks):
    s = get(sid)
    kf = s["keyframes"][idx]
    hip, knee, ankle, sho, head, elb, wri, grip, tip = fk(kf)
    ax.plot([hip[0], knee[0], ankle[0]], [hip[1], knee[1], ankle[1]], "o-", color="tab:blue", lw=2)
    ax.plot([hip[0], sho[0]], [hip[1], sho[1]], "o-", color="tab:blue", lw=2)
    ax.plot([sho[0], elb[0], wri[0]], [sho[1], elb[1], wri[1]], "o-", color="tab:orange", lw=2)
    ax.plot([grip[0], tip[0]], [grip[1], tip[1]], "-", color="tab:red", lw=3)
    ax.add_patch(plt.Circle(head, 0.11, fill=False, color="tab:blue", lw=2))
    if "shield" in kf:
        sh = kf["shield"]
        cx = hip[0] + 0.26 * math.sin(math.radians(kf["torso"])) + sh["dx"]
        cy = hip[1] + 0.26 * math.cos(math.radians(kf["torso"])) + sh["dy"]
        a = math.radians(sh["angle"])
        dx, dy = 0.5 * math.sin(a), 0.5 * math.cos(a)
        ax.plot([cx - dx, cx + dx], [cy - dy, cy + dy], "-", color="tab:green", lw=5)
    ax.axhline(0, color="gray", lw=1)
    ax.set_xlim(-0.6, 1.6); ax.set_ylim(-0.05, 1.95)
    ax.set_aspect("equal"); ax.set_title(title, fontsize=9)
    ax.grid(alpha=0.3)
fig.tight_layout()
fig.savefig(OUT / "keyframes-pose-check.png", dpi=110)
print("sets:", len(sets), "| attacks:", sum(1 for s in sets if s['kind'] == 'attack'),
      "| defence:", sum(1 for s in sets if s['kind'] == 'defence'),
      "| common:", sum(1 for s in sets if s['kind'] == 'common'))
