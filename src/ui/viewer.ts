/**
 * 戦闘ビューア：確認用シナリオを選び（A・B の設定は画面で変えられる）、再演した戦闘を
 * 再生・一時停止・シークする。判断パネルで、各時点の判断とその理由を見せる（#33）。
 * 表示は記録（Recording）を読むだけで、判定には関わらない。
 */
import scenariosJson from '../scenarios/check-scenarios.json';
import { drawFrame } from '../render/arena';
import {
  frameIndexAt,
  lastEventAtFrame,
  record,
  type GladFrame,
  type LogEvent,
  type Recording,
} from '../sim/record';
import type { GladId, SimOptions } from '../sim/sim';
import { decisionPanelHtml } from './decision-panel';
import { staminaStageName } from './labels';
import { SHIELD_JP, WEAPON_JP } from './motion-labels';
import {
  ATTACK_JP,
  GLAD_IDS,
  POLICY_CHOICES,
  POLICY_JP,
  PUSH_JP,
  SHIELD_CHOICES,
  WEAPON_CHOICES,
  fitToWeapon,
  isTwoHanded,
  optionsFromSettings,
  patternLabel,
  patternsFor,
  setShortLabel,
  setsFor,
  settingsFromOptions,
  type AttackMode,
  type BattleSettings,
  type GladSettings,
  type PushMode,
} from './settings';

const scenarios = scenariosJson as { name: string; options: SimOptions }[];
const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
const FLASH_WINDOW = 0.25;

const html = String.raw;

export function mountViewer(root: HTMLElement): void {
  root.innerHTML = html`
    <header class="top">
      <h1>gladios <span>戦闘ビューア</span></h1>
      <nav class="pages"><a href="./" aria-current="page">戦闘ビューア</a><a href="./motions.html">モーション図鑑</a></nav>
      <label class="scenario">確認シナリオ
        <select id="scenario"></select>
      </label>
      <p id="summary" class="summary"></p>
    </header>
    <details class="settings" id="settings-box">
      <summary>剣闘士の設定 <span class="muted">（確認シナリオの設定を変えて戦わせる）</span></summary>
      <div class="settings-grid">
        <fieldset id="set-A"></fieldset>
        <fieldset id="set-B"></fieldset>
      </div>
      <label class="cap">時間上限 <input id="cap" type="number" min="10" max="600" step="10" /> 秒</label>
    </details>
    <section class="stage">
      <div class="hud" id="hud-A"></div>
      <div class="canvas-wrap"><canvas id="arena"></canvas></div>
      <div class="hud" id="hud-B"></div>
    </section>
    <section class="controls">
      <button id="restart" title="最初へ (Home)">⏮</button>
      <button id="prev-ev" title="前のイベント ([)">◀︎◀︎</button>
      <button id="play" class="primary" title="再生／一時停止 (Space)">▶︎</button>
      <button id="next-ev" title="次のイベント (])">▶︎▶︎</button>
      <input id="seek" type="range" min="0" step="0.01" value="0" aria-label="シーク" />
      <span id="time" class="time"></span>
      <label>速度 <select id="speed"></select></label>
      <label class="check"><input id="regions" type="checkbox" /> 判定領域</label>
    </section>
    <section class="decisions">
      <div class="decision" id="dec-A"></div>
      <div class="decision" id="dec-B"></div>
    </section>
    <section class="log">
      <div class="log-filters">
        <span>ログ</span>
        <label class="check"><input type="checkbox" data-actor="A" checked /> A</label>
        <label class="check"><input type="checkbox" data-actor="B" checked /> B</label>
        <label class="check"><input type="checkbox" data-kind="行動開始" checked /> 行動開始</label>
        <label class="check"><input type="checkbox" data-kind="選択" /> 選択</label>
        <label class="check"><input type="checkbox" data-kind="接触" checked /> 接触</label>
        <label class="check"><input type="checkbox" data-kind="結果" checked /> 結果</label>
        <label class="check"><input type="checkbox" data-kind="状態変化" checked /> 状態変化</label>
        <label class="check"><input id="follow" type="checkbox" checked /> 追従</label>
      </div>
      <ol id="log-list"></ol>
    </section>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const canvas = $<HTMLCanvasElement>('#arena');
  const ctx = canvas.getContext('2d')!;
  const scenarioSel = $<HTMLSelectElement>('#scenario');
  const speedSel = $<HTMLSelectElement>('#speed');
  const seek = $<HTMLInputElement>('#seek');
  const playBtn = $<HTMLButtonElement>('#play');
  const timeEl = $('#time');
  const summaryEl = $('#summary');
  const regionsChk = $<HTMLInputElement>('#regions');
  const followChk = $<HTMLInputElement>('#follow');
  const logList = $<HTMLOListElement>('#log-list');
  const hud = { A: $('#hud-A'), B: $('#hud-B') };
  const dec = { A: $('#dec-A'), B: $('#dec-B') };
  const setBox = { A: $<HTMLFieldSetElement>('#set-A'), B: $<HTMLFieldSetElement>('#set-B') };
  const capInput = $<HTMLInputElement>('#cap');
  const customOpt = new Option('（設定を変更）', 'custom');

  scenarios.forEach((s, i) => scenarioSel.add(new Option(s.name, String(i))));
  SPEEDS.forEach((s) => speedSel.add(new Option(`×${s}`, String(s), s === 1, s === 1)));

  let rec: Recording;
  let settings: BattleSettings;
  let t = 0;
  let playing = false;
  let lastTs: number | null = null;
  let logItems: HTMLLIElement[] = [];
  let currentLog = -1;

  const endTime = () => rec.frames[rec.frames.length - 1]!.t;

  /** 確認シナリオを読み込み、その設定で戦わせる。 */
  function load(i: number): void {
    customOpt.remove();
    settings = settingsFromOptions(scenarios[i]!.options);
    buildSettings();
    run();
  }

  /** 画面の設定を変えたとき。 */
  function changed(): void {
    if (!customOpt.parentElement) scenarioSel.add(customOpt);
    scenarioSel.value = 'custom';
    buildSettings();
    run();
  }

  function buildSettings(): void {
    for (const id of GLAD_IDS) buildGladSettings(id, settings[id]);
    capInput.value = String(settings.cap);
  }

  function buildGladSettings(id: GladId, g: GladSettings): void {
    const opts = <T extends string>(pairs: [T, string][], value: T) =>
      pairs.map(([v, label]) => `<option value="${v}"${v === value ? ' selected' : ''}>${label}</option>`).join('');
    const shieldKey = (x: (typeof SHIELD_CHOICES)[number]) => x ?? 'none';
    const twoHanded = isTwoHanded(g.weapon);
    setBox[id].innerHTML = html`
      <legend class="who-${id}">${id}</legend>
      <label>武器 <select data-field="weapon">${opts(WEAPON_CHOICES.map((w) => [w, WEAPON_JP[w]]), g.weapon)}</select></label>
      <label>盾 <select data-field="shield"${twoHanded ? ' disabled title="両手持ちの武器は盾を持てない"' : ''}>${opts(
        SHIELD_CHOICES.map((x) => [shieldKey(x), SHIELD_JP[shieldKey(x)]]),
        shieldKey(g.shield),
      )}</select></label>
      <label>防御の方針 <select data-field="policy">${opts(POLICY_CHOICES.map((p) => [p, POLICY_JP[p]]), g.policy)}</select></label>
      <label>攻撃のしかた <select data-field="attack">${opts(
        (['fixed', 'auto', 'none'] as AttackMode[]).map((a) => [a, ATTACK_JP[a]]),
        g.attack,
      )}</select></label>
      ${
        g.attack === 'fixed'
          ? `<label>攻撃の一式 <select data-field="set">${opts(setsFor(g.weapon).map((x) => [x.id, setShortLabel(x)]), g.set)}</select></label>`
          : g.attack === 'auto'
            ? `<label>攻撃（部位は自動） <select data-field="pattern">${opts(patternsFor(g.weapon).map((p) => [p, patternLabel(p)]), g.pattern)}</select></label>`
            : ''
      }
      <label>盾押し <select data-field="push"${g.attack === 'none' || g.shield === null ? ' disabled title="攻撃しない側・盾なしは使わない"' : ''}>${opts(
        (['off', 'push', 'mix'] as PushMode[]).map((p) => [p, PUSH_JP[p]]),
        g.attack === 'none' || g.shield === null ? 'off' : g.push,
      )}</select></label>
      <label>判断能力 <input data-field="judgment" type="number" min="0" max="100" step="5" value="${g.judgment}" /></label>`;
  }

  function onSettingChange(id: GladId, el: HTMLSelectElement | HTMLInputElement): void {
    const g = { ...settings[id] };
    const v = el.value;
    switch (el.dataset.field) {
      case 'weapon':
        g.weapon = v as GladSettings['weapon'];
        break;
      case 'shield':
        g.shield = v === 'none' ? null : (v as NonNullable<GladSettings['shield']>);
        break;
      case 'policy':
        g.policy = v as GladSettings['policy'];
        break;
      case 'attack':
        g.attack = v as AttackMode;
        break;
      case 'set':
        g.set = v;
        break;
      case 'pattern':
        g.pattern = v;
        break;
      case 'push':
        g.push = v as PushMode;
        break;
      case 'judgment': {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        g.judgment = Math.max(0, Math.min(100, n));
        break;
      }
      default:
        return;
    }
    const fitted = fitToWeapon(g);
    // 攻撃しない側・盾なしは盾押しを使わない（画面で選べないので設定からも外す）
    if (fitted.attack === 'none' || fitted.shield === null) fitted.push = 'off';
    settings = { ...settings, [id]: fitted };
    changed();
  }

  function run(): void {
    rec = record(optionsFromSettings(settings));
    t = 0;
    seek.max = String(endTime());
    const s = rec.summary;
    const time = `${s.time.toFixed(2)}秒`;
    switch (s.reason) {
      case '体力0':
        summaryEl.textContent = `結果: ${s.winner} の勝ち（${s.winner === 'A' ? 'B' : 'A'} の体力0、${time}）`;
        break;
      case '相打ち':
        summaryEl.textContent = `結果: 相打ち（両者の体力0、引き分け、${time}）`;
        break;
      case '時間上限':
        summaryEl.textContent = `結果: 決着せず（時間上限、${time}）`;
        break;
      default: {
        // 結果の種類が増えたら、ここで型検査が失敗する（表示の追加漏れを防ぐ）
        const unhandled: never = s.reason;
        summaryEl.textContent = `結果: ${String(unhandled)}（${time}）`;
      }
    }
    buildLog();
    setPlaying(false);
    render();
  }

  function buildLog(): void {
    logList.replaceChildren();
    logItems = rec.events.map((e) => {
      const li = document.createElement('li');
      li.dataset.kind = e.kind;
      li.dataset.actor = e.actor ?? '';
      li.className = `ev ev-${e.actor ?? 'none'}`;
      li.innerHTML = html`<time>${e.t.toFixed(2)}</time><b>${e.kind}</b><span></span>`;
      li.querySelector('span')!.textContent = e.text;
      li.addEventListener('click', () => {
        t = eventTime(e);
        setPlaying(false);
        render();
      });
      return li;
    });
    logList.append(...logItems);
    applyFilters();
    currentLog = -1;
  }

  function applyFilters(): void {
    const actors = new Set(
      [...root.querySelectorAll<HTMLInputElement>('[data-actor]')].filter((c) => c.checked).map((c) => c.dataset.actor),
    );
    const kinds = new Set(
      [...root.querySelectorAll<HTMLInputElement>('[data-kind]')].filter((c) => c.checked).map((c) => c.dataset.kind),
    );
    for (const li of logItems) {
      const kindOk = li.dataset.kind === '終了' || kinds.has(li.dataset.kind);
      const actorOk = li.dataset.actor === '' || actors.has(li.dataset.actor);
      li.hidden = !(kindOk && actorOk);
    }
  }

  function setPlaying(p: boolean): void {
    if (p && t >= endTime()) t = 0;
    playing = p;
    lastTs = null;
    playBtn.textContent = p ? '❚❚' : '▶︎';
  }

  /** イベントが起きたフレームの時刻（ログの印字時刻は 0.01 秒に丸められているため使わない）。 */
  const eventTime = (e: LogEvent): number => rec.frames[e.frame]!.t;

  function jumpEvent(dir: 1 | -1): void {
    const cur = frameIndexAt(rec, t);
    const visible = rec.events.filter((e) => !logItems[e.index]!.hidden);
    const target =
      dir === 1 ? visible.find((e) => e.frame > cur) : [...visible].reverse().find((e) => e.frame < cur);
    if (target) {
      t = eventTime(target);
      setPlaying(false);
      render();
    }
  }

  function recentContacts(frameIndex: number): LogEvent[] {
    const out: LogEvent[] = [];
    const now = rec.frames[frameIndex]!.t;
    for (let k = lastEventAtFrame(rec, frameIndex); k >= 0; k--) {
      const e = rec.events[k]!;
      if (eventTime(e) < now - FLASH_WINDOW) break;
      if (e.kind === '接触') out.push(e);
    }
    return out;
  }

  function renderHud(id: GladId, f: GladFrame): void {
    const b = rec.bodies[id];
    const bar = (name: string, value: number, max: number, cls: string, note = '') => html`
      <div class="bar ${cls}">
        <div class="bar-head"><span>${name}</span><span>${Math.max(0, value).toFixed(0)}${note}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></div></div>
      </div>`;
    const posture = f.collapsed ? '（崩れ）' : f.posture < 50 ? '（乱れ）' : '';
    hud[id].innerHTML = html`
      <h2 class="who who-${id}">${id}</h2>
      ${bar('体力', f.hp, b.hpMax, 'hp')}
      ${bar('スタミナ', f.stamina, b.staminaMax, 'st', `（${staminaStageName(f.stamina)}）`)}
      ${bar('体勢', f.posture, 100, 'po', posture)}
      <p class="act"></p>`;
    hud[id].querySelector('.act')!.textContent = f.holding ? `構え: ${f.label}` : (f.label ?? '判断中');
  }

  function render(): void {
    t = Math.max(0, Math.min(endTime(), t));
    const fi = frameIndexAt(rec, t);
    const frame = rec.frames[fi]!;
    drawFrame(ctx, rec, frame, { showRegions: regionsChk.checked, recentContacts: recentContacts(fi) });
    renderHud('A', frame.A);
    renderHud('B', frame.B);
    for (const id of GLAD_IDS) dec[id].innerHTML = decisionPanelHtml(rec, id, fi, settings[id].policy === 'none');
    seek.value = String(t);
    timeEl.textContent = `${t.toFixed(2)} / ${endTime().toFixed(2)} 秒`;

    const k = lastEventAtFrame(rec, fi);
    if (k !== currentLog) {
      logItems.forEach((li, i) => li.classList.toggle('past', i <= k));
      logItems[currentLog]?.classList.remove('current');
      currentLog = k;
      const cur = logItems[k];
      cur?.classList.add('current');
      if (cur && followChk.checked && !cur.hidden) cur.scrollIntoView({ block: 'nearest' });
    }
  }

  function tick(ts: number): void {
    if (playing) {
      if (lastTs !== null) {
        t += ((ts - lastTs) / 1000) * Number(speedSel.value);
        if (t >= endTime()) {
          t = endTime();
          setPlaying(false);
        }
      }
      lastTs = ts;
      render();
    }
    requestAnimationFrame(tick);
  }

  function resize(): void {
    const wrap = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = Math.round(w * 0.5);
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (rec) render();
  }

  scenarioSel.addEventListener('change', () => {
    if (scenarioSel.value !== 'custom') load(Number(scenarioSel.value));
  });
  for (const id of GLAD_IDS) {
    setBox[id].addEventListener('change', (e) => {
      const el = e.target;
      if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) onSettingChange(id, el);
    });
  }
  capInput.addEventListener('change', () => {
    const n = Number(capInput.value);
    if (!Number.isFinite(n) || n <= 0) {
      capInput.value = String(settings.cap);
      return;
    }
    settings = { ...settings, cap: Math.min(600, n) };
    changed();
  });
  playBtn.addEventListener('click', () => setPlaying(!playing));
  $('#restart').addEventListener('click', () => {
    t = 0;
    render();
  });
  $('#prev-ev').addEventListener('click', () => jumpEvent(-1));
  $('#next-ev').addEventListener('click', () => jumpEvent(1));
  seek.addEventListener('input', () => {
    t = Number(seek.value);
    render();
  });
  regionsChk.addEventListener('change', render);
  root.querySelectorAll('[data-actor],[data-kind]').forEach((c) =>
    c.addEventListener('change', () => {
      applyFilters();
      currentLog = -2;
      render();
    }),
  );
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
    const step = e.shiftKey ? 1 : 0.1;
    if (e.key === ' ') setPlaying(!playing);
    else if (e.key === 'ArrowRight') t += step;
    else if (e.key === 'ArrowLeft') t -= step;
    else if (e.key === ']') return jumpEvent(1);
    else if (e.key === '[') return jumpEvent(-1);
    else if (e.key === 'Home') t = 0;
    else return;
    e.preventDefault();
    render();
  });
  new ResizeObserver(resize).observe(canvas.parentElement!);

  load(0);
  resize();
  requestAnimationFrame(tick);
}
