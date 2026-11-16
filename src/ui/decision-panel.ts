/**
 * 戦闘ビューアの「判断」パネル（#33）：剣闘士ごとに、今の段階・最後の判断の過程・
 * 狙いの決め方・間合い・相手への反応の予定を表示する。記録（Recording）を読むだけ。
 */
import {
  DUMMY_APPROACH_FROM,
  KF,
  MIX_PUSH_WHILE,
  PARTS,
  PART_JP,
  PART_TIE_ORDER,
  PUSH_REACH,
  RECOVER_BELOW,
  type Part,
} from '../sim/data';
import { lastDecision, lastReaction, reactionStarting, type GladStatus, type Recording } from '../sim/record';
import { attackLabel, type GladId } from '../sim/sim';
import type { Decision, DecisionFacts, ReactionPlan, RuleEval, RuleId } from '../sim/trace';
import { POLICY_JP, patternLabel } from './settings';

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const sec = (x: number): string => `${x.toFixed(2)}秒`;
const m = (x: number): string => `${x.toFixed(2)}m`;
const pct = (x: number): string => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

const RESULT_MARK: Record<RuleEval['result'], string> = { matched: '✓', unmatched: '✗', notReached: '–' };
const RESULT_JP: Record<RuleEval['result'], string> = { matched: '当てはまる', unmatched: '外れ', notReached: '見ていない' };
const EXPOSURE_JP = ['盾が先', '腕が先', '防具のみ', '露出'] as const;

function setName(set: string | null): string {
  if (set === null) return '';
  return KF.get(set)?.kind === 'attack' ? attackLabel(set).replace(/^デフォルト: /, '') : set;
}

/** 今の段階。 */
export function statusText(st: GladStatus, t: number): string {
  switch (st.kind) {
    case 'idle':
      return st.decideAt > t ? `次の判断まで ${sec(st.decideAt - t)}（判断の遅れ）` : '判断する';
    case 'hold':
      return `構え：${setName(st.set)}。振り始めまで ${sec(Math.max(0, st.until - t))}`;
    case 'approach':
      return `接近中：間隔 ${m(st.gap)} → ${m(st.target)}（残り ${m(Math.max(0, st.gap - st.target))}）`;
    case 'retreat':
      return `距離を取っている：間隔 ${m(st.gap)} → ${m(st.target)}（残り ${m(Math.max(0, st.target - st.gap))}）`;
    case 'attack':
      return `攻撃：${setName(st.set)}。${st.stage ?? ''} ${pct(st.progress)}（全体 ${sec(st.dur)}）`;
    case 'defence': {
      const phase = st.phase === 'enter' ? '・整える' : st.phase === 'hold' ? '・保持' : st.phase === 'exit' ? '・戻る' : '';
      return `防御（${POLICY_JP[st.policy]}${phase}）${st.phase === 'hold' ? '' : ` ${pct(st.progress)}`}`;
    }
    case 'push':
      return `盾の押し込み ${pct(st.progress)}`;
    case 'postureRecovery':
      return `体勢を立て直している ${pct(st.progress)}`;
    case 'wait':
      return '待機（回復）';
  }
}

/** ルールの名前・条件・判断時点の値（しきい値は判定と同じ定数から）。 */
export function ruleText(id: RuleId, f: DecisionFacts): { name: string; condition: string; value: string } {
  const gap = `間隔 ${m(f.gap)}`;
  switch (id) {
    case 'recover':
      return { name: 'ルール1: 体勢を立て直す', condition: `体勢 < ${RECOVER_BELOW}`, value: `体勢 ${f.posture.toFixed(1)}` };
    case 'exhausted':
      return {
        name: 'ルール2: 待機する',
        condition: 'スタミナ段階が「枯渇」',
        value: `スタミナ ${f.stamina.toFixed(1)}（${f.staminaStage}）`,
      };
    case 'dummyApproach':
      return { name: 'ルール3: 接近する', condition: `攻撃しない側で、間隔 ≥ ${m(DUMMY_APPROACH_FROM)}`, value: gap };
    case 'dummyWait':
      return { name: 'ダミー: 待機する', condition: '攻撃しない側', value: '攻撃しない' };
    case 'collapsed':
      return { name: '体勢崩れ: 待機する', condition: '体勢崩れ中', value: f.collapsed ? '体勢崩れ' : '崩れていない' };
    case 'push': {
      const reach = `${gap}（押せるのは ${m(PUSH_REACH)} 以内）`;
      return f.push === 'mix'
        ? {
            name: '盾押し（押し＋攻撃）',
            condition: `相手の体勢 ≥ ${MIX_PUSH_WHILE}`,
            value: `相手の体勢 ${f.oppPosture.toFixed(1)}、${reach}`,
          }
        : { name: '盾押し（押しのみ）', condition: 'なし（常に押す）', value: reach };
    }
    case 'attack':
      return {
        name: 'デフォルト: 攻撃',
        condition: 'なし（常に当てはまる）',
        value:
          f.attack.kind === 'auto'
            ? `自動選択（${patternLabel(f.attack.pattern)}、部位は自動）`
            : `固定（${setName(f.attack.set)}）`,
      };
  }
}

function rulesHtml(d: Decision): string {
  return d.rules
    .map((r) => {
      const { name, condition, value } = ruleText(r.id, d.facts);
      return `<li class="rule rule-${r.result}" title="${RESULT_JP[r.result]}">
        <span class="mark">${RESULT_MARK[r.result]}</span>
        <span class="rule-name">${esc(name)}</span>
        <span class="rule-cond">${esc(condition)}</span>
        <span class="rule-val">${r.result === 'notReached' ? '' : esc(value)}</span>
      </li>`;
    })
    .join('');
}

function selectHtml(d: Decision): string {
  const s = d.select;
  if (!s) return '';
  const rows = PARTS.map((p: Part) => {
    const score = s.scores[p];
    const tm = s.terms[p];
    if (score === null || tm === null) {
      return `<tr class="unreach"><th>${PART_JP[p]}</th><td colspan="4">届かない</td></tr>`;
    }
    return `<tr class="${s.part === p ? 'chosen' : ''}"><th>${PART_JP[p]}</th>
      <td>${tm.exposure}（${EXPOSURE_JP[tm.exposure as 0 | 1 | 2 | 3]}）</td><td>${tm.compat}</td><td>${tm.injury}</td><td class="num">${score}</td></tr>`;
  }).join('');
  const result = s.part === null ? '届く部位なし → 接近する' : `→ ${PART_JP[s.part]}`;
  return `<h3>狙いの決め方 <span class="muted">自動選択・${esc(patternLabel(s.pattern))}</span></h3>
    <div class="table-wrap"><table class="scores">
      <thead><tr><th>部位</th><th>防御の薄さ×100</th><th>相性×10</th><th>負傷</th><th>点数</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="note">${result}。点数の高い部位を狙う（同点なら ${PART_TIE_ORDER.map((p) => PART_JP[p]).join('＞')}）。各部位は、その一式の基準間合いに立った場合で採点する。</p>`;
}

function spacingHtml(d: Decision, gapNow: number): string {
  const sp = d.spacing;
  if (!sp) return '';
  const what =
    sp.move === 'approach'
      ? '遠い → 間合いまで寄る'
      : sp.move === 'retreat'
        ? '近い → 間合いまで下がる'
        : sp.move === 'wall'
          ? '近いが、移動範囲の端で下がれない → そのまま構える'
          : sp.move === 'noRef'
            ? '基準間合いがない → そのまま構える'
            : '間合いの内 → そのまま構える';
  const ref = sp.ref === null ? 'なし' : `${m(sp.ref)} ± ${m(sp.tolerance)}`;
  return `<h3>間合い</h3>
    <p>判断時の間隔 ${m(sp.gap)}、基準間合い ${ref}（${esc(setName(sp.setId))}）<br>${what}</p>
    <p class="muted">今の間隔 ${m(gapNow)}</p>`;
}

function reactionHtml(plan: ReactionPlan | null, t: number, policyNone: boolean): string {
  if (policyNone) return '<p class="muted">防御の方針なし：相手の攻撃に反応しない</p>';
  if (plan === null) return '<p class="muted">まだ相手の攻撃の気配はない</p>';
  const breakdown = `検知 ${sec(plan.detect)} ＋ 判断 ${sec(plan.judgment)}${plan.read !== 0 ? ` ＋ 読み ${plan.read > 0 ? '' : '−'}${sec(Math.abs(plan.read))}` : ''}`;
  const head = `相手の「${esc(plan.cause)}」を ${sec(plan.t)} に見た`;
  // 予定の結果はあとで書き足されるので、結果が決まった時刻より前は「予定」として見せる
  if (plan.settledAt === undefined || plan.settledAt > t) {
    return `<p>${head}<br>→ <b>${sec(plan.at)}</b> に${POLICY_JP[plan.policy]}へ切り替える予定（あと ${sec(Math.max(0, plan.at - t))}）</p>
      <p class="muted">${breakdown}</p>`;
  }
  const outcome =
    plan.outcome === 'switched'
      ? `${sec(plan.settledAt)} に${POLICY_JP[plan.policy]}へ切り替えた`
      : plan.outcome === 'tooLate'
        ? `${sec(plan.settledAt)} の時点で自分の行動が始まっていて、切り替えられなかった`
        : `${sec(plan.settledAt)} に自分の構えが先に攻撃になり、切り替えを取りやめた`;
  return `<p class="muted">直前の反応：${head}<br>→ ${outcome}（${breakdown}）</p>`;
}

/** 剣闘士 id の判断パネルの中身（フレーム k の時点）。 */
export function decisionPanelHtml(rec: Recording, id: GladId, k: number, policyNone: boolean): string {
  const f = rec.frames[k]!;
  const g = f[id];
  const opp = f[id === 'A' ? 'B' : 'A'];
  const d = lastDecision(rec, id, f.t);
  const plan = lastReaction(rec, id, f.t);
  const decision = d
    ? `<h3>判断の過程 <span class="muted">${sec(d.t)}（${sec(f.t - d.t)}前）</span></h3>
       <ol class="rules">${rulesHtml(d)}</ol>
       <p class="chosen-action">→ ${esc(d.action)}</p>
       ${selectHtml(d)}${spacingHtml(d, Math.abs(opp.x - g.x))}`
    : '<h3>判断の過程</h3><p class="muted">最初の判断の前（判断の遅れ）</p>';
  // 防御は判断ではなく相手への反応で始まるので、きっかけを添える
  // （防御中に相手が次の構えに入ると新しい予定が立つので、最後の予定ではなく、この防御を始めた予定を引く）
  const cause = g.status.kind === 'defence' ? reactionStarting(rec, id, g.status.start) : null;
  const trigger = cause ? `<p class="muted">きっかけ：相手の「${esc(cause.cause)}」</p>` : '';
  return `<h2 class="who who-${id}">${id} の判断</h2>
    <h3>今の段階</h3><p class="status">${esc(statusText(g.status, f.t))}</p>${trigger}
    ${decision}
    <h3>相手への反応</h3>${reactionHtml(plan, f.t, policyNone)}`;
}
