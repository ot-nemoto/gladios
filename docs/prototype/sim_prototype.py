#!/usr/bin/env python3
"""Prototype combat simulator for the gladiator auto-battle design (check build).

Implements the decided rules from the design doc at check level:
- 2-layer coordinates, standard build, linear keyframe interpolation
- Weapon segment vs hit regions (shield / weapon / arm / leg / torso / head),
  first contact wins, same-step ties by front-layer priority
- Damage stages via E = P - armour + part modifier; stage effect table
- Block processing (impact vs shield defence / weapon block value)
- Hold (構え) model (v3.35): a chosen attack waits in a hold (max 0.30 + 0.004 x
  judgment level) before starting; only uncommitted states can switch to the
  defence-policy action after detection + judgment delay; started actions are
  never interrupted
- Stamina stages, posture model, injury accumulation (decided channels)
- Event log (0.01s), deterministic: fixed dt, no randomness

Simplifications (prototype only):
- Movement stamina is charged per metre travelled instead of at action start
- Defence pose starts from the defence set's first keyframe (no pose blending)
- Defence policies: block / evade / deflect (deflect per v3.13)
- Automatic target-part selection (v3.11) via Sim(auto={id: set pattern});
  exposure tiers judged along the attack trajectory (v3.37 amendment)
- Attack durations (v3.43 fix): an attack action lasts its set's baseTime
  (feint 0.7 / normal 1.0 / strong 1.5); earlier builds always used 1.0s.
- Prediction (v3.43): the defender reads the attack's length from the hold
  and delays the defence start by (baseTime - 1.0) x judgment level / 100,
  so longer attacks are met later; a clean whiff against a deflect or an
  evade costs the attacker posture -10 (normal/feint) or -20 (strong).
- Deflect judgement (v3.42, unified to timing): against slashes, a deflect
  is judged at the first shield or weapon contact during the defence action
  (the v3.41 shield-angle rule never fired for torso attacks because the
  swords meet first). Success slides off with no impact and a full miss
  costs the attacker posture -10 (normal) / -20 (strong); a miss worsens
  the defender's block costs by one stage; a bad miss on a shield contact
  vs a strong attack knocks the shield aside (attack continues at P -20).
  Thrusts resolve as blocks even against a deflect policy.
- Held deflect pose (v3.43): a deflect action keeps its set pose (the
  middle keyframe) until the triggering attack resolves: enter (first half)
  -> hold -> exit (second half). The judgement is by the pose's progress at
  contact: at/after the set point (0.5, earlier with technique) it succeeds;
  before it, it fails; far before it, the bad-miss tier applies. Slow, big
  attacks arrive after the pose is set; fast ones arrive before it.
- Reaction timing (v3.40, plan A): the defender's detection+judgment clock
  starts when the opponent enters the hold (Sim._enter_hold); one reaction per
  hold, tracked via Glad.switch_for. Attacks without a hold and pushes still
  schedule at action start.
- Shield push (v3.38) via Sim(push_users={id: "push" | "mix"}): shield contact
  costs the opponent posture (25, or 15 while block-defending; evade = whiff)
  and pushes them back 0.5 m; the pusher's shield is scanned as its axis
  segment (prototype simplification)
- Shield region is always present at its carried position when not defending
- Reference distance (v3.44): every attack set carries refDistance. Auto part
  selection scores each part as if standing at that part's set refDistance
  (if that spot is outside the arena, at the arena edge instead),
  and an attacker moves to the chosen set's refDistance (approach if farther,
  retreat if closer, tolerance REF_TOLERANCE) before entering the hold.
  Approach/retreat stop exactly at their target gap (no overshoot). The
  general "rule 3" approach (gap >= 1.5 -> approach) now applies only to
  gladiators that do not attack (passive dummies); attackers' spacing is
  governed by the reference distance.
- Double KO (v3.45): if both gladiators reach 0 HP in the same step, the
  bout is a draw (winner None, reason 相打ち).
- Tie-break order (v3.44): torso > head > leg > arm (leg moved ahead of arm:
  at their reference distances both often score "armour only", and the leg
  slash passes under the shield while the arm slash meets a raised shield).
"""
import json, math, pathlib, sys, types

BASE = pathlib.Path(__file__).resolve().parent
_kf_path = BASE / "keyframes-full.json"
if not _kf_path.exists():
    _kf_path = BASE / "keyframes-vertical-slice.json"
KF = {s["id"]: s for s in json.loads(_kf_path.read_text(encoding="utf-8"))["sets"]}
COND = json.loads((BASE / "check-conditions-v1.json").read_text(encoding="utf-8"))

DT = 0.005
STAGE = [(20, "軽微"), (50, "通常"), (80, "重傷"), (10**9, "致命傷")]
HP_LOSS = {"軽微": 4, "通常": 12, "重傷": 30, "致命傷": 60}
INJ_PTS = {"軽微": 1, "通常": 2, "重傷": 4, "致命傷": 7}
POSTURE_LOSS = {"軽微": 5, "通常": 15, "重傷": 30, "致命傷": 60}
BLOCK_POSTURE = {"軽微": 0, "通常": 5, "重傷": 15, "致命傷": 30}
BLOCK_STAMINA = {"軽微": 0, "通常": 3, "重傷": 8, "致命傷": 15}
PART_MOD = {"head": 10, "torso": 0, "arm": -5, "leg": -5}
ARMOUR = {"head": 25, "torso": 30, "arm": 20, "leg": 20}
STANCE = {"torso": 8, "upperArm": 30, "forearm": 70, "thigh": 10, "shin": -5,
          "hip": [0.0, 0.93], "weaponAngle": 40, "shield": {"dx": 0.26, "dy": 0.02, "angle": 0}}
WEAPONS = {  # design doc v3.22 (values provisional)
    "gladius": {"len": 0.50, "atk": 50, "block": 25, "weight": 1.0},
    "sica": {"len": 0.45, "atk": 46, "block": 12, "weight": 0.9},
    "pugio": {"len": 0.25, "atk": 36, "block": 5, "weight": 0.6},
    "trident": {"len": 1.60, "atk": 46, "block": 20, "weight": 1.3},
    "hasta": {"len": 1.90, "atk": 52, "block": 12, "weight": 1.2},
}
SHIELDS = {  # design doc v3.23: half = vertical half-length of the shield region
    "scutum": {"half": 0.50, "def": 40, "weight": 1.5},
    "parmula": {"half": 0.275, "def": 28, "weight": 0.8},
    "small": {"half": 0.175, "def": 20, "weight": 0.5},
}
STRENGTH_CORR = {"feint": -20, "normal": 0, "strong": 20}  # v3.12 action correction to P
REF_TOLERANCE = 0.02  # v3.44: move to the set's refDistance when the gap is outside +-this (provisional)
ARENA_HALF = 12.0     # v3.25: movement bounds are +-12 m from the origin
def clamp_arena(x):
    """Keep a position inside the movement bounds (+-ARENA_HALF)."""
    return max(-ARENA_HALF, min(ARENA_HALF, x))


GAP_EPS = 1e-9        # float slack when a move has reached its target gap (avoids endless tiny steps)


def apply_equip(g, weapon_name, shield_name):
    g.weapon_name = weapon_name
    w = WEAPONS[weapon_name]
    g.wlen, g.watk, g.wblock, g.wweight = w["len"], w["atk"], w["block"], w["weight"]
    if weapon_name == "trident":  # two-handed (v3.22): no shield
        shield_name = None
    g.shield_name = shield_name
    sh = SHIELDS[shield_name] if shield_name else None
    g.shield_half = sh["half"] if sh else None
    g.shield_def = sh["def"] if sh else 0
    g.equip_mult = 0.8 + 0.04 * (g.wweight + (sh["weight"] if sh else 0.0))


def stage_of(E):
    for lim, name in STAGE:
        if E < lim:
            return name


def stamina_stage(g):
    r = g.stamina / 100.0
    if r > 0.50:
        return ("余裕", 1.0, 0)
    if r >= 0.25:
        return ("低下", 1.1, 10)
    if r >= 0.10:
        return ("不足", 1.25, 25)
    return ("枯渇", 1.5, 40)


def judgment_level(g):
    _, _, pen = stamina_stage(g)
    pen_sum = pen
    if g.posture < 50:
        pen_sum += 10
    pen_sum += {0: 0, 1: 5, 2: 15, 3: 30}[injury_degree(g, "head")]
    return g.judgment_base - pen_sum * (1 - 50 / 200)


def hold_time(g):
    return max(0.05, 0.30 + 0.004 * judgment_level(g))


def judgment_delay(g):
    return 0.25 - 0.002 * judgment_level(g)


def read_shift(dfn, set_id):
    """Prediction (v3.43): how far the defender delays the defence start
    after reading the incoming attack's length from its hold."""
    if set_id not in KF:
        return 0.0
    return (KF[set_id].get("baseTime", 1.0) - 1.0) * judgment_level(dfn) / 100.0


DETECTION_DELAY = 0.40 - 0.003 * 50  # 0.25s


def injury_degree(g, part):
    p = g.injury[part]
    return 0 if p == 0 else 1 if p <= 2 else 2 if p <= 6 else 3


def total_time_mult(g):
    _, sm, _ = stamina_stage(g)
    pm = 1.2 if 0 < g.posture < 50 else 1.0
    return min(2.0, 1.0 * sm * pm)


def move_speed(g):
    """Movement speed (m/s) for approach / retreat: 1 m per 0.55 s, slowed by
    the state time multiplier and by leg injury."""
    mult = total_time_mult(g) * (1.0, 1.1, 1.3, 1.6)[injury_degree(g, "leg")]
    return (1 / 0.55) / mult


# ---------- geometry ----------
def rot_pt(g, lx, ly):
    return (g.x + g.facing * lx, ly)


def fk_points(g, pose):
    d = math.radians
    hip = (pose["hip"][0], pose["hip"][1])
    knee = (hip[0] + 0.44 * math.sin(d(pose["thigh"])), hip[1] - 0.44 * math.cos(d(pose["thigh"])))
    ankle = (knee[0] + 0.44 * math.sin(d(pose["shin"])), knee[1] - 0.44 * math.cos(d(pose["shin"])))
    sho = (hip[0] + 0.52 * math.sin(d(pose["torso"])), hip[1] + 0.52 * math.cos(d(pose["torso"])))
    head = (sho[0] + 0.17 * math.sin(d(pose["torso"])), sho[1] + 0.17 * math.cos(d(pose["torso"])))
    elb = (sho[0] + 0.30 * math.sin(d(pose["upperArm"])), sho[1] - 0.30 * math.cos(d(pose["upperArm"])))
    wri = (elb[0] + 0.28 * math.sin(d(pose["forearm"])), elb[1] - 0.28 * math.cos(d(pose["forearm"])))
    grip = (wri[0] + 0.18 * math.cos(d(pose["weaponAngle"])), wri[1] + 0.18 * math.sin(d(pose["weaponAngle"])))
    tip = (grip[0] + g.wlen * math.cos(d(pose["weaponAngle"])), grip[1] + g.wlen * math.sin(d(pose["weaponAngle"])))
    torso_c = ((hip[0] + sho[0]) / 2, (hip[1] + sho[1]) / 2)
    pts = {"hip": hip, "knee": knee, "ankle": ankle, "sho": sho, "head": head,
           "elb": elb, "wri": wri, "grip": grip, "tip": tip, "torsoC": torso_c}
    return {k: rot_pt(g, x, y) for k, (x, y) in pts.items()}


def obb(centre, axis, half_len, half_wid):
    return (centre, axis, half_len, half_wid)


def seg_obb(p1, p2, box):
    (cx, cy), (ax, ay), hl, hw = box
    vx, vy = -ay, ax
    def tr(p):
        dx, dy = p[0] - cx, p[1] - cy
        return (dx * ax + dy * ay, dx * vx + dy * vy)
    a, b = tr(p1), tr(p2)
    # Liang-Barsky against [-hl,hl] x [-hw,hw]
    dx, dy = b[0] - a[0], b[1] - a[1]
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, a[0] + hl), (dx, hl - a[0]), (-dy, a[1] + hw), (dy, hw - a[1])):
        if abs(p) < 1e-12:
            if q < 0:
                return False
        else:
            r = q / p
            if p < 0:
                t0 = max(t0, r)
            else:
                t1 = min(t1, r)
            if t0 > t1:
                return False
    return True


def seg_circle(p1, p2, c, r):
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((c[0] - p1[0]) * dx + (c[1] - p1[1]) * dy) / L2))
    px, py = p1[0] + t * dx - c[0], p1[1] + t * dy - c[1]
    return px * px + py * py <= r * r


def seg_seg(p1, p2, p3, p4):
    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    d1, d2 = cr(p3, p4, p1), cr(p3, p4, p2)
    d3, d4 = cr(p1, p2, p3), cr(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


def regions_of(g, pose):
    P = fk_points(g, pose)
    def axis(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        return (dx / L, dy / L)
    def mid(a, b):
        return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    regs = {}
    regs["torso"] = obb(P["torsoC"], axis(P["hip"], P["sho"]), 0.26, 0.12)
    regs["arm"] = [obb(mid(P["sho"], P["elb"]), axis(P["sho"], P["elb"]), 0.15, 0.045),
                   obb(mid(P["elb"], P["wri"]), axis(P["elb"], P["wri"]), 0.14, 0.04)]
    regs["leg"] = [obb(mid(P["hip"], P["knee"]), axis(P["hip"], P["knee"]), 0.22, 0.07),
                   obb(mid(P["knee"], P["ankle"]), axis(P["knee"], P["ankle"]), 0.22, 0.055)]
    regs["head"] = P["head"]
    regs["weapon"] = (P["grip"], P["tip"])
    if g.shield_half is not None:
        sh = pose.get("shield", STANCE["shield"])
        a = math.radians(sh["angle"])
        centre_local = (pose["hip"][0] + 0.26 * math.sin(math.radians(pose["torso"])) + sh["dx"],
                        pose["hip"][1] + 0.26 * math.cos(math.radians(pose["torso"])) + sh["dy"])
        centre = rot_pt(g, *centre_local)
        axisv = (g.facing * math.sin(a), math.cos(a))
        regs["shield"] = obb(centre, axisv, g.shield_half, 0.04)
    return regs, P


def interp_pose(set_id, tau):
    kfs = KF[set_id]["keyframes"]
    tau = max(0.0, min(1.0, tau))
    for i in range(len(kfs) - 1):
        a, b = kfs[i], kfs[i + 1]
        if a["t"] <= tau <= b["t"]:
            f = 0.0 if b["t"] == a["t"] else (tau - a["t"]) / (b["t"] - a["t"])
            out = {}
            for k in ("torso", "upperArm", "forearm", "thigh", "shin", "weaponAngle"):
                out[k] = a[k] + (b[k] - a[k]) * f
            out["hip"] = [a["hip"][0] + (b["hip"][0] - a["hip"][0]) * f,
                          a["hip"][1] + (b["hip"][1] - a["hip"][1]) * f]
            if "shield" in a:
                out["shield"] = {k: a["shield"][k] + (b["shield"][k] - a["shield"][k]) * f
                                 for k in ("dx", "dy", "angle")}
            return out
    last = dict(kfs[-1])
    return last


# ---------- automatic target-part selection (v3.11) ----------
COMPAT = {"slash": {"head": 2, "torso": 1, "arm": 2, "leg": 2},
          "thrust": {"head": 1, "torso": 2, "arm": 1, "leg": 1}}


def part_boxes(regs, part):
    r = regs[part]
    return r if isinstance(r, list) else [r]


def exposure_of(atk, set_id, part, regs):
    # v3.11 as amended by v3.37: the shield/arm tiers are judged along the
    # attack trajectory, against the opponent's pose at the decision moment.
    # 0 = the swing reaches the shield before the part itself; 1 = it reaches
    # the defender's arm first; 2 = covered by armour only; 3 = exposed.
    # (The arm cannot be "in front of" itself, so target=arm skips the arm
    # tier. For a sica, a shield-first trajectory counts as 1, not 0.)
    dfn = atk.opp
    shield_step = arm_step = part_step = None
    for i in range(241):
        if part_step is not None and i > part_step:
            break
        pose = interp_pose(set_id, i / 240)
        P = fk_points(atk, pose)
        w1, w2 = P["grip"], P["tip"]
        if shield_step is None and "shield" in regs and seg_obb(w1, w2, regs["shield"]):
            shield_step = i
        if part != "arm" and arm_step is None and \
                any(seg_obb(w1, w2, b) for b in regs["arm"]):
            arm_step = i
        if part_step is None:
            if part == "head":
                if seg_circle(w1, w2, regs["head"], 0.11):
                    part_step = i
            elif any(seg_obb(w1, w2, b) for b in part_boxes(regs, part)):
                part_step = i
    cover = None  # (step, tier); on a step tie the shield wins (contact priority)
    if shield_step is not None and (part_step is None or shield_step <= part_step):
        cover = (shield_step, 0)
    if arm_step is not None and (part_step is None or arm_step <= part_step):
        if cover is None or arm_step < cover[0]:
            cover = (arm_step, 1)
    if cover is not None:
        tier = cover[1]
        if tier == 0 and set_id.startswith("sica-"):
            tier = 1
        return tier
    return 2 if dfn.armour.get(part, 0) > 0 else 3


def part_reachable(atk, set_id, part, regs):
    # Gate (v3.11): with the fighters at their current distance, does this set's
    # weapon trajectory reach the part's region, against the opponent's pose at
    # the decision moment? Shield/arm interposition does not count as unreachable.
    for i in range(241):
        pose = interp_pose(set_id, i / 240)
        P = fk_points(atk, pose)
        w1, w2 = P["grip"], P["tip"]
        if part == "head":
            if seg_circle(w1, w2, regs["head"], 0.11):
                return True
        elif any(seg_obb(w1, w2, b) for b in part_boxes(regs, part)):
            return True
    return False


def ref_target_x(g, set_id):
    """Where g's feet would be when standing at the set's refDistance from the
    opponent (v3.44). If that spot is outside the arena, the nearest spot inside
    it (the edge) is used instead."""
    ref = KF[set_id].get("refDistance")
    if ref is None:
        return g.x
    return clamp_arena(g.opp.x - g.facing * ref)


def select_part(g, pattern):
    # v3.44: each part is scored as if g stood at that part's set refDistance,
    # against the opponent's pose at the decision moment.
    dfn = g.opp
    method = pattern.split("-")[1]
    regs, _ = regions_of(dfn, dfn.pose)
    scores = {}
    for part in ("head", "torso", "arm", "leg"):
        sid = f"{pattern}-{part}"
        if sid not in KF:
            scores[part] = None
            continue
        at_ref = types.SimpleNamespace(x=ref_target_x(g, sid), facing=g.facing, wlen=g.wlen, opp=dfn)
        if not part_reachable(at_ref, sid, part, regs):
            scores[part] = None
            continue
        inj = (0, 1, 1, 2)[injury_degree(dfn, part)]
        scores[part] = exposure_of(at_ref, sid, part, regs) * 100 + COMPAT[method][part] * 10 + inj
    best = None
    for part in ("torso", "head", "leg", "arm"):  # fixed tie-break order (v3.44: leg before arm)
        if scores[part] is not None and (best is None or scores[part] > scores[best]):
            best = part
    return best, scores


class Glad:
    def __init__(self, spec):
        self.id = spec["id"]
        self.x = spec["startX"]
        self.facing = spec["facing"]
        self.hp = 150.0
        self.stamina = 100.0
        self.posture = 100.0
        self.injury = {"head": 0, "torso": 0, "arm": 0, "leg": 0}
        eq = spec.get("equipment", {})
        self.armour = {k: eq.get("armour", {}).get(k, ARMOUR[k]) for k in ARMOUR}
        apply_equip(self, eq.get("weapon", "gladius"), eq.get("shield", "scutum"))
        self.action = None
        self.judgment_base = 50
        self.decision_at = judgment_delay(self)
        self.judgment_base = 50
        self.hold = None       # {"set", "label", "until", "start"} while in 構え
        self.switch_for = None  # hold-start time this glad's pending reaction belongs to
        self.evade_for = None   # hold-start time the current/last evade was triggered by
        self.pose_tau = 0.0     # pose progress of the current action (for the deflect judgement)
        self.switch_at = None  # scheduled switch to a defence action
        self.collapsed = False
        self.pose = dict(STANCE)
        self.stats = {"dealt": 0, "hits": 0, "blocks": 0, "blocked": 0, "maxHit": 0, "evades": 0, "deflects": 0}


class Sim:
    # approach_until: the target gap for gladiators that do not attack (rule 3)
    # and for the "no reachable part" fallback. From v3.44 an attacker's spacing
    # follows the set's refDistance, so this has no effect on attackers.
    def __init__(self, defence_policies, time_cap=180.0, atk_sets=None, approach_until=1.4, passive=(),
                 auto=None, armour=None, push_users=None, equip=None):
        self.a = Glad(COND["gladiators"][0])
        self.b = Glad(COND["gladiators"][1])
        self.a.opp, self.b.opp = self.b, self.a
        self.policies = defence_policies  # {id: "block" | "none"}
        self.atk_sets = atk_sets or {}
        self.auto = auto or {}  # {id: set pattern e.g. "gladius-slash-normal"} -> v3.11 auto selection
        self.push_users = push_users or {}  # {id: "push" (push only) | "mix" (push until opp posture < 50)}
        for gid, ov in (armour or {}).items():
            (self.a if gid == "A" else self.b).armour.update(ov)
        for gid, ov in (equip or {}).items():
            g = self.a if gid == "A" else self.b
            apply_equip(g, ov.get("weapon", g.weapon_name),
                        ov.get("shield", g.shield_name) if "shield" in ov else g.shield_name)
        self.approach_until = approach_until
        self.passive = set(passive)
        self.t = 0.0
        self.cap = time_cap
        self.log = []
        self.over = False
        self.summary = {}

    def ev(self, kind, msg):
        self.log.append(f"[{self.t:7.2f}] {kind:<6} {msg}")

    # ---- action lifecycle ----
    def start_action(self, g, kind, label, set_id=None, base_time=None, policy=None, until=None,
                     hold_start=None):
        mult = total_time_mult(g)
        if kind == "attack":
            cost = 7 * g.wweight * g.equip_mult
            bt = KF[set_id].get("baseTime", 1.0) if set_id in KF else (base_time or 1.0)
            dur = bt * mult * (0.85 + 0.15 * g.wweight)
            arm_deg = injury_degree(g, "arm")
            corr = STRENGTH_CORR.get(set_id.split("-")[2], 0) if set_id else 0
            P = g.watk + corr - (0, 5, 15, 30)[arm_deg]
            g.action = {"kind": kind, "set": set_id, "start": self.t, "dur": dur,
                        "resolved": False, "P": P, "label": label, "hold_start": hold_start}
        elif kind == "defence":
            cost = 5 * g.equip_mult
            dur = 0.6 * mult * (1.5 if g.collapsed else 1.0)
            g.action = {"kind": kind, "set": set_id or "defence-scutum-block", "start": self.t,
                        "dur": dur, "label": label, "policy": policy or "block"}
            if (policy or "block") == "deflect":
                g.action["phase"] = "enter"
                g.action["for_hold"] = g.switch_for
        elif kind == "push":
            cost = 8 * g.equip_mult
            g.action = {"kind": kind, "set": "common-shield-push", "start": self.t,
                        "dur": 0.8 * mult, "label": label, "resolved": False}
        elif kind == "postureRecovery":
            cost = 3 * g.equip_mult
            g.action = {"kind": kind, "set": "common-posture-recovery", "start": self.t,
                        "dur": 1.2 * mult, "label": label}
        elif kind in ("approach", "retreat"):
            # movement toward / away from the opponent until the target gap
            # (stamina is charged per metre travelled, in step())
            cost = 0.0
            g.action = {"kind": kind,
                        "set": "common-advance-1m" if kind == "approach" else "common-retreat-1m",
                        "start": self.t, "dur": float("inf"), "label": label, "travelled": 0.0,
                        "until": until if until is not None else self.approach_until}
        elif kind == "wait":
            cost = 0.0
            g.action = {"kind": kind, "set": None, "start": self.t, "dur": float("inf"), "label": label}
        if kind in ("attack", "push"):
            o = g.opp
            already = kind == "attack" and hold_start is not None and o.switch_for == hold_start
            if not already and self.policies[o.id] in ("block", "evade", "deflect") and o.switch_at is None:
                o.switch_at = self.t + DETECTION_DELAY + judgment_delay(o) \
                    + (read_shift(o, set_id) if kind == "attack" else 0.0)
                if kind == "attack":
                    o.switch_for = hold_start
        g.stamina = max(0.0, g.stamina - cost)
        self.ev("行動開始", f"{g.id}: {label}")

    def interruptible(self, g):
        if g.action is None:
            return True
        a = g.action
        if a["kind"] == "defence":
            return False
        if a["kind"] in ("approach", "retreat", "wait", "postureRecovery"):
            return True
        if a["kind"] == "attack":
            prog = (self.t - a["start"]) / a["dur"]
            if prog < 0.35:
                return True
            if prog < 0.80:
                return True  # normal attack: interruptible in execution phase
            return False
        return True

    def _enter_hold(self, g, set_id, label):
        """Enter the hold (v3.35) and start the opponent's reaction clock
        (v3.40 plan A): detection+judgment runs from the hold's start."""
        g.hold = {"set": set_id, "label": label, "until": self.t + hold_time(g), "start": self.t}
        self.ev("行動開始", f"{g.id}: 構え（{label}）")
        o = g.opp
        if self.policies[o.id] in ("block", "evade", "deflect") and o.switch_at is None:
            o.switch_at = self.t + DETECTION_DELAY + judgment_delay(o) + read_shift(o, set_id)
            o.switch_for = self.t

    def _move_or_hold(self, g, sid, label, prefix):
        """v3.44: attack from the set's refDistance. Outside +-REF_TOLERANCE,
        move there first (approach if farther, retreat if closer); the plan is
        re-evaluated when the move ends. Backed against the arena edge (no room
        to retreat), the attack is held from the current gap."""
        dist = abs(g.opp.x - g.x)
        refd = KF[sid].get("refDistance")
        if refd is not None and abs(dist - refd) > REF_TOLERANCE:
            if dist > refd:
                self.start_action(g, "approach", f"{prefix}: 間合いまで接近する", until=refd)
                return
            if g.x * g.facing > -ARENA_HALF + GAP_EPS:  # room to back off
                self.start_action(g, "retreat", f"{prefix}: 間合いまで距離を取る", until=refd)
                return
        self._enter_hold(g, sid, label)

    def decide(self, g):
        o = g.opp
        dist = abs(o.x - g.x)
        if g.posture < 50:
            self.start_action(g, "postureRecovery", "ルール1: 体勢を立て直す")
        elif stamina_stage(g)[0] == "枯渇":
            self.start_action(g, "wait", "ルール2: 待機する")
        elif g.id in self.passive:
            # rule 3 (approach when far) now applies only to gladiators that do
            # not attack; attackers' spacing follows the reference distance (v3.44)
            if dist >= 1.5:
                self.start_action(g, "approach", "ルール3: 接近する")
            else:
                self.start_action(g, "wait", "ダミー: 待機する（攻撃しない）")
        elif not g.collapsed:
            part_jp = {"torso": "胴体", "leg": "脚", "head": "頭部", "arm": "腕"}
            push_mode = self.push_users.get(g.id)
            if push_mode and (push_mode == "push" or o.posture >= 50):
                if dist <= 1.1:
                    self.start_action(g, "push", "盾押し: 押し込み")
                else:
                    self.start_action(g, "approach", "盾押し: 押し込む位置まで接近する", until=1.05)
            elif g.id in self.auto:
                pattern = self.auto[g.id]
                part, scores = select_part(g, pattern)
                detail = " ".join(f"{part_jp[p]}={'届かない' if scores[p] is None else scores[p]}"
                                   for p in ("head", "torso", "arm", "leg"))
                if part is None:
                    self.ev("選択", f"{g.id}: 自動選択 [{detail}] → 届く部位なし、接近する")
                    self.start_action(g, "approach", "自動選択: 届く位置まで接近する")
                else:
                    method_jp = "斬る" if "-slash-" in pattern else "突く"
                    label = f"デフォルト: 通常攻撃（{method_jp}・{part_jp[part]}）"
                    self.ev("選択", f"{g.id}: 自動選択 [{detail}] → {part_jp[part]}")
                    self._move_or_hold(g, f"{pattern}-{part}", label, "自動選択")
            else:
                sid = self.atk_sets.get(g.id, "gladius-slash-normal-torso")
                label = f"デフォルト: 通常攻撃（斬る・{part_jp[sid.rsplit('-', 1)[1]]}）"
                self._move_or_hold(g, sid, label, "固定")
        else:
            self.start_action(g, "wait", "体勢崩れ: 待機する")

    # ---- per-step updates ----
    def update_pose(self, g):
        a = g.action
        if a is None or a["kind"] == "wait":
            g.pose = dict(STANCE)
            return
        if a["kind"] in ("approach", "retreat"):
            tau = (a["travelled"] % 1.0)
            g.pose = interp_pose(a["set"], tau)
            return
        tau = (self.t - a["start"]) / a["dur"] if a["dur"] != float("inf") else 0.0
        if a["kind"] == "defence" and a.get("phase"):
            if a["phase"] == "hold":
                tau = 0.5
            elif a["phase"] == "exit":
                tau = 0.5 + (self.t - a["exit_start"]) / a["dur"]
        g.pose_tau = tau
        g.pose = interp_pose(a["set"], tau)
        if a["kind"] == "attack" and a.get("wa_offset"):
            g.pose["weaponAngle"] += a["wa_offset"]

    def contact_scan(self, atk):
        a = atk.action
        if not a or a["kind"] != "attack" or a["resolved"]:
            return
        if self.t <= a["start"]:
            # R1 (v3.40): contact checks begin after the weapon has started
            # moving; a contact that already exists in the start pose does
            # not resolve the attack.
            return
        dfn = atk.opp
        regs, P = regions_of(dfn, dfn.pose)
        w1, w2 = fk_points(atk, atk.pose)["grip"], fk_points(atk, atk.pose)["tip"]
        hit = None
        weapon_touch = (dfn.action and dfn.action["kind"] == "defence"
                        and seg_seg(w1, w2, regs["weapon"][0], regs["weapon"][1]))
        if "shield" in regs and not a.get("shield_down") and seg_obb(w1, w2, regs["shield"]):
            hit = "shield"
        elif weapon_touch:
            # R1b (v3.40): a weapon parry counts only once the attack is
            # executing (progress >= the execution-start marker, 0.35).
            # Blade contact before that is a bind between guard poses: it
            # does not resolve the attack (and shields the body this step).
            if (self.t - a["start"]) / a["dur"] < 0.35:
                return
            hit = "weapon"
        elif any(seg_obb(w1, w2, r) for r in regs["arm"]):
            hit = "arm"
        elif any(seg_obb(w1, w2, r) for r in regs["leg"]):
            hit = "leg"
        elif seg_obb(w1, w2, regs["torso"]):
            hit = "torso"
        elif seg_circle(w1, w2, regs["head"], 0.11):
            hit = "head"
        if hit is None:
            return
        # Deflect judgement (v3.41) at the first shield/weapon contact.
        if hit in ("shield", "weapon") and dfn.action and dfn.action["kind"] == "defence" \
                and dfn.action.get("policy") == "deflect" and not a.get("deflect_judged"):
            a["deflect_judged"] = True
            method = KF[a["set"]]["method"] if a.get("set") in KF else None
            if method == "slash":
                tech = getattr(dfn, "technique_base", 50)
                tau = getattr(dfn, "pose_tau", 0.0)
                set_at = 0.5 - (tech - 50) * 0.001
                success = set_at <= tau <= 0.85
                bad = tau < set_at / 2
                if success:
                    a["slide"] = True  # the rotation branch below runs
                elif bad and hit == "shield" and KF[a["set"]]["strength"] == "strong":
                    a["shield_down"] = True
                    a["deflected"] = True
                    a["P"] -= 20
                    dfn.stats["deflects"] += 1
                    self.ev("接触", f"{atk.id} の攻撃 → {dfn.id} の盾が弾かれた（受け流しが大きく外れた、威力P={a['P']:.0f}で継続）")
                    return
                else:
                    a["deflect_failed"] = True
                    self.ev("接触", f"{atk.id} の攻撃 → {dfn.id} の受け流しが合わない（盾が弾かれる）")
            # thrusts, and failed judgements, fall through to block resolution
        if hit in ("shield", "weapon") and dfn.action and dfn.action["kind"] == "defence" \
                and dfn.action.get("policy") == "deflect" and not a.get("deflected") and a.get("slide"):
            # Deflect (v3.13, judged per v3.42): rotate the attacker's weapon away from the body, P -20, keep scanning
            Pd = fk_points(dfn, dfn.pose)
            centre = ((Pd["hip"][0] + Pd["sho"][0]) / 2, (Pd["hip"][1] + Pd["sho"][1]) / 2)
            Pa = fk_points(atk, atk.pose)
            w1, tip = Pa["grip"], Pa["tip"]
            def rot(px, py, deg):
                r = math.radians(deg); c, s = math.cos(r), math.sin(r)
                return (w1[0] + (px - w1[0]) * c - (py - w1[1]) * s,
                        w1[1] + (px - w1[0]) * s + (py - w1[1]) * c)
            tp, tm = rot(tip[0], tip[1], 30), rot(tip[0], tip[1], -30)
            world_rot = 30 if (tp[0] - centre[0]) ** 2 + (tp[1] - centre[1]) ** 2 >= \
                (tm[0] - centre[0]) ** 2 + (tm[1] - centre[1]) ** 2 else -30
            a["wa_offset"] = world_rot * atk.facing
            a["deflected"] = True
            a["P"] -= 20
            dfn.stats["deflects"] += 1
            self.ev("接触", f"{atk.id} の攻撃 → {dfn.id} が受け流した（武器を{world_rot:+d}度そらし、威力P={a['P']:.0f}に低下）")
            return
        a["resolved"] = True
        P_atk = a["P"]
        if hit in ("shield", "weapon") and dfn.action and dfn.action["kind"] == "defence" \
                and dfn.action.get("policy") == "evade":
            self.ev("接触", f"{atk.id} の攻撃 → {dfn.id} の盾に接触（回避中につき防御処理なし）")
        elif hit in ("shield", "weapon"):
            if a.get("slide"):
                # after a successful deflect the blade slides off: no impact,
                # and the attack keeps scanning for a possible body contact
                if not a.get("slide_logged"):
                    a["slide_logged"] = True
                    self.ev("接触", f"{atk.id} の攻撃 → {dfn.id} の{'盾' if hit == 'shield' else '武器'}を滑り落ちた（衝撃なし）")
                a["resolved"] = False
                return
            defence_val = dfn.shield_def if hit == "shield" else dfn.wblock
            E = P_atk - defence_val
            st = stage_of(E)
            eff = st
            if a.get("deflect_failed"):
                _order = ["軽微", "通常", "重傷", "致命傷"]
                eff = _order[min(3, _order.index(st) + 1)]
            dfn.posture = max(0.0, dfn.posture - BLOCK_POSTURE[eff])
            dfn.stamina = max(0.0, dfn.stamina - BLOCK_STAMINA[eff])
            if eff == "軽微":
                atk.posture = max(0.0, atk.posture - 10)
            dfn.stats["blocks"] += 1
            atk.stats["blocked"] += 1
            self.ev("接触", f"{atk.id} の攻撃 → {dfn.id} の{'盾' if hit == 'shield' else '武器'}に接触")
            self.ev("結果", f"受け止め: 衝撃E={E:.0f} → {st}。{dfn.id} 体勢-{BLOCK_POSTURE[eff]} スタミナ-{BLOCK_STAMINA[eff]}"
                            + (f"（受け流し失敗で{eff}に悪化）" if eff != st else "")
                            + ("、攻撃側に反動 体勢-10" if eff == "軽微" else ""))
        else:
            E = P_atk - dfn.armour[hit] + PART_MOD[hit]
            st = stage_of(E)
            old_deg = injury_degree(dfn, hit)
            dfn.hp -= HP_LOSS[st]
            dfn.injury[hit] += INJ_PTS[st]
            dfn.posture = max(0.0, dfn.posture - POSTURE_LOSS[st])
            atk.stats["dealt"] += HP_LOSS[st]
            atk.stats["hits"] += 1
            atk.stats["maxHit"] = max(atk.stats["maxHit"], HP_LOSS[st])
            self.ev("接触", f"{atk.id} の攻撃 → {dfn.id} の{ {'head':'頭部','torso':'胴体','arm':'腕','leg':'脚'}[hit] }に命中")
            self.ev("結果", f"E={E:.0f} → {st}。{dfn.id} 体力-{HP_LOSS[st]}（残{max(0,dfn.hp):.0f}） "
                            f"負傷点+{INJ_PTS[st]}（計{dfn.injury[hit]}） 体勢-{POSTURE_LOSS[st]}")
            if injury_degree(dfn, hit) != old_deg:
                self.ev("状態変化", f"{dfn.id} の{hit}負傷が度合い{injury_degree(dfn, hit)}に悪化")

    def push_scan(self, g):
        a = g.action
        if not a or a["kind"] != "push" or a["resolved"]:
            return
        dfn = g.opp
        regs_a, _ = regions_of(g, g.pose)
        if "shield" not in regs_a:
            return
        (cx, cy), (ax, ay), hl, _hw = regs_a["shield"]
        s1 = (cx - ax * hl, cy - ay * hl)
        s2 = (cx + ax * hl, cy + ay * hl)
        regs_d, _ = regions_of(dfn, dfn.pose)
        contact = (("shield" in regs_d and seg_obb(s1, s2, regs_d["shield"]))
                   or any(seg_obb(s1, s2, b) for b in part_boxes(regs_d, "arm"))
                   or any(seg_obb(s1, s2, b) for b in part_boxes(regs_d, "leg"))
                   or seg_obb(s1, s2, regs_d["torso"])
                   or seg_circle(s1, s2, regs_d["head"], 0.11 + 0.04))
        if not contact:
            return
        a["resolved"] = True
        if dfn.action and dfn.action["kind"] == "defence" and dfn.action.get("policy") == "evade":
            self.ev("接触", f"{g.id} の押し込み → {dfn.id} は回避中（押しは空振り）")
            return
        blocking = dfn.action and dfn.action["kind"] == "defence" and dfn.action.get("policy") == "block"
        loss = 15 if blocking else 25
        dfn.posture = max(0.0, dfn.posture - loss)
        old_x = dfn.x
        dfn.x = clamp_arena(dfn.x - dfn.facing * 0.5)
        self.ev("接触", f"{g.id} の盾が {dfn.id} に接触（押し込み）")
        self.ev("結果", f"押し込み成立: {dfn.id} 体勢-{loss}（{'受け止め中' if blocking else '通常'}）、"
                        f"{abs(dfn.x - old_x):.1f}m後退")

    def step(self):
        t = self.t
        for g in (self.a, self.b):
            # hold expiry: the planned attack starts and is then committed
            if g.hold is not None and t >= g.hold["until"]:
                h = g.hold
                g.hold = None
                g.switch_at = None
                self.start_action(g, "attack", h["label"], set_id=h["set"], base_time=1.0,
                                  hold_start=h.get("start"))
            # scheduled switch to a defence action (only from uncommitted states)
            if g.switch_at is not None and t >= g.switch_at:
                g.switch_at = None
                if g.action and g.action["kind"] in ("attack", "defence"):
                    self.ev("状態変化", f"{g.id}: 防御に切り替えられず（行動開始済み）")
                else:
                    prev = "構え" if g.hold else (g.action["kind"] if g.action else "待機中")
                    g.hold = None
                    g.action = None
                    pol = self.policies[g.id]
                    if pol == "evade":
                        g.stats["evades"] += 1
                        g.evade_for = g.switch_for
                    dset = {"scutum": "defence-scutum-", "parmula": "defence-parmula-",
                            "small": "defence-smallshield-", None: "defence-weapononly-"}[g.shield_name] + pol
                    dlabel = {"evade": "回避する", "deflect": "受け流す"}.get(pol, "受け止める")
                    self.start_action(g, "defence", f"防御に切替: {dlabel}（{prev}から）",
                                      set_id=dset, policy=pol)
            # held deflect pose (v3.43): enter -> hold -> exit -> complete
            a = g.action
            if a and a["kind"] == "defence" and a.get("phase"):
                opp_a = g.opp.action
                trigger_live = a.get("for_hold") is not None and (
                    (g.opp.hold is not None and g.opp.hold.get("start") == a["for_hold"])
                    or (opp_a is not None and opp_a["kind"] == "attack"
                        and opp_a.get("hold_start") == a["for_hold"]
                        and not opp_a.get("resolved") and not opp_a.get("deflected")))
                if a["phase"] == "enter" and t >= a["start"] + a["dur"] / 2:
                    a["phase"] = "hold" if trigger_live else "exit"
                    if a["phase"] == "exit":
                        a["exit_start"] = t
                elif a["phase"] == "hold" and (not trigger_live or t - a["start"] > a["dur"] + 1.5):
                    a["phase"] = "exit"
                    a["exit_start"] = t
                elif a["phase"] == "exit" and t >= a["exit_start"] + a["dur"] / 2:
                    g.action = None
                    g.decision_at = t + judgment_delay(g)
            # action completion
            a = g.action
            if a and not a.get("phase") and a["dur"] != float("inf") and t >= a["start"] + a["dur"]:
                if a["kind"] == "postureRecovery":
                    g.posture = min(100.0, g.posture + 30)
                    self.ev("結果", f"{g.id}: 体勢を立て直した（体勢{ g.posture:.0f}）")
                if a["kind"] == "attack" and not a["resolved"]:
                    strength = KF[a["set"]]["strength"] if a.get("set") in KF else "normal"
                    whiff_cost = 20 if strength == "strong" else 10
                    if a.get("deflected"):
                        g.posture = max(0.0, g.posture - whiff_cost)
                        self.ev("結果", f"{g.id}: 受け流されて空振り（体勢-{whiff_cost}）")
                    elif g.opp.evade_for is not None and g.opp.evade_for == a.get("hold_start"):
                        g.posture = max(0.0, g.posture - whiff_cost)
                        self.ev("結果", f"{g.id}: 回避されて空振り（体勢-{whiff_cost}）")
                    else:
                        self.ev("結果", f"{g.id}: 攻撃は空振り（接触なし）")
                if a["kind"] == "push" and not a["resolved"]:
                    self.ev("結果", f"{g.id}: 押し込みは空振り（接触なし）")
                g.action = None
                g.decision_at = t + judgment_delay(g)
            # continuous action ends
            if g.action and g.action["kind"] == "approach" and abs(g.opp.x - g.x) <= g.action.get("until", self.approach_until) + GAP_EPS:
                g.action = None
                g.decision_at = t + judgment_delay(g)
            if g.action and g.action["kind"] == "retreat" and (
                    abs(g.opp.x - g.x) >= g.action["until"] - GAP_EPS
                    or g.x * g.facing <= -ARENA_HALF):
                # reached the target gap, or backed against the arena edge
                g.action = None
                g.decision_at = t + judgment_delay(g)
            if g.action and g.action["kind"] == "wait" and stamina_stage(g)[0] != "枯渇":
                g.action = None
                g.decision_at = t + judgment_delay(g)
            # decision
            if g.action is None and g.hold is None and t >= g.decision_at and not self.over:
                self.decide(g)
            # movement
            if g.action and g.action["kind"] in ("approach", "retreat"):
                a = g.action
                gap = abs(g.opp.x - g.x)
                # v3.44: stop exactly at the target gap (no overshoot)
                if a["kind"] == "approach":
                    step = min(move_speed(g) * DT, max(0.0, gap - 0.35), max(0.0, gap - a["until"]))
                    new_x = g.x + g.facing * step
                else:
                    want = min(move_speed(g) * DT, max(0.0, a["until"] - gap))
                    new_x = clamp_arena(g.x - g.facing * want)
                    step = abs(new_x - g.x)
                g.x = new_x
                a["travelled"] += step
                g.stamina = max(0.0, g.stamina - step * 2 * g.equip_mult)
            # recovery while not acting
            if g.action is None:
                g.stamina = min(100.0, g.stamina + 5 * DT)
                g.posture = min(100.0, g.posture + 10 * DT)
            if g.action and g.action["kind"] == "wait":
                rec = 10 * (1.0, 0.8, 0.6, 0.4)[injury_degree(g, "torso")]
                g.stamina = min(100.0, g.stamina + rec * DT)
                g.posture = min(100.0, g.posture + 10 * DT)
            # posture collapse transitions
            if g.posture <= 0 and not g.collapsed:
                g.collapsed = True
                self.ev("状態変化", f"{g.id}: 体勢崩れ（体勢0）")
            if g.collapsed and g.posture >= 50:
                g.collapsed = False
                self.ev("状態変化", f"{g.id}: 体勢崩れから回復")
            self.update_pose(g)
        # contacts (both directions)
        self.contact_scan(self.a)
        self.contact_scan(self.b)
        self.push_scan(self.a)
        self.push_scan(self.b)
        # stamina stage changes
        for g in (self.a, self.b):
            st = stamina_stage(g)[0]
            if getattr(g, "_last_stage", st) != st:
                self.ev("状態変化", f"{g.id}: スタミナ段階が「{st}」に変化（残{g.stamina:.0f}）")
            g._last_stage = st
        # end conditions. Both down in the same step is a draw (v3.45): the
        # step is the smallest unit of time, so neither fell first.
        down = [g for g in (self.a, self.b) if g.hp <= 0]
        if len(down) == 2 and not self.over:
            self.over = True
            self.ev("終了", f"両者の体力が0。相打ち（引き分け）（経過 {t:.2f}秒）")
            self.summary = {"winner": None, "time": round(t, 2), "reason": "相打ち"}
        elif len(down) == 1 and not self.over:
            g = down[0]
            self.over = True
            winner = g.opp
            self.ev("終了", f"{g.id} の体力が0。勝者 {winner.id}（経過 {t:.2f}秒）")
            self.summary = {"winner": winner.id, "time": round(t, 2), "reason": "体力0"}
        if t >= self.cap and not self.over:
            self.over = True
            self.ev("終了", f"時間上限 {self.cap:.0f}秒に到達。決着せず（確認用の打ち切り）")
            self.summary = {"winner": None, "time": round(t, 2), "reason": "時間上限"}

    def run(self):
        while not self.over:
            self.step()
            self.t += DT
        return self.log, self.summary


def run_battle(name, policies, cap=180.0, atk_sets=None, approach_until=1.4, passive=(), judgment=None,
               auto=None, armour=None, push_users=None, equip=None):
    sim = Sim(policies, time_cap=cap, atk_sets=atk_sets, approach_until=approach_until, passive=passive,
              auto=auto, armour=armour, push_users=push_users, equip=equip)
    for gid, base in (judgment or {}).items():
        (sim.a if gid == "A" else sim.b).judgment_base = base
    log, summary = sim.run()
    a, b = sim.a, sim.b
    lines = [f"=== {name} ===",
             f"結果: {summary}",
             f"A: 体力{max(0,a.hp):.0f} スタミナ{a.stamina:.0f} 体勢{a.posture:.0f} 与ダメージ{a.stats['dealt']} 命中{a.stats['hits']} 防いだ回数{a.stats['blocks']} 回避{a.stats['evades']} 受け流し{a.stats['deflects']}",
             f"B: 体力{max(0,b.hp):.0f} スタミナ{b.stamina:.0f} 体勢{b.posture:.0f} 与ダメージ{b.stats['dealt']} 命中{b.stats['hits']} 防いだ回数{b.stats['blocks']} 回避{b.stats['evades']} 受け流し{b.stats['deflects']}",
             ""]
    return "\n".join(lines), log, summary


if __name__ == "__main__":
    out = []
    log1_text, log1, s1 = run_battle("戦闘1: 両者とも受け止める方針（確認条件そのまま）", {"A": "block", "B": "block"})
    out.append(log1_text)
    out.append("\n".join(log1))
    # determinism re-run
    _, log1b, _ = run_battle("再実行", {"A": "block", "B": "block"})
    det = "一致" if log1 == log1b else "不一致"
    out.append(f"\n決定論チェック（戦闘1を再実行してログ比較）: {det}")
    log2_text, log2, s2 = run_battle("戦闘2: Bのみ防御方針なし（ダメージ経路と決着の確認用）", {"A": "block", "B": "none"})
    out.append("\n" + log2_text)
    out.append("\n".join(log2))
    log3_text, log3, s3 = run_battle("戦闘3: Aは脚狙い（作り直し後の脚セット）、Bは受け止める方針",
                                     {"A": "block", "B": "block"},
                                     atk_sets={"A": "gladius-slash-normal-leg"})
    out.append("\n" + log3_text)
    out.append("\n".join(log3))
    # 戦闘4（接近距離0.9m）は v3.44 で廃止：攻撃は基準間合いから行うため、近距離の攻撃は起きない
    log5_text, log5, s5 = run_battle("戦闘5: Aは脚狙い、Bは防御方針なし（決着までの確認用）",
                                     {"A": "block", "B": "none"}, cap=300.0,
                                     atk_sets={"A": "gladius-slash-normal-leg"})
    out.append("\n" + log5_text)
    out.append("\n".join(log5))
    log7_text, log7, s7 = run_battle("戦闘7: 両者とも回避方針（鏡合わせで攻撃が通るかの確認用）",
                                     {"A": "evade", "B": "evade"})
    out.append("\n" + log7_text)
    out.append("\n".join(log7))
    log8_text, log8, s8 = run_battle("戦闘8: Aは回避方針で攻撃しない、Bが攻撃（回避の効き目の確認用）",
                                     {"A": "evade", "B": "none"}, cap=120.0, passive=("A",))
    out.append("\n" + log8_text)
    out.append("\n".join(log8))
    log9_text, log9, s9 = run_battle("戦闘9: Aは判断が高い（構えが長く脚狙い）、Bは判断が低い（構えが短い）",
                                     {"A": "block", "B": "none"}, cap=180.0,
                                     atk_sets={"A": "gladius-slash-normal-leg"},
                                     judgment={"A": 80, "B": 20})
    out.append("\n" + log9_text)
    out.append("\n".join(log9))
    log10_text, log10, s10 = run_battle("戦闘10: Aは受け流し方針で攻撃しない、Bが攻撃（受け流しの確認用）",
                                        {"A": "deflect", "B": "none"}, cap=120.0, passive=("A",))
    out.append("\n" + log10_text)
    out.append("\n".join(log10))
    log6_text, log6, s6 = run_battle("戦闘6: Bは攻撃しないダミー、Aは脚狙い（身体命中・負傷蓄積・決着の確認用）",
                                     {"A": "block", "B": "none"}, cap=300.0,
                                     atk_sets={"A": "gladius-slash-normal-leg"}, approach_until=1.45,
                                     passive=("B",))
    out.append("\n" + log6_text)
    out.append("\n".join(log6))
    text = "\n".join(out)
    (BASE / "sim-run-2026-11-15.txt").write_text(text, encoding="utf-8")
    print(log1_text)
    print("決定論チェック:", det)
    print(log2_text)
    print("saved: sim-run-2026-11-15.txt")
