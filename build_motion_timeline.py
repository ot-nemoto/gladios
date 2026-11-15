# Builds motion-timeline.html (fragment) from keyframes-full.json + contact-times.json.
import json, pathlib
OUT = pathlib.Path(__file__).parent
D = json.loads((OUT / "keyframes-full.json").read_text(encoding="utf-8"))
SETS = D["sets"]
CT = json.loads((OUT / "contact-times.json").read_text(encoding="utf-8"))
AXIS = 2.05
HOLD = 0.50
WPN = {"gladius": ("グラディウス", "#2e5da8"), "sica": ("スィカ", "#2e8b6e"),
       "pugio": ("プギオ", "#c96a1e"), "trident": ("トライデント", "#7a4fa3"),
       "hasta": ("ハスタ", "#b03a3a")}
METHOD = {"slash": "斬る", "thrust": "突く"}
STRENGTH = {"normal": "通常", "strong": "強", "feint": "牽制"}
PART = {"torso": "胴", "head": "頭", "arm": "腕", "leg": "脚"}
SEG_SLASH = ["振りかぶり", "斬り", "振り抜き", "戻す"]
SEG_THRUST = ["引き", "突き", "伸ばし", "戻す"]

def shade(hexcol, f):
    r, g, b = (int(hexcol[i:i+2], 16) for i in (1, 3, 5))
    r = int(r + (255 - r) * (1 - f)); g = int(g + (255 - g) * (1 - f)); b = int(b + (255 - b) * (1 - f))
    return f"#{r:02x}{g:02x}{b:02x}"

def seg_html(name, dur, color, dark_text=False):
    w = dur / AXIS * 100
    tc = "#333" if dark_text else "#fff"
    return (f'<div class="seg" style="width:{w:.2f}%;background:{color};color:{tc}">'
            f'<span class="segname">{name}</span><span class="segms">{round(dur*1000)}ms</span></div>')

def attack_row(s):
    base = WPN[s["weapon"]][1]
    label = f'{WPN[s["weapon"]][0]} {METHOD[s["method"]]}・{STRENGTH[s["strength"]]}・{PART[s["part"]]}'
    total = HOLD + s["baseTime"]
    sub = f'合計{total:.2f}秒（構え0.50＋動作{s["baseTime"]:.2f}）'
    segs = [seg_html("構え（待つ）", HOLD, shade(base, 0.30), dark_text=True)]
    names = SEG_SLASH if s["method"] == "slash" else SEG_THRUST
    ts = [k["t"] for k in s["keyframes"]]
    shades = [0.55, 1.0, 0.75, 0.55]
    for i in range(4):
        dur = (ts[i+1] - ts[i]) * s["baseTime"]
        segs.append(seg_html(names[i], dur, shade(base, shades[i]), dark_text=shades[i] <= 0.55))
    markers = ""
    for x, cls in ((0.40, "mkA"), (0.90, "mkOld")):
        markers += f'<div class="{cls}" style="left:{x/AXIS*100:.2f}%"></div>'
    if s["strength"] == "normal" and s["id"] in CT:
        c = CT[s["id"]]
        if c["contactTau"] is not None:
            cx = HOLD + c["contactTau"]
            what = c["contactWhat"] or ""
            target = "盾" if "盾" in what else ("脚" if "脚" in what else ("腕" if "腕" in what else "武器"))
            hit = "命中" if target in ("脚", "腕") else "接触"
            markers += (f'<div class="mkC" style="left:{cx/AXIS*100:.2f}%"></div>'
                        f'<div class="mkClabel" style="left:{cx/AXIS*100:.2f}%">{hit}{cx:.2f}秒・{target}</div>')
            sub += f'／基準間合い{c["ref"]:.2f}m'
    return (f'<div class="row"><div class="lab"><div class="labname">{label}</div>'
            f'<div class="labsub">{sub}</div></div><div class="track">{"".join(segs)}{markers}</div></div>')

DEFNAME = {"scutum": "スクートゥム", "parmula": "パルムラ", "smallshield": "小盾", "weapononly": "武器のみ"}
DEFPOL = {"block": ("受け止める", ["盾・武器を出す", "受け止め"]),
          "deflect": ("受け流す", ["盾を合わせる", "受け流し"]),
          "evade": ("回避する", ["身を引く", "かわす"])}
def defence_row(s):
    shield = s["id"].split("-")[1]; pol = s["id"].split("-")[2]
    label = f'防御 {DEFNAME[shield]}・{DEFPOL[pol][0]}'
    sub = f'合計{s["baseTime"]:.2f}秒'
    base = "#5a6b7d"
    ts = [k["t"] for k in s["keyframes"]]
    segs = []
    for i in range(2):
        dur = (ts[i+1] - ts[i]) * s["baseTime"]
        segs.append(seg_html(DEFPOL[pol][1][i], dur, shade(base, [0.65, 1.0][i]), dark_text=i == 0))
    return (f'<div class="row"><div class="lab"><div class="labname">{label}</div>'
            f'<div class="labsub">{sub}</div></div><div class="track">{"".join(segs)}</div></div>')

COMMON = {"common-advance-1m": ("接近（1m）", ["踏み出し", "接近", "止まる"], None),
          "common-retreat-1m": ("距離を取る（1m）", ["引き足", "後退", "止まる"], None),
          "common-posture-recovery": ("体勢を立て直す", ["沈み込む", "立ち直る"], None),
          "common-shield-push": ("盾の押し込み", ["構える", "踏み込む", "押し込み", "戻す"], 0.8)}
def common_row(s):
    name, names, bt = COMMON[s["id"]]
    base_time = bt or s["baseTime"]
    label = f'共通 {name}'
    sub = f'合計{base_time:.2f}秒'
    base = "#6d6d6d"
    ts = [k["t"] for k in s["keyframes"]]
    segs = []
    n = len(ts) - 1
    for i in range(n):
        dur = (ts[i+1] - ts[i]) * base_time
        f = 1.0 if i == n - 2 else 0.6
        segs.append(seg_html(names[i], dur, shade(base, f), dark_text=f <= 0.6))
    return (f'<div class="row"><div class="lab"><div class="labname">{label}</div>'
            f'<div class="labsub">{sub}</div></div><div class="track">{"".join(segs)}</div></div>')

html = ["""<style>
*{box-sizing:border-box}
.wrap{font-family:inherit;color:var(--hatch-widget-text);font-size:13px;line-height:1.45}
.note{color:var(--hatch-widget-muted);font-size:12px;margin:2px 0 10px}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--hatch-widget-muted);margin-bottom:8px}
.legend b{font-weight:600;color:var(--hatch-widget-text)}
.axis{position:relative;height:16px;margin-left:176px;border-bottom:1px solid var(--hatch-widget-border)}
.axis span{position:absolute;transform:translateX(-50%);font-size:11px;color:var(--hatch-widget-muted)}
.group{margin:14px 0 4px;font-weight:700;font-size:13px}
.row{display:flex;align-items:flex-start;margin:7px 0}
.lab{width:168px;flex:none;padding-right:8px}
.labname{font-weight:600;font-size:12.5px}
.labsub{font-size:11px;color:var(--hatch-widget-muted)}
.track{position:relative;flex:1;display:flex;height:34px;background:repeating-linear-gradient(to right,transparent 0,transparent calc(12.195% - 1px),var(--hatch-widget-border) calc(12.195% - 1px),var(--hatch-widget-border) 12.195%)}
.seg{position:relative;border-radius:5px;margin-right:2px;height:34px;overflow:visible}
.segname{position:absolute;top:3px;left:0;right:0;text-align:center;font-size:12px;white-space:nowrap}
.segms{position:absolute;top:19px;left:0;right:0;text-align:center;font-size:10.5px;opacity:.85;white-space:nowrap}
.mkA{position:absolute;top:-3px;bottom:-3px;width:2px;background:#d43d2a;z-index:3}
.mkOld{position:absolute;top:-3px;bottom:-3px;width:0;border-left:2px dashed #999;z-index:3}
.mkC{position:absolute;top:-6px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #d43d2a;transform:translateX(-5px);z-index:4}
.mkClabel{position:absolute;top:-20px;transform:translateX(-50%);font-size:10.5px;color:#d43d2a;white-space:nowrap;z-index:4;font-weight:600}
</style>
<div class="wrap">
<div class="note">剣闘士キーフレーム88セットのモーション流れ。攻撃は「構え（判断50の上限0.50秒）→動作」の順で表示。接触マーカーは通常攻撃のみ、試作シミュレータの実測（基準間合い・スクートゥム携行姿勢の相手・防御方針なし）。突きは新配分（引き300・突き200・伸ばし200・戻す300ms／通常）で表示。</div>
<div class="legend"><span><b style="color:#d43d2a">―</b> 防御切替の完了：案A（構え開始＋0.40秒）</span><span><b>┄</b> 旧ルール（攻撃開始＋0.40秒）</span><span><b style="color:#d43d2a">▼</b> 最初の接触（実測）</span></div>
<div class="axis"><span style="left:0%">0秒</span><span style="left:24.39%">0.5</span><span style="left:48.78%">1.0</span><span style="left:73.17%">1.5</span><span style="left:97.56%">2.0</span></div>
"""]
for w in ("gladius", "sica", "pugio", "trident", "hasta"):
    for m in ("slash", "thrust"):
        grp = [s for s in SETS if s["kind"] == "attack" and s["weapon"] == w and s["method"] == m]
        if not grp:
            continue
        html.append(f'<div class="group">{WPN[w][0]}（{METHOD[m]}）</div>')
        for st in ("normal", "strong", "feint"):
            for part in ("torso", "head", "arm", "leg"):
                s = next((x for x in grp if x["strength"] == st and x["part"] == part), None)
                if s:
                    html.append(attack_row(s))
html.append('<div class="group">防御（盾・方針別）</div>')
for s in SETS:
    if s["kind"] == "defence":
        html.append(defence_row(s))
html.append('<div class="group">共通</div>')
for s in SETS:
    if s["kind"] == "common":
        html.append(common_row(s))
html.append("</div>")
(OUT / "motion-timeline.html").write_text("\n".join(html), encoding="utf-8")
print("written", (OUT / "motion-timeline.html").stat().st_size, "bytes")
