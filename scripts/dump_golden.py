#!/usr/bin/env python3
"""Python 試作（docs/prototype/sim_prototype.py）の出力を、TS 移植の正解データとして書き出す。

実行: python3 scripts/dump_golden.py
出力: tests/golden/sim-prototype.json

シナリオの引数は src/scenarios/check-scenarios.json に置き、TS 側のテストも同じファイルを読む。
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "docs/prototype"))
import sim_prototype as S  # noqa: E402

scenarios = json.loads((ROOT / "src/scenarios/check-scenarios.json").read_text(encoding="utf-8"))


def glad_state(g):
    return {"hp": g.hp, "stamina": g.stamina, "posture": g.posture, "x": g.x,
            "injury": g.injury, "stats": g.stats, "collapsed": g.collapsed}


out = {"python": sys.version.split()[0], "scenarios": []}
for sc in scenarios:
    o = sc["options"]
    sim = S.Sim(o["policies"], time_cap=o.get("cap", 180.0), atk_sets=o.get("atkSets"),
                approach_until=o.get("approachUntil", 1.4), passive=tuple(o.get("passive", ())),
                auto=o.get("auto"), armour=o.get("armour"), push_users=o.get("pushUsers"),
                equip=o.get("equip"))
    for gid, base in (o.get("judgment") or {}).items():
        (sim.a if gid == "A" else sim.b).judgment_base = base
    log, summary = sim.run()
    out["scenarios"].append({"name": sc["name"], "log": log, "summary": summary,
                             "A": glad_state(sim.a), "B": glad_state(sim.b)})
    print(f"{sc['name']}: {summary} ({len(log)} lines)")

dst = ROOT / "tests/golden/sim-prototype.json"
dst.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"saved {dst.relative_to(ROOT)}")
