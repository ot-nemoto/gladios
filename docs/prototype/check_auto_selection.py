#!/usr/bin/env python3
"""Live check of automatic target-part selection (v3.11) in the prototype sim.

Scenarios:
 A  mirror, both auto (slash), both block policy -- selection behaviour + finish
 A2 determinism re-run of A (log must be identical)
 C  B without greaves (leg armour 0 -> leg exposure 3) -- leg must dominate A's picks
 D  mirror, both auto (thrust) -- compatibility table changes the picks
"""
import re
import sim_prototype as S

OUT = []


def picks(log, gid):
    got = []
    for line in log:
        m = re.match(r"\[\s*([\d.]+)\] 選択\s+([AB]): .*→ (\S+)$", line)
        if m and m.group(2) == gid:
            got.append((float(m.group(1)), m.group(3)))
    return got


def dist(p):
    d = {}
    for _, part in p:
        d[part] = d.get(part, 0) + 1
    return d


def report(name, text, log, summary):
    OUT.append(text)
    pa, pb = picks(log, "A"), picks(log, "B")
    OUT.append(f"Aの選択 {len(pa)}回: {dist(pa)}")
    OUT.append(f"Bの選択 {len(pb)}回: {dist(pb)}")
    sel_lines = [l for l in log if "] 選択" in l]
    OUT.append(f"選択ログ全{len(sel_lines)}行")
    OUT.append("")


# A
text_a, log_a, sum_a = S.run_battle(
    "自動選択A: 両者とも自動選択（斬る・通常）、両者とも受け止める方針",
    {"A": "block", "B": "block"}, cap=300.0,
    auto={"A": "gladius-slash-normal", "B": "gladius-slash-normal"})
report("A", text_a, log_a, sum_a)
OUT.append("A: 選択と負傷悪化の時系列（抜粋）")
for l in log_a:
    if "] 選択" in l or "負傷が度合い" in l:
        OUT.append("  " + l)
OUT.append("")

# A2 determinism
_, log_a2, _ = S.run_battle("再実行", {"A": "block", "B": "block"}, cap=300.0,
                            auto={"A": "gladius-slash-normal", "B": "gladius-slash-normal"})
OUT.append(f"決定論チェック（Aを再実行してログ比較）: {'一致' if log_a == log_a2 else '不一致'}")
OUT.append("")

# C
text_c, log_c, sum_c = S.run_battle(
    "自動選択C: Bはすね当てなし（脚が露出=薄さ3）、両者とも自動選択（斬る）・受け止める方針",
    {"A": "block", "B": "block"}, cap=300.0,
    auto={"A": "gladius-slash-normal", "B": "gladius-slash-normal"},
    armour={"B": {"leg": 0}})
report("C", text_c, log_c, sum_c)
for l in log_c:
    if "] 選択" in l and l.split("]")[1].strip().startswith("選択    A") or ("] 選択" in l and " A: " in l):
        OUT.append("  " + l)
        break
OUT.append("")

# D
text_d, log_d, sum_d = S.run_battle(
    "自動選択D: 両者とも自動選択（突く・通常）、両者とも受け止める方針",
    {"A": "block", "B": "block"}, cap=300.0,
    auto={"A": "gladius-thrust-normal", "B": "gladius-thrust-normal"})
report("D", text_d, log_d, sum_d)

text = "\n".join(OUT)
(S.BASE / "check-auto-selection-2026-11-15.txt").write_text(text, encoding="utf-8")
print(text)
