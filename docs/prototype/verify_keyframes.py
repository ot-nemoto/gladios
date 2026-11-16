#!/usr/bin/env python3
"""Swing test for every attack set in keyframes-full.json.

For each normal-strength attack set, scan sole distances D = 0.60..3.20 m with
fine sampling (400 steps over the action) and record the first contact of the
attacker's weapon segment against a static standard-build defender, using the
simulator's own geometry (sim_prototype).

Reference distance policy (the distance tactics should enter before using the
set):
- head / arm / leg sets: the far band where the first contact against a
  scutum-carrying stance defender is the intended part itself; if the shield
  intercepts at every distance, fall back to the same band against a shieldless
  defender.
- torso sets: a carried scutum legitimately covers the torso, so use the
  greatest distance where the first contact is the shield while the trajectory
  still reaches the torso behind it, minus a 0.05 m margin.
Feint / strong variants are spot-checked at the reference distance, as is the
first contact against the scutum block pose (weapon parry included).
Writes refDistance into keyframes-full.json (shared by a set's three
strengths) and a JSON report; prints the table.
"""
import json, pathlib, types
import sim_prototype as S

OUT = pathlib.Path(__file__).resolve().parent
FULL = OUT / "keyframes-full.json"
data = json.loads(FULL.read_text(encoding="utf-8"))
SETS = {s["id"]: s for s in data["sets"]}
S.KF = SETS  # point the simulator's geometry at the full inventory
WLEN = {k: v["len"] for k, v in S.WEAPONS.items()}

def fake(x, facing, wlen, shield_half):
    return types.SimpleNamespace(x=x, facing=facing, wlen=wlen, shield_half=shield_half)

def pose_of(kf):
    return {k: v for k, v in kf.items() if k != "t"}

BLOCK_POSE = pose_of(SETS["defence-scutum-block"]["keyframes"][1])
DS = [round(0.60 + 0.05 * i, 2) for i in range(53)]

def first_contact(set_id, D, def_pose, def_shield, samples=400, parry=False):
    s = SETS[set_id]
    att = fake(0.0, 1, WLEN[s["weapon"]], None)
    dfn = fake(D, -1, 0.50, def_shield)
    regs, _ = S.regions_of(dfn, def_pose)
    for i in range(samples + 1):
        P = S.fk_points(att, S.interp_pose(set_id, i / samples))
        w1, w2 = P["grip"], P["tip"]
        if parry and S.seg_seg(w1, w2, *regs["weapon"]):
            return "weapon"
        if "shield" in regs and S.seg_obb(w1, w2, regs["shield"]):
            return "shield"
        for part in ("arm", "leg"):
            if any(S.seg_obb(w1, w2, b) for b in S.part_boxes(regs, part)):
                return part
        if S.seg_obb(w1, w2, regs["torso"]):
            return "torso"
        if S.seg_circle(w1, w2, regs["head"], 0.11 + 0.04):
            return "head"
    return None

def reaches_part(set_id, D, part, samples=400):
    s = SETS[set_id]
    att = fake(0.0, 1, WLEN[s["weapon"]], None)
    dfn = fake(D, -1, 0.50, None)
    regs, _ = S.regions_of(dfn, S.STANCE)
    for i in range(samples + 1):
        P = S.fk_points(att, S.interp_pose(set_id, i / samples))
        w1, w2 = P["grip"], P["tip"]
        if part in ("arm", "leg"):
            if any(S.seg_obb(w1, w2, b) for b in S.part_boxes(regs, part)):
                return True
        elif part == "torso":
            if S.seg_obb(w1, w2, regs["torso"]):
                return True
        elif part == "head":
            if S.seg_circle(w1, w2, regs["head"], 0.11 + 0.04):
                return True
    return False

def runs_of(ds):
    if not ds:
        return []
    runs, run = [], [ds[0]]
    for d in ds[1:]:
        if abs(d - run[-1] - 0.05) < 1e-9:
            run.append(d)
        else:
            runs.append(run); run = [d]
    runs.append(run)
    return runs

def far_mid(ds):
    runs = runs_of(ds)
    if not runs:
        return None
    best = max(runs, key=lambda r: (r[0] + r[-1]) / 2)
    return round((best[0] + best[-1]) / 2, 2), (best[0], best[-1])

results = {}
print(f"{'set':34s} {'refD':>5s} {'basis':22s} {'vs block':8s} {'feint@ref':9s} {'strong@ref':10s}")
for s in data["sets"]:
    if s["kind"] != "attack" or s["strength"] != "normal":
        continue
    part = s["part"]
    cat_scu = {D: first_contact(s["id"], D, S.STANCE, 0.50) for D in DS}
    if part == "torso":
        cand = [D for D in DS if cat_scu[D] == "shield" and reaches_part(s["id"], D, "torso")]
        ref = round(max(cand) - 0.05, 2) if cand else None
        basis = f"shield-first to {max(cand):.2f}" if cand else "NONE"
    else:
        bandA = [D for D in DS if cat_scu[D] == part]
        got = far_mid(bandA)
        if got:
            ref, rng = got
            basis = f"part-first {rng[0]:.2f}-{rng[1]:.2f}"
        else:
            bandC = [D for D in DS if first_contact(s["id"], D, S.STANCE, None) == part]
            if bandC:
                ref = round(max(bandC) - 0.05, 2)
                basis = f"shieldless to {max(bandC):.2f}"
            else:
                ref, basis = None, "NONE"
    blk = first_contact(s["id"], ref, BLOCK_POSE, 0.50, parry=True) if ref else None
    row = {"ref": ref, "basis": basis, "vsBlock": blk}
    for strength in ("feint", "strong"):
        vid = s["id"].replace("-normal-", f"-{strength}-")
        row[strength] = first_contact(vid, ref, S.STANCE, None) if ref else None
    results[s["id"]] = row
    print(f"{s['id']:34s} {ref if ref else 0:5.2f} {basis:22s} {str(blk):8s} {str(row['feint']):9s} {str(row['strong']):10s}")

refmap = {}
for sid, r in results.items():
    if r["ref"]:
        w, m, _s, part = sid.split("-")
        refmap[(w, m, part)] = r["ref"]
for s in data["sets"]:
    if s["kind"] == "attack":
        s.pop("refDistance", None)
        # gladius distances stay the check conditions' validated ones (the sim
        # falls back to approach_until); refDistance gates the new weapons only
        if s["weapon"] != "gladius":
            r = refmap.get((s["weapon"], s["method"], s["part"]))
            if r is not None:
                s["refDistance"] = r
FULL.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
(OUT / "keyframe-swing-test.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
bad = [k for k, v in results.items() if not v["ref"]]
print("\nsets checked:", len(results), "| without a reference distance:", bad if bad else "none")
