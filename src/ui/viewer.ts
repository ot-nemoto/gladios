/**
 * 戦闘ビューア：確認用シナリオを選び、再演した戦闘を再生・一時停止・シークする。
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
import { staminaStageName } from './labels';

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

  scenarios.forEach((s, i) => scenarioSel.add(new Option(s.name, String(i))));
  SPEEDS.forEach((s) => speedSel.add(new Option(`×${s}`, String(s), s === 1, s === 1)));

  let rec: Recording;
  let t = 0;
  let playing = false;
  let lastTs: number | null = null;
  let logItems: HTMLLIElement[] = [];
  let currentLog = -1;

  const endTime = () => rec.frames[rec.frames.length - 1]!.t;

  function load(i: number): void {
    rec = record(scenarios[i]!.options);
    t = 0;
    seek.max = String(endTime());
    const s = rec.summary;
    summaryEl.textContent =
      s.winner === null
        ? s.reason === '相打ち'
          ? `結果: 相打ち（両者の体力0、引き分け、${s.time.toFixed(2)}秒）`
          : `結果: 決着せず（${s.reason}、${s.time.toFixed(2)}秒）`
        : `結果: ${s.winner} の勝ち（${s.reason === '体力0' ? `${s.winner === 'A' ? 'B' : 'A'} の体力0` : s.reason}、${s.time.toFixed(2)}秒）`;
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

  scenarioSel.addEventListener('change', () => load(Number(scenarioSel.value)));
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
