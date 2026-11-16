#!/usr/bin/env python3
"""Build the full keyframe set inventory: the 31 vertical-slice sets (loaded
unchanged) + 48 attack sets for sica / pugio / trident / hasta + 9 defence sets
(parmula / small shield / weapon only) = 88 sets.

New attack sets adapt the approved gladius row patterns per weapon:
- sica (slash, 0.45 m): gladius slash rows, slightly deeper step, blade hooked
  lower at reach (its shield-bypass character lives in the selection scoring).
- pugio (thrust, 0.25 m): gladius thrust rows with a much deeper lunge.
- trident / hasta (thrust, 1.60 / 1.90 m): gladius thrust rows with the step
  pulled back and the arm extended -- the shaft does the reaching.
Feint / strong variants use the same derivations as build_keyframes.py.
Angles: absolute degrees (torso 0=up, limbs 0=down, + toward opponent);
weapon angle 0 = horizontal toward opponent, + = up.
"""
import json, pathlib

OUT = pathlib.Path(__file__).resolve().parent

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
        [0.80, 18, 75, 105, 20, 0, 0.10, 0.94, -8],
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
            if i == 6:
                nr.append(round(r[i] * 0.5, 2))
            elif i == 7:
                nr.append(round(s[i] + (r[i] - s[i]) * 0.65, 2))
            else:
                nr.append(round(s[i] + (r[i] - s[i]) * 0.65))
        out.append(nr)
    return out

def strong(rows, method):
    out = [list(r) for r in rows]
    w = out[1]
    w[1] -= 4
    if method == "slash":
        w[8] += 15
    else:
        w[2] -= 8
    r = out[3]
    r[6] = round(r[6] + 0.05, 2)
    r[1] += 4
    if method == "slash":
        out[4][8] -= 10
    return out

def tweak(rows, hipx=None, torso=None, ua=None, fa=None, weap=None, hipy=None):
    """Add per-keyframe deltas. Dicts map keyframe index -> delta."""
    out = [list(r) for r in rows]
    for idx, d in (hipx or {}).items():
        out[idx][6] = round(out[idx][6] + d, 2)
    for idx, d in (torso or {}).items():
        out[idx][1] += d
    for idx, d in (ua or {}).items():
        out[idx][2] += d
    for idx, d in (fa or {}).items():
        out[idx][3] += d
    for idx, d in (weap or {}).items():
        out[idx][8] += d
    for idx, d in (hipy or {}).items():
        out[idx][7] = round(out[idx][7] + d, 2)
    return out

def polearm_rows(part, rows):
    """Polearm sets: the shaft is so long that a forward carry would already
    touch the opponent at fighting distance, so keyframes 0-1 hold it
    withdrawn (tip up and back); the thrust extends from there."""
    out = [list(r) for r in rows]
    out[0] = [0.00, 8, 5, 25, 10, -5, 0.00, 0.93, 55]
    out[1] = [0.35, 4, -5, 15, 12, -8, -0.06, 0.92, 35]
    out[2][8] = {"torso": 6, "head": 14, "arm": 2, "leg": -16}[part]
    out[4][8] = 20
    if part in ("torso", "arm"):
        # keep the shaft at chest height: a fully raised arm puts the line at
        # face height and the sweep clips the head before the torso/arm
        out[2][2] -= 10; out[2][3] -= 18; out[2][8] -= 6
        out[3][2] -= 14; out[3][3] -= 14; out[3][8] -= 2; out[3][1] += 2
    return out

WEAPON_ROWS = {
    # sica: gladius slash, step a touch deeper, blade hooked down at reach;
    # the leg set steps deeper still (the blade is 0.05 m shorter and its
    # single-point band at 1.40 m was too marginal to fight from)
    "sica": ("slash", {part: tweak(rows,
                                   hipx={3: 0.06, 4: 0.04} if part == "leg" else {3: 0.03, 4: 0.02},
                                   weap={3: -5, 4: -8})
                       for part, rows in SLASH.items()}),
    # pugio: gladius thrust with a deep lunge (short blade must be carried in)
    "pugio": ("thrust", {
        "torso": tweak(THRUST["torso"], hipx={1: -0.02, 2: 0.10, 3: 0.22, 4: 0.14}, torso={3: 4}),
        "head": tweak(THRUST["head"], hipx={1: -0.02, 2: 0.10, 3: 0.22, 4: 0.14}, torso={3: 4}),
        "arm": tweak(THRUST["arm"], hipx={1: -0.02, 2: 0.10, 3: 0.22, 4: 0.14}, torso={3: 4}),
        "leg": tweak(THRUST["leg"], hipx={1: -0.02, 2: 0.10, 3: 0.24, 4: 0.15}, torso={3: 6}, hipy={3: -0.04, 4: -0.03}),
    }),
    # trident: gladius thrust, step pulled back, arm extended along the shaft
    "trident": ("thrust", {
        "torso": tweak(THRUST["torso"], hipx={2: -0.03, 3: -0.10, 4: -0.06}, ua={3: 7}, fa={3: 8}, torso={3: -4}, weap={3: -2}),
        "head": tweak(THRUST["head"], hipx={2: -0.03, 3: -0.10, 4: -0.06}, ua={3: 7}, fa={3: 8}, torso={3: -4}, weap={3: -8}),
        "arm": tweak(THRUST["arm"], hipx={2: -0.03, 3: -0.10, 4: -0.06}, ua={3: 7}, fa={3: 8}, torso={3: -4}, weap={3: 2}),
        "leg": tweak(THRUST["leg"], hipx={2: -0.04, 3: -0.12, 4: -0.07}, ua={3: 7}, fa={3: 8}, torso={3: -8}, hipy={3: 0.05, 4: 0.04}, weap={3: 4}),
    }),
    # hasta: same pattern, one step further back
    "hasta": ("thrust", {
        "torso": tweak(THRUST["torso"], hipx={2: -0.04, 3: -0.12, 4: -0.07}, ua={3: 8}, fa={3: 9}, torso={3: -5}, weap={3: -2}),
        "head": tweak(THRUST["head"], hipx={2: -0.04, 3: -0.12, 4: -0.07}, ua={3: 8}, fa={3: 9}, torso={3: -5}, weap={3: -8}),
        "arm": tweak(THRUST["arm"], hipx={2: -0.04, 3: -0.12, 4: -0.07}, ua={3: 8}, fa={3: 9}, torso={3: -5}, weap={3: 2}),
        "leg": tweak(THRUST["leg"], hipx={2: -0.05, 3: -0.14, 4: -0.08}, ua={3: 8}, fa={3: 9}, torso={3: -9}, hipy={3: 0.06, 4: 0.05}, weap={3: 4}),
    }),
}

for _w in ("trident", "hasta"):
    _m, _tab = WEAPON_ROWS[_w]
    WEAPON_ROWS[_w] = (_m, {part: polearm_rows(part, rows) for part, rows in _tab.items()})

PART_JP = {"head": "頭部", "torso": "胴体", "arm": "腕", "leg": "脚"}
slice_data = json.loads((OUT / "keyframes-vertical-slice.json").read_text(encoding="utf-8"))
sets = list(slice_data["sets"])

for weapon, (method, table) in WEAPON_ROWS.items():
    for part, base in table.items():
        for strength, rows in (("feint", feint(base)), ("normal", base), ("strong", strong(base, method))):
            sets.append({
                "id": f"{weapon}-{method}-{strength}-{part}",
                "weapon": weapon, "kind": "attack", "method": method,
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

# ---- defence sets for the other equipment classes (shield size is equipment
# data; the sets carry the same poses as the scutum's). Weapon-only sets carry
# no shield channel and work through the weapon-parry geometry. ----
def defence_set(sid, label, rows, shield=True):
    kfs = []
    for r in rows:
        kf = {"t": r[0], "torso": r[1], "upperArm": r[2], "forearm": r[3], "thigh": r[4],
              "shin": r[5], "hip": [r[6], r[7]], "weaponAngle": r[8]}
        if shield:
            kf["shield"] = {"dx": r[9], "dy": r[10], "angle": r[11]}
        kfs.append(kf)
    return {"id": sid, "weapon": label, "kind": "defence", "baseTime": 0.6, "keyframes": kfs}

BLOCK = [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40, 0.26, 0.02, 0],
    [0.5, 2, 28, 66, 14, -2, -0.03, 0.92, 35, 0.34, 0.03, 6],
    [1.0, 6, 30, 68, 11, -4, -0.01, 0.93, 38, 0.28, 0.02, 2],
]
DEFLECT = [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40, 0.26, 0.02, 0],
    [0.5, 14, 32, 72, 12, -4, 0.01, 0.93, 42, 0.30, 0.06, 38],
    [1.0, 10, 30, 70, 10, -5, 0.00, 0.93, 40, 0.27, 0.03, 12],
]
EVADE = [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40, 0.26, 0.02, 0],
    [0.5, -4, 26, 62, -16, 6, -0.28, 0.92, 30, 0.24, 0.02, -4],
    [1.0, 4, 28, 66, -6, -2, -0.38, 0.93, 36, 0.25, 0.02, 0],
]
for cls, label in (("parmula", "gladius+parmula"), ("smallshield", "gladius+smallshield")):
    sets.append(defence_set(f"defence-{cls}-block", label, BLOCK))
    sets.append(defence_set(f"defence-{cls}-deflect", label, DEFLECT))
    sets.append(defence_set(f"defence-{cls}-evade", label, EVADE))

WONLY_BLOCK = [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40],
    [0.5, 4, 58, 96, 14, -2, -0.03, 0.92, 78],
    [1.0, 6, 52, 90, 11, -4, -0.01, 0.93, 72],
]
WONLY_DEFLECT = [
    [0.0, 8, 30, 70, 10, -5, 0.00, 0.93, 40],
    [0.5, 12, 46, 82, 12, -4, 0.01, 0.93, 55],
    [1.0, 9, 42, 78, 10, -5, 0.00, 0.93, 50],
]
WONLY_EVADE = [r[:9] for r in EVADE]
sets.append(defence_set("defence-weapononly-block", "gladius only", WONLY_BLOCK, shield=False))
sets.append(defence_set("defence-weapononly-deflect", "gladius only", WONLY_DEFLECT, shield=False))
sets.append(defence_set("defence-weapononly-evade", "gladius only", WONLY_EVADE, shield=False))

data = {
    "note": "Full inventory v1: the 31 vertical-slice sets plus sica/pugio/trident/hasta attacks "
            "(48) and parmula/small-shield/weapon-only defence sets (9). Angles: absolute degrees, "
            "torso 0=up, limbs 0=down, + toward opponent. Weapon angle: 0 = horizontal toward "
            "opponent, + = up. Shield: offset from torso centre. Standard build (doc v3.5).",
    "sets": sets,
}

# Thrust timing (adopted 2026-11-15): thrusts leave fast and return slowly.
# Keyframe fractions for every thrust set become [0, .30, .50, .70, 1.0]
# (windup 300ms, strike 200ms, extension 200ms, return 300ms at baseTime 1.0),
# replacing the slash fractions [0, .35, .60, .80, 1.0]. Total time unchanged.
THRUST_T = [0.0, 0.30, 0.50, 0.70, 1.0]
for _s in sets:
    if _s["kind"] == "attack" and _s.get("method") == "thrust":
        for _i, _kf in enumerate(_s["keyframes"]):
            _kf["t"] = THRUST_T[_i]
        _s["markers"] = {"executionStart": 0.30, "finalPhaseStart": 0.70}

# Reference distances (from the swing test, keyframe-swing-test.json): every
# attack set carries refDistance, the foot gap it is thrown from. Auto part
# selection scores each part at its set's refDistance and the attacker moves to
# it before attacking (design doc v3.44; gladius sets included from v3.44).
_st = json.loads((OUT / "keyframe-swing-test.json").read_text(encoding="utf-8"))
for _s in sets:
    if _s["kind"] == "attack":
        _nid = _s["id"].replace("-feint-", "-normal-").replace("-strong-", "-normal-")
        _s["refDistance"] = _st[_nid]["ref"]
(OUT / "keyframes-full.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

# ---- Markdown rendering ----
WEAPON_JP = {"gladius": "グラディウス", "sica": "スィカ", "pugio": "プギオ",
             "trident": "トライデント", "hasta": "ハスタ"}
NAME = {"slash": "斬る", "thrust": "突く", "feint": "牽制", "normal": "通常", "strong": "強"}
DEF_JP = {"block": "受け止める", "deflect": "受け流す", "evade": "回避する"}
CLS_JP = {"scutum": "スクートゥム", "parmula": "パルムラ", "smallshield": "小盾", "weapononly": "武器のみ"}
COM_JP = {"common-advance-1m": "共通／前進（1mあたり）", "common-retreat-1m": "共通／後退（1mあたり）",
          "common-posture-recovery": "共通／体勢を立て直す", "common-shield-push": "共通／盾押し"}
lines = ["# キーフレーム一式（全88セット）v1", "",
         "縦割り31セットに、他4武器の攻撃48セットと、パルムラ・小盾・武器のみの防御9セットを加えたもの。",
         "角度は絶対角度（胴体0°＝真上、四肢0°＝真下、+は相手方向）。武器角度は0°＝相手へ水平、+は上向き。",
         "盾は胴体中心点からのオフセット（dx＝相手方向、dy＝上）と角度（0°＝直立、+は上端が相手側へ）。盾の大きさは装備パラメータ側で持つ。", ""]
for s in sets:
    if s["kind"] == "attack":
        title = f"{WEAPON_JP[s['weapon']]}／{NAME[s['strength']]}／{NAME[s['method']]}／{PART_JP[s['part']]}狙い（{s['baseTime']}秒）"
    elif s["kind"] == "defence":
        cls = s["id"].split("-")[1]
        pol = s["id"].split("-")[2]
        title = f"防御／{CLS_JP[cls]}／{DEF_JP[pol]}（{s['baseTime']}秒）"
    else:
        title = COM_JP[s["id"]] + f"（{s['baseTime']}秒）"
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
(OUT / "keyframes-full.md").write_text("\n".join(lines), encoding="utf-8")

print("sets:", len(sets),
      "| attacks:", sum(1 for s in sets if s["kind"] == "attack"),
      "| defence:", sum(1 for s in sets if s["kind"] == "defence"),
      "| common:", sum(1 for s in sets if s["kind"] == "common"))
