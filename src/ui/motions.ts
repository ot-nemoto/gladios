/**
 * モーション図鑑：キーフレーム一式ごとに、姿勢・軌道・段階・最初の接触を視覚的に確かめる。
 * 計算は src/sim/motion.ts（判定と同じ関数）に任せ、ここは表示と操作だけを持つ。
 */
import { drawBackground, drawBody, makeView, obbPath, toPx, type View } from '../render/arena';
import { fkPoints, interpPose, regionsOf, type BodyRef } from '../sim/body';
import { KF, type KeyframeSet, type Pose, type ShieldName } from '../sim/data';
import {
  CONTACT_JP,
  OPPONENT_POSE_JP,
  SHIELD_JP,
  WEAPON_JP,
  actionDuration,
  actorEquipment,
  bodyRef,
  defenceOf,
  firstContact,
  keyframeNames,
  opponentPoseOf,
  phasesOf,
  setLabel,
  trajectory,
  travelOf,
  type Contact,
  type OpponentPose,
  type Phase,
} from '../sim/motion';

const html = String.raw;
const SETS = [...KF.values()];
const SPEEDS = [0.05, 0.1, 0.25, 0.5, 1];
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

/** 段階の色（暗い背景で検証済みの系列色から。タイムラインと軌道で共通）。 */
const PHASE_COLOR: Record<Phase['name'] | 'なし', string> = {
  準備: '#199e70',
  実行: '#d95926',
  完了直前: '#9085e9',
  なし: '#199e70',
};

/** 関節角度のグラフの系列（暗い背景向けの分類色 1〜6。validate_palette で検証済み）。 */
const ANGLE_SERIES = [
  { key: 'torso', name: '胴体', color: '#3987e5' },
  { key: 'upperArm', name: '上腕', color: '#d95926' },
  { key: 'forearm', name: '前腕', color: '#199e70' },
  { key: 'thigh', name: '太腿', color: '#c98500' },
  { key: 'shin', name: '下腿', color: '#d55181' },
  { key: 'weaponAngle', name: '武器', color: '#0ca30c' },
] as const;

type ShieldChoice = ShieldName | 'none';

interface State {
  set: KeyframeSet;
  gap: number;
  oppShield: ShieldChoice;
  oppPose: OpponentPose;
  myShield: ShieldChoice;
  tau: number;
  playing: boolean;
  speed: number;
  loop: boolean;
  onion: boolean;
  trail: boolean;
  regions: boolean;
  showOpp: boolean;
}

const shieldOf = (c: ShieldChoice): ShieldName | null => (c === 'none' ? null : c);
/** 既定の間隔：基準間合い、なければ試作の既定の接近先 1.40m。接近は 1m 進んで 1.40m になる位置から。 */
const defaultGap = (set: KeyframeSet) => set.refDistance ?? (set.id === 'common-advance-1m' ? 2.4 : 1.4);
const fmt = (x: number, d = 3) => x.toFixed(d);

function groupOf(set: KeyframeSet): string {
  if (set.kind === 'attack') return `攻撃：${WEAPON_JP[set.weapon as keyof typeof WEAPON_JP]}`;
  if (set.kind === 'defence') return '防御';
  return '共通';
}

export function mountMotions(root: HTMLElement): void {
  root.innerHTML = html`
    <header class="top">
      <h1>gladios <span>モーション図鑑</span></h1>
      <nav class="pages"><a href="./">戦闘ビューア</a><a href="./motions.html" aria-current="page">モーション図鑑</a></nav>
    </header>
    <section class="mo-pick">
      <button id="prev" title="前の一式 (↑)">◀︎</button>
      <select id="set" aria-label="キーフレーム一式"></select>
      <button id="next" title="次の一式 (↓)">▶︎</button>
      <span id="set-id" class="muted mono"></span>
    </section>
    <section class="mo-opts">
      <label>自分の盾 <select id="my-shield"></select></label>
      <label>相手の盾 <select id="opp-shield"></select></label>
      <label>相手の姿勢 <select id="opp-pose"></select></label>
      <label>間隔 <input id="gap" type="number" min="0.35" max="4" step="0.01" /> m</label>
      <button id="gap-reset" title="一式の基準間合いに戻す">基準へ</button>
      <label class="check"><input id="show-opp" type="checkbox" checked /> 相手</label>
      <label class="check"><input id="trail" type="checkbox" checked /> 軌道</label>
      <label class="check"><input id="onion" type="checkbox" checked /> 残像</label>
      <label class="check"><input id="regions" type="checkbox" /> 判定領域</label>
    </section>
    <p id="summary" class="mo-summary"></p>
    <section class="mo-stage">
      <div class="canvas-wrap"><canvas id="stage"></canvas></div>
    </section>
    <section class="controls">
      <button id="play" class="primary" title="再生／一時停止 (Space)">▶︎</button>
      <label>速度 <select id="speed"></select></label>
      <label class="check"><input id="loop" type="checkbox" checked /> ループ</label>
      <span id="time" class="time"></span>
      <span class="muted">← → でキーフレーム間を移動、, . で 1 ステップ（0.005 秒）送り</span>
    </section>
    <section id="timeline" class="tl" aria-label="タイムライン（クリック・ドラッグでシーク）"></section>
    <section class="mo-panel">
      <h2>キーフレーム</h2>
      <div id="thumbs" class="thumbs"></div>
    </section>
    <section class="mo-panel">
      <h2>関節角度 <span class="muted">（胴体は真上、四肢は真下が 0°。武器は水平前方が 0°。正は相手側・上向き）</span></h2>
      <div id="legend" class="legend"></div>
      <div class="chart-wrap"><canvas id="chart"></canvas><div id="tip" class="tip" hidden></div></div>
    </section>
    <section class="mo-panel">
      <h2>数値</h2>
      <div class="table-wrap"><table id="table"></table></div>
    </section>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const setSel = $<HTMLSelectElement>('#set');
  const mySel = $<HTMLSelectElement>('#my-shield');
  const oppSel = $<HTMLSelectElement>('#opp-shield');
  const poseSel = $<HTMLSelectElement>('#opp-pose');
  const gapIn = $<HTMLInputElement>('#gap');
  const speedSel = $<HTMLSelectElement>('#speed');
  const playBtn = $<HTMLButtonElement>('#play');
  const stage = $<HTMLCanvasElement>('#stage');
  const chart = $<HTMLCanvasElement>('#chart');
  const tip = $('#tip');
  const timeline = $('#timeline');
  const checks = {
    loop: $<HTMLInputElement>('#loop'),
    onion: $<HTMLInputElement>('#onion'),
    trail: $<HTMLInputElement>('#trail'),
    regions: $<HTMLInputElement>('#regions'),
    showOpp: $<HTMLInputElement>('#show-opp'),
  };

  // ---- 選択肢 ----
  let group: HTMLOptGroupElement | null = null;
  for (const s of SETS) {
    const g = groupOf(s);
    if (group?.label !== g) {
      group = document.createElement('optgroup');
      group.label = g;
      setSel.append(group);
    }
    group.append(new Option(setLabel(s), s.id));
  }
  for (const c of ['scutum', 'parmula', 'small', 'none'] as const) {
    mySel.add(new Option(SHIELD_JP[c], c));
    oppSel.add(new Option(SHIELD_JP[c], c));
  }
  for (const p of Object.keys(OPPONENT_POSE_JP) as OpponentPose[]) poseSel.add(new Option(OPPONENT_POSE_JP[p], p));
  for (const s of SPEEDS) speedSel.add(new Option(`×${s}`, String(s), s === 0.25, s === 0.25));

  // ---- 状態（URL のハッシュから復元） ----
  const st: State = {
    set: SETS[0]!,
    gap: defaultGap(SETS[0]!),
    oppShield: 'scutum',
    oppPose: 'stance',
    myShield: 'scutum',
    tau: 0,
    playing: false,
    speed: 0.25,
    loop: true,
    onion: true,
    trail: true,
    regions: false,
    showOpp: true,
  };
  const h = new URLSearchParams(location.hash.slice(1));
  const hs = h.get('set');
  if (hs && KF.has(hs)) {
    st.set = KF.get(hs)!;
    st.gap = defaultGap(st.set);
  }
  if (h.get('gap')) st.gap = Number(h.get('gap'));
  if (h.get('opp')) st.oppShield = h.get('opp') as ShieldChoice;
  if (h.get('pose')) st.oppPose = h.get('pose') as OpponentPose;
  if (h.get('my')) st.myShield = h.get('my') as ShieldChoice;

  // ---- 派生値（一式・条件が変わったときだけ計算し直す） ----
  interface Derived {
    eq: ReturnType<typeof actorEquipment>;
    dur: number;
    actor: BodyRef;
    opp: BodyRef;
    oppPose: Pose;
    oppDefending: boolean;
    phases: Phase[] | null;
    names: string[];
    traj: ReturnType<typeof trajectory>;
    contact: Contact | null;
    kfPoses: Pose[];
  }
  let d!: Derived;

  function derive(): void {
    const set = st.set;
    const eq = actorEquipment(set, shieldOf(st.myShield));
    const dur = actionDuration(set, eq.weapon);
    const actor = bodyRef(eq.weapon, eq.shield, -st.gap / 2, 1);
    const opp = bodyRef('gladius', shieldOf(st.oppShield), st.gap / 2, -1);
    const op = opponentPoseOf(st.oppPose, shieldOf(st.oppShield));
    d = {
      eq,
      dur,
      actor,
      opp,
      oppPose: op.pose,
      oppDefending: op.defending,
      phases: phasesOf(set),
      names: keyframeNames(set),
      traj: trajectory(set, actor, 160),
      contact: set.kind === 'attack' ? firstContact(set.id, actor, dur, opp, op.pose, op.defending) : null,
      kfPoses: set.keyframes.map((k) => interpPose(set.id, k.t)),
    };
  }

  function syncControls(): void {
    setSel.value = st.set.id;
    mySel.value = d.eq.shield ?? 'none';
    mySel.disabled = st.set.kind !== 'attack' || st.set.weapon === 'trident';
    oppSel.value = st.oppShield;
    poseSel.value = st.oppPose;
    gapIn.value = st.gap.toFixed(2);
    $('#set-id').textContent = st.set.id;
    const q = new URLSearchParams({ set: st.set.id, gap: st.gap.toFixed(2), opp: st.oppShield, pose: st.oppPose, my: st.myShield });
    history.replaceState(null, '', `#${q}`);
  }

  function renderSummary(): void {
    const s = st.set;
    const parts: string[] = [];
    if (s.kind === 'attack') {
      const w = WEAPON_JP[d.eq.weapon];
      parts.push(`所要 <b>${fmt(d.dur)} 秒</b>（基準 ${s.baseTime ?? 1} 秒 × 武器重量の倍率。${w}）`);
      parts.push(s.refDistance ? `基準間合い ${s.refDistance.toFixed(2)} m` : '基準間合いの記録なし（試作の既定の接近は 1.40 m）');
      parts.push(
        d.contact
          ? `最初の接触 <b>${fmt(d.contact.time)} 秒</b>（進み ${fmt(d.contact.tau, 2)}）相手の<b>${CONTACT_JP[d.contact.target]}</b>`
          : '<b>この間隔・姿勢では接触しない</b>',
      );
    } else {
      parts.push(`所要 <b>${fmt(d.dur)} 秒</b>`);
      const df = defenceOf(s);
      if (df?.policy === 'deflect') parts.push('実戦では中央の防御姿勢を、きっかけの攻撃が解決するまで保持する（v3.43）。ここでは保持せずに再生');
      if (s.id === 'common-advance-1m' || s.id === 'common-retreat-1m') parts.push('1m あたり 0.55 秒。実戦では移動距離に合わせて繰り返す');
      if (s.id === 'common-shield-push') parts.push(`設計書 5.5.1 の基準時間 0.8 秒で再生（一式データの baseTime は ${s.baseTime}）`);
      parts.push('接触の計算は攻撃一式のみ');
    }
    $('#summary').innerHTML = parts.join('<span class="sep">｜</span>');
  }

  // ---- 舞台 ----
  function stageView(): View {
    const w = stage.width;
    const hgt = stage.height;
    // 横は「間隔＋両者の体と武器」、縦は頭上のラベルまで（約 2.3m）が収まる縮尺にする
    const ground = 0.86;
    const widthM = Math.max(3.4, st.gap + 1.2 + d.actor.wlen + 0.8, w / ((hgt * ground) / 2.3));
    return makeView(w, hgt, 0, widthM, ground);
  }

  function actorAt(tau: number): BodyRef {
    return { ...d.actor, x: d.actor.x + d.actor.facing * travelOf(st.set, tau) };
  }

  function phaseColorAt(tau: number): string {
    if (!d.phases) return PHASE_COLOR.なし;
    return PHASE_COLOR[(d.phases.find((p) => tau <= p.to) ?? d.phases[d.phases.length - 1]!).name];
  }

  function drawStage(): void {
    const ctx = stage.getContext('2d')!;
    const v = stageView();
    ctx.clearRect(0, 0, v.w, v.h);
    drawBackground(ctx, v);

    // 相手
    if (st.showOpp) {
      const flash =
        d.contact && st.tau >= d.contact.tau && st.tau <= d.contact.tau + 0.15 / d.dur
          ? d.contact.target === 'shield' || d.contact.target === 'weapon'
            ? 'block'
            : 'hit'
          : null;
      drawBody(ctx, v, 'B', d.opp, d.oppPose, { flash, showRegions: st.regions, label: `相手：${OPPONENT_POSE_JP[st.oppPose]}` });
    }

    // 残像（各キーフレームの姿勢）
    if (st.onion) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      st.set.keyframes.forEach((k, i) => drawBody(ctx, v, 'A', actorAt(k.t), d.kfPoses[i]!));
      ctx.restore();
    }

    // 軌道（剣先は段階で色分け、握りは細い線）
    if (st.trail) {
      const lw = Math.max(1.5, v.scale * 0.012);
      for (let i = 1; i < d.traj.length; i++) {
        const a = d.traj[i - 1]!;
        const b = d.traj[i]!;
        ctx.strokeStyle = phaseColorAt(b.tau);
        ctx.globalAlpha = b.tau <= st.tau ? 1 : 0.35;
        ctx.lineWidth = lw * 1.6;
        ctx.beginPath();
        ctx.moveTo(...toPx(v, a.tip));
        ctx.lineTo(...toPx(v, b.tip));
        ctx.stroke();
        ctx.lineWidth = lw * 0.7;
        ctx.beginPath();
        ctx.moveTo(...toPx(v, a.grip));
        ctx.lineTo(...toPx(v, b.grip));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // キーフレームでの剣先の位置
      ctx.font = `${Math.max(12, Math.round(v.scale * 0.06))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      st.set.keyframes.forEach((k, i) => {
        const P = fkPoints(actorAt(k.t), d.kfPoses[i]!);
        const [x, y] = toPx(v, P.tip);
        ctx.fillStyle = '#f3ead8';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(CIRCLED[i] ?? `${i + 1}`, x + 12, y - 8);
      });
    }

    // 最初の接触の瞬間の武器
    if (d.contact) {
      const P = fkPoints(d.actor, interpPose(st.set.id, d.contact.tau));
      const [gx, gy] = toPx(v, P.grip);
      const [tx, ty] = toPx(v, P.tip);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(12, Math.round(v.scale * 0.055))}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`接触 ${fmt(d.contact.time)}秒 ${CONTACT_JP[d.contact.target]}`, tx + 8, ty - 10);
    }

    // 本人（現在の姿勢）
    const pose = interpPose(st.set.id, st.tau);
    drawBody(ctx, v, 'A', actorAt(st.tau), pose, { showRegions: st.regions, label: setLabel(st.set) });
    if (st.regions && st.showOpp) {
      // 相手の判定領域は drawBody が描く。盾の輪郭だけ強調
      const { regs } = regionsOf(d.opp, d.oppPose);
      if (regs.shield) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        obbPath(ctx, v, regs.shield);
        ctx.stroke();
      }
    }
  }

  // ---- タイムライン ----
  function buildTimeline(): void {
    const pct = (tau: number) => `${(tau * 100).toFixed(3)}%`;
    const phaseRow = d.phases
      ? d.phases
          .map(
            (p) =>
              `<div class="tl-seg" style="left:${pct(p.from)};width:${pct(p.to - p.from)};background:${PHASE_COLOR[p.name]}">${p.name}<span>${fmt((p.to - p.from) * d.dur, 2)}s</span></div>`,
          )
          .join('')
      : `<div class="tl-seg none" style="left:0;width:100%">段階の印なし</div>`;
    const kfRow = st.set.keyframes
      .map(
        (k, i) =>
          `<button class="tl-kf" data-tau="${k.t}" style="left:${pct(k.t)}" title="${d.names[i]} ${fmt(k.t * d.dur)}秒">${CIRCLED[i]}<span>${d.names[i]}</span></button>`,
      )
      .join('');
    const contactRow = d.contact
      ? `<div class="tl-contact" style="left:${pct(d.contact.tau)}">▲ ${fmt(d.contact.time)}s ${CONTACT_JP[d.contact.target]}</div>`
      : `<div class="tl-none">${st.set.kind === 'attack' ? '接触なし' : '—'}</div>`;
    const ticks: string[] = [];
    const stepS = d.dur > 1.2 ? 0.2 : 0.1;
    for (let s = 0; s <= d.dur + 1e-9; s += stepS) {
      ticks.push(`<div class="tl-tick" style="left:${pct(s / d.dur)}">${s.toFixed(1)}</div>`);
    }
    timeline.innerHTML = html`
      <div class="tl-label">段階</div><div class="tl-track">${phaseRow}</div>
      <div class="tl-label">キーフレーム</div><div class="tl-track kf">${kfRow}</div>
      <div class="tl-label">接触</div><div class="tl-track ct">${contactRow}</div>
      <div class="tl-label">秒</div><div class="tl-track ticks">${ticks.join('')}</div>
      <div class="tl-head" id="tl-head"></div>
    `;
    timeline.querySelectorAll<HTMLButtonElement>('.tl-kf').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        seek(Number(b.dataset.tau));
      }),
    );
  }

  function trackRect(): DOMRect {
    return timeline.querySelector('.tl-track')!.getBoundingClientRect();
  }

  function updatePlayhead(): void {
    const head = timeline.querySelector<HTMLElement>('#tl-head');
    if (!head) return;
    const r = trackRect();
    const t0 = timeline.getBoundingClientRect();
    head.style.left = `${r.left - t0.left + st.tau * r.width}px`;
  }

  // ---- サムネイル ----
  function buildThumbs(): void {
    const box = $('#thumbs');
    box.replaceChildren();
    st.set.keyframes.forEach((k, i) => {
      const fig = document.createElement('figure');
      fig.className = 'thumb';
      fig.dataset.tau = String(k.t);
      const c = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(150 * dpr);
      c.height = Math.round(170 * dpr);
      const ctx = c.getContext('2d')!;
      const body = actorAt(k.t);
      // 長い武器（槍）も枠に収まるよう、武器の長さに応じて表示範囲を広げる
      const span = Math.max(2.4, 1.2 + d.actor.wlen * 1.7);
      const v = makeView(c.width, c.height, body.x + span * 0.25, span, 0.9);
      ctx.fillStyle = '#1d1a17';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#b89a6a';
      ctx.fillRect(0, v.groundY, c.width, c.height - v.groundY);
      drawBody(ctx, v, 'A', body, d.kfPoses[i]!);
      const cap = document.createElement('figcaption');
      cap.innerHTML = `${CIRCLED[i]} ${d.names[i]}<br><span class="mono">${fmt(k.t * d.dur)}s ・ 進み ${k.t.toFixed(2)}</span>`;
      fig.append(c, cap);
      fig.addEventListener('click', () => seek(k.t));
      box.append(fig);
    });
  }

  function updateThumbs(): void {
    const kfs = st.set.keyframes;
    let cur = 0;
    kfs.forEach((k, i) => {
      if (k.t <= st.tau + 1e-9) cur = i;
    });
    root.querySelectorAll('.thumb').forEach((el, i) => el.classList.toggle('active', i === cur));
  }

  // ---- 関節角度のグラフ ----
  const chartPad = { l: 44, r: 12, t: 10, b: 26 };
  let yRange: [number, number] = [-90, 180];

  function buildLegend(): void {
    $('#legend').innerHTML = ANGLE_SERIES.map(
      (s) => `<span class="lg"><i style="background:${s.color}"></i>${s.name}</span>`,
    ).join('');
  }

  function computeYRange(): void {
    let lo = Infinity;
    let hi = -Infinity;
    for (const k of st.set.keyframes) {
      for (const s of ANGLE_SERIES) {
        lo = Math.min(lo, k[s.key]);
        hi = Math.max(hi, k[s.key]);
      }
    }
    yRange = [Math.floor(lo / 30) * 30 - 10, Math.ceil(hi / 30) * 30 + 10];
  }

  function drawChart(): void {
    const ctx = chart.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const W = chart.width;
    const H = chart.height;
    const p = { l: chartPad.l * dpr, r: chartPad.r * dpr, t: chartPad.t * dpr, b: chartPad.b * dpr };
    const x = (tau: number) => p.l + tau * (W - p.l - p.r);
    const y = (deg: number) => p.t + (1 - (deg - yRange[0]) / (yRange[1] - yRange[0])) * (H - p.t - p.b);
    ctx.clearRect(0, 0, W, H);
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    // 目盛り（控えめ）
    ctx.strokeStyle = '#2c2a26';
    ctx.fillStyle = '#a39a89';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    for (let deg = Math.ceil(yRange[0] / 30) * 30; deg <= yRange[1]; deg += 30) {
      ctx.beginPath();
      ctx.moveTo(p.l, y(deg));
      ctx.lineTo(W - p.r, y(deg));
      ctx.stroke();
      ctx.fillText(`${deg}°`, p.l - 6 * dpr, y(deg) + 4 * dpr);
    }
    ctx.textAlign = 'center';
    const stepS = d.dur > 1.2 ? 0.2 : 0.1;
    for (let s = 0; s <= d.dur + 1e-9; s += stepS) ctx.fillText(`${s.toFixed(1)}s`, x(s / d.dur), H - 8 * dpr);
    // キーフレームの縦線
    ctx.setLineDash([3 * dpr, 4 * dpr]);
    ctx.strokeStyle = '#4a443a';
    for (const k of st.set.keyframes) {
      ctx.beginPath();
      ctx.moveTo(x(k.t), p.t);
      ctx.lineTo(x(k.t), H - p.b);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // 系列（線形補間なのでキーフレーム間は直線）
    for (const s of ANGLE_SERIES) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      st.set.keyframes.forEach((k, i) => (i === 0 ? ctx.moveTo(x(k.t), y(k[s.key])) : ctx.lineTo(x(k.t), y(k[s.key]))));
      ctx.stroke();
      ctx.fillStyle = s.color;
      for (const k of st.set.keyframes) {
        ctx.beginPath();
        ctx.arc(x(k.t), y(k[s.key]), 4 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 再生位置
    ctx.strokeStyle = '#f3ead8';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(x(st.tau), p.t);
    ctx.lineTo(x(st.tau), H - p.b);
    ctx.stroke();
  }

  function chartTauAt(clientX: number): number {
    const r = chart.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left - chartPad.l) / (r.width - chartPad.l - chartPad.r)));
  }

  chart.addEventListener('pointermove', (e) => {
    const tau = chartTauAt(e.clientX);
    const pose = interpPose(st.set.id, tau);
    tip.hidden = false;
    tip.innerHTML =
      `<b>${fmt(tau * d.dur)} 秒</b>（進み ${tau.toFixed(2)}）<br>` +
      ANGLE_SERIES.map((s) => `<i style="background:${s.color}"></i>${s.name} ${pose[s.key].toFixed(1)}°`).join('<br>');
    const r = chart.getBoundingClientRect();
    const left = e.clientX - r.left;
    tip.style.left = `${left + (left > r.width / 2 ? -170 : 14)}px`;
    tip.style.top = '8px';
  });
  chart.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });
  chart.addEventListener('click', (e) => seek(chartTauAt(e.clientX)));

  // ---- 数値表 ----
  function buildTable(): void {
    const hasShield = st.set.keyframes.some((k) => k.shield);
    const head = ['', '名前', '進み', '秒', '胴体', '上腕', '前腕', '太腿', '下腿', '股関節 x, y', '武器', ...(hasShield ? ['盾 dx, dy, 角度'] : [])];
    const rows = st.set.keyframes.map((k, i) => {
      const cells = [
        CIRCLED[i],
        d.names[i],
        k.t.toFixed(2),
        fmt(k.t * d.dur),
        k.torso,
        k.upperArm,
        k.forearm,
        k.thigh,
        k.shin,
        `${k.hip[0].toFixed(2)}, ${k.hip[1].toFixed(2)}`,
        k.weaponAngle,
        ...(hasShield ? [k.shield ? `${k.shield.dx}, ${k.shield.dy}, ${k.shield.angle}` : '—'] : []),
      ];
      return `<tr data-tau="${k.t}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    });
    $('#table').innerHTML = `<thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
    $('#table').querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) =>
      tr.addEventListener('click', () => seek(Number(tr.dataset.tau))),
    );
  }

  // ---- 全体の更新 ----
  function rebuild(): void {
    derive();
    syncControls();
    renderSummary();
    computeYRange();
    buildTimeline();
    buildThumbs();
    buildTable();
    render();
  }

  function render(): void {
    drawStage();
    drawChart();
    updatePlayhead();
    updateThumbs();
    $('#time').textContent = `${fmt(st.tau * d.dur)} / ${fmt(d.dur)} 秒（進み ${st.tau.toFixed(3)}）`;
    playBtn.textContent = st.playing ? '❚❚' : '▶︎';
  }

  function seek(tau: number): void {
    st.tau = Math.max(0, Math.min(1, tau));
    st.playing = false;
    render();
  }

  function selectSet(set: KeyframeSet): void {
    st.set = set;
    st.gap = defaultGap(set);
    st.tau = 0;
    rebuild();
  }

  // タイムラインのクリック・ドラッグでシーク
  let dragging = false;
  const seekFromPointer = (e: PointerEvent) => {
    const r = trackRect();
    seek((e.clientX - r.left) / r.width);
  };
  timeline.addEventListener('pointerdown', (e) => {
    dragging = true;
    timeline.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  });
  timeline.addEventListener('pointermove', (e) => dragging && seekFromPointer(e));
  timeline.addEventListener('pointerup', () => {
    dragging = false;
  });

  // ---- 操作 ----
  const idx = () => SETS.indexOf(st.set);
  setSel.addEventListener('change', () => selectSet(KF.get(setSel.value)!));
  $('#prev').addEventListener('click', () => selectSet(SETS[(idx() - 1 + SETS.length) % SETS.length]!));
  $('#next').addEventListener('click', () => selectSet(SETS[(idx() + 1) % SETS.length]!));
  mySel.addEventListener('change', () => {
    st.myShield = mySel.value as ShieldChoice;
    rebuild();
  });
  oppSel.addEventListener('change', () => {
    st.oppShield = oppSel.value as ShieldChoice;
    rebuild();
  });
  poseSel.addEventListener('change', () => {
    st.oppPose = poseSel.value as OpponentPose;
    rebuild();
  });
  gapIn.addEventListener('change', () => {
    const g = Number(gapIn.value);
    if (Number.isFinite(g)) st.gap = Math.max(0.35, Math.min(4, g));
    rebuild();
  });
  $('#gap-reset').addEventListener('click', () => {
    st.gap = defaultGap(st.set);
    rebuild();
  });
  speedSel.addEventListener('change', () => {
    st.speed = Number(speedSel.value);
  });
  for (const [k, el] of Object.entries(checks)) {
    el.addEventListener('change', () => {
      (st as unknown as Record<string, boolean>)[k] = el.checked;
      render();
    });
  }
  playBtn.addEventListener('click', () => {
    if (!st.playing && st.tau >= 1) st.tau = 0;
    st.playing = !st.playing;
    lastTs = null;
    render();
  });
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement || (e.target instanceof HTMLInputElement && e.target.type === 'number')) return;
    const kfs = st.set.keyframes;
    if (e.key === ' ') playBtn.click();
    else if (e.key === 'ArrowRight') seek(kfs.find((k) => k.t > st.tau + 1e-6)?.t ?? 1);
    else if (e.key === 'ArrowLeft') seek([...kfs].reverse().find((k) => k.t < st.tau - 1e-6)?.t ?? 0);
    else if (e.key === '.') seek(st.tau + 0.005 / d.dur);
    else if (e.key === ',') seek(st.tau - 0.005 / d.dur);
    else if (e.key === 'ArrowDown') $('#next').click();
    else if (e.key === 'ArrowUp') $('#prev').click();
    else return;
    e.preventDefault();
  });

  let lastTs: number | null = null;
  function tick(ts: number): void {
    if (st.playing) {
      if (lastTs !== null) {
        st.tau += ((ts - lastTs) / 1000) * (st.speed / d.dur);
        if (st.tau >= 1) {
          if (checks.loop.checked) st.tau %= 1;
          else {
            st.tau = 1;
            st.playing = false;
          }
        }
      }
      lastTs = ts;
      render();
    } else lastTs = null;
    requestAnimationFrame(tick);
  }

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.parentElement!.clientWidth;
    const hgt = Math.round(Math.min(520, w * 0.5));
    stage.style.height = `${hgt}px`;
    stage.width = Math.round(w * dpr);
    stage.height = Math.round(hgt * dpr);
    const cw = chart.parentElement!.clientWidth;
    chart.style.height = '220px';
    chart.width = Math.round(cw * dpr);
    chart.height = Math.round(220 * dpr);
    if (d) render();
  }

  buildLegend();
  new ResizeObserver(resize).observe(root);
  resize();
  rebuild();
  requestAnimationFrame(tick);
}
