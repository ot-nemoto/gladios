/**
 * 戦闘シミュレータ本体。Python 試作 sim_prototype.py（設計書 v3.43 時点）の忠実な移植。
 *
 * - 時間は固定刻み DT=0.005 秒で進める（試作と同じ）。
 * - 行動の決定（decide）は試作と同じ確認用の固定分岐で、作戦ルール（設計書 §7）はまだない。
 * - 乱数・時計・DOM を使わない。同じ入力からは必ず同じログが出る。
 *
 * ログの文言・数値の書式も試作と同一にしてあり、tests/sim-golden.test.ts で
 * Python の出力と1行ずつ突き合わせている。
 */
import {
  BLOCK_POSTURE,
  BLOCK_STAMINA,
  ARENA_HALF,
  CONDITIONS,
  DEFAULT_APPROACH_UNTIL,
  GAP_EPS,
  DT,
  HP_LOSS,
  INJ_PTS,
  KF,
  PARTS,
  PART_JP,
  PART_MOD,
  POSTURE_LOSS,
  REF_TOLERANCE,
  STAGE_ORDER,
  STAMINA_MAX,
  STANCE,
  STRENGTH_CORR,
  clampToArena,
  defenceSetId,
  kf,
  type Part,
  type ShieldName,
  type WeaponName,
} from './data';
import { HEAD_R, fkPoints, interpPose, regionsOf } from './body';
import { pyFixed, pyRound, pySigned } from './format';
import { classifyContact } from './contact';
import { segCircle, segObb, type Vec } from './geometry';
import { Glad, applyEquip, type ActionKind, type Policy } from './glad';
import {
  DETECTION_DELAY,
  actionTime,
  moveSpeed,
  holdTime,
  injuryDegree,
  judgmentDelay,
  readShift,
  stageOf,
  staminaStage,
  totalTimeMult,
} from './rules';
import { selectPart } from './select';
import { cos, radians, sin } from './trig';

export type GladId = 'A' | 'B';

export interface SimOptions {
  policies: Record<GladId, Policy>;
  cap?: number;
  /** 固定で使う攻撃一式（自動選択しない場合）。 */
  atkSets?: Partial<Record<GladId, string>>;
  /**
   * 攻撃しない側（ダミー）の接近先と、届く部位がないときの接近先（足裏の間隔、既定 1.40m）。
   * v3.44 以降、攻撃する側の間合いは一式の基準間合いで決まり、この値は効かない。
   */
  approachUntil?: number;
  /** 攻撃しない側。 */
  passive?: GladId[];
  /** 部位の自動選択に使う一式のパターン（例: gladius-slash-normal）。 */
  auto?: Partial<Record<GladId, string>>;
  armour?: Partial<Record<GladId, Partial<Record<Part, number>>>>;
  /** 盾押し：push = 押しのみ、mix = 相手の体勢が 50 未満になるまで押す。 */
  pushUsers?: Partial<Record<GladId, 'push' | 'mix'>>;
  equip?: Partial<Record<GladId, { weapon?: WeaponName; shield?: ShieldName | null }>>;
  /** 判断能力の上書き。 */
  judgment?: Partial<Record<GladId, number>>;
}

export interface Summary {
  winner: GladId | null;
  time: number;
  reason: '体力0' | '時間上限';
}


interface StartOpts {
  setId?: string | null;
  policy?: Policy;
  until?: number;
  holdStart?: number | null;
}

export class Sim {
  readonly a: Glad;
  readonly b: Glad;
  t = 0.0;
  readonly cap: number;
  readonly log: string[] = [];
  over = false;
  summary: Summary | null = null;

  private readonly policies: Record<GladId, Policy>;
  private readonly atkSets: Partial<Record<GladId, string>>;
  private readonly auto: Partial<Record<GladId, string>>;
  private readonly pushUsers: Partial<Record<GladId, 'push' | 'mix'>>;
  private readonly approachUntil: number;
  private readonly passive: ReadonlySet<string>;

  constructor(o: SimOptions) {
    const [sa, sb] = CONDITIONS.gladiators;
    this.a = new Glad(sa!);
    this.b = new Glad(sb!);
    for (const g of [this.a, this.b]) g.decisionAt = judgmentDelay(g);
    this.a.opp = this.b;
    this.b.opp = this.a;
    this.policies = o.policies;
    this.atkSets = o.atkSets ?? {};
    this.auto = o.auto ?? {};
    this.pushUsers = o.pushUsers ?? {};
    for (const [gid, ov] of Object.entries(o.armour ?? {})) Object.assign(this.glad(gid).armour, ov);
    for (const [gid, ov] of Object.entries(o.equip ?? {})) {
      const g = this.glad(gid);
      applyEquip(g, ov.weapon ?? g.weaponName, 'shield' in ov ? (ov.shield ?? null) : g.shieldName);
    }
    this.approachUntil = o.approachUntil ?? DEFAULT_APPROACH_UNTIL;
    this.passive = new Set(o.passive ?? []);
    this.cap = o.cap ?? 180.0;
    for (const [gid, base] of Object.entries(o.judgment ?? {})) this.glad(gid).judgmentBase = base;
  }

  private glad(id: string): Glad {
    return id === 'A' ? this.a : this.b;
  }

  private policyOf(g: Glad): Policy {
    return this.policies[g.id as GladId];
  }

  private ev(kind: string, msg: string): void {
    this.log.push(`[${pyFixed(this.t, 2).padStart(7)}] ${kind.padEnd(6)} ${msg}`);
  }

  // ---- 行動の開始 ----
  private startAction(g: Glad, kind: ActionKind, label: string, opts: StartOpts = {}): void {
    const mult = totalTimeMult(g);
    const setId = opts.setId ?? null;
    const holdStart = opts.holdStart ?? null;
    let cost: number;
    if (kind === 'attack') {
      cost = 7 * g.wweight * g.equipMult;
      const dur = actionTime('attack', { setId, weaponWeight: g.wweight, mult });
      const armDeg = injuryDegree(g, 'arm');
      const corr = setId ? (STRENGTH_CORR[setId.split('-')[2]!] ?? 0) : 0;
      const P = g.watk + corr - ([0, 5, 15, 30] as const)[armDeg];
      g.action = { kind, set: setId, start: this.t, dur, resolved: false, P, label, holdStart };
    } else if (kind === 'defence') {
      cost = 5 * g.equipMult;
      const dur = actionTime('defence', { mult, collapsed: g.collapsed });
      const policy = opts.policy ?? 'block';
      g.action = { kind, set: setId ?? 'defence-scutum-block', start: this.t, dur, label, policy };
      if (policy === 'deflect') {
        g.action.phase = 'enter';
        g.action.forHold = g.switchFor;
      }
    } else if (kind === 'push') {
      cost = 8 * g.equipMult;
      g.action = { kind, set: 'common-shield-push', start: this.t, dur: actionTime('push', { mult }), label, resolved: false };
    } else if (kind === 'postureRecovery') {
      cost = 3 * g.equipMult;
      g.action = { kind, set: 'common-posture-recovery', start: this.t, dur: actionTime('postureRecovery', { mult }), label };
    } else if (kind === 'approach' || kind === 'retreat') {
      // 相手へ寄る／離れる。目標の間隔まで続け、スタミナは進んだ距離に応じて step() で減らす
      cost = 0.0;
      g.action = {
        kind,
        set: kind === 'approach' ? 'common-advance-1m' : 'common-retreat-1m',
        start: this.t,
        dur: Infinity,
        label,
        travelled: 0.0,
        until: opts.until ?? this.approachUntil,
      };
    } else {
      cost = 0.0;
      g.action = { kind, set: null, start: this.t, dur: Infinity, label };
    }
    if (kind === 'attack' || kind === 'push') {
      const o = g.opp;
      const already = kind === 'attack' && holdStart !== null && o.switchFor === holdStart;
      if (!already && this.policyOf(o) !== 'none' && o.switchAt === null) {
        o.switchAt =
          this.t + DETECTION_DELAY + judgmentDelay(o) + (kind === 'attack' ? readShift(o, setId) : 0.0);
        if (kind === 'attack') o.switchFor = holdStart;
      }
    }
    g.stamina = Math.max(0.0, g.stamina - cost);
    this.ev('行動開始', `${g.id}: ${label}`);
  }

  /** 構えに入り（v3.35）、相手の反応の計時を構えの開始から始める（v3.40 案A）。 */
  private enterHold(g: Glad, setId: string, label: string): void {
    g.hold = { set: setId, label, until: this.t + holdTime(g), start: this.t };
    this.ev('行動開始', `${g.id}: 構え（${label}）`);
    const o = g.opp;
    if (this.policyOf(o) !== 'none' && o.switchAt === null) {
      o.switchAt = this.t + DETECTION_DELAY + judgmentDelay(o) + readShift(o, setId);
      o.switchFor = this.t;
    }
  }

  /**
   * v3.44：攻撃は一式の基準間合いから行う。間隔が基準間合い ± REF_TOLERANCE の外なら、
   * 先に移動する（遠ければ接近、近ければ距離を取る）。移動が終わったら作戦を再評価する。
   * 移動範囲の端に背を付けていて下がれないときは、今の間隔から攻撃する。
   */
  private moveOrHold(g: Glad, sid: string, label: string, prefix: string): void {
    const dist = Math.abs(g.opp.x - g.x);
    const refd = kf(sid).refDistance;
    if (refd !== undefined && Math.abs(dist - refd) > REF_TOLERANCE) {
      if (dist > refd) {
        this.startAction(g, 'approach', `${prefix}: 間合いまで接近する`, { until: refd });
        return;
      }
      if (g.x * g.facing > -ARENA_HALF + GAP_EPS) {
        // 下がる余地がある
        this.startAction(g, 'retreat', `${prefix}: 間合いまで距離を取る`, { until: refd });
        return;
      }
    }
    this.enterHold(g, sid, label);
  }

  // ---- 行動の決定（確認用の固定分岐。作戦ルールは未実装） ----
  private decide(g: Glad): void {
    const o = g.opp;
    const dist = Math.abs(o.x - g.x);
    const gid = g.id as GladId;
    if (g.posture < 50) {
      this.startAction(g, 'postureRecovery', 'ルール1: 体勢を立て直す');
    } else if (staminaStage(g)[0] === '枯渇') {
      this.startAction(g, 'wait', 'ルール2: 待機する');
    } else if (this.passive.has(g.id)) {
      // ルール3（遠ければ接近）は攻撃しない側だけ。攻撃する側の間合いは基準間合いに従う（v3.44）
      if (dist >= 1.5) this.startAction(g, 'approach', 'ルール3: 接近する');
      else this.startAction(g, 'wait', 'ダミー: 待機する（攻撃しない）');
    } else if (!g.collapsed) {
      const pushMode = this.pushUsers[gid];
      const pattern = this.auto[gid];
      if (pushMode && (pushMode === 'push' || o.posture >= 50)) {
        if (dist <= 1.1) this.startAction(g, 'push', '盾押し: 押し込み');
        else this.startAction(g, 'approach', '盾押し: 押し込む位置まで接近する', { until: 1.05 });
      } else if (pattern !== undefined) {
        const { part, scores } = selectPart(g, pattern);
        const detail = PARTS.map((p) => `${PART_JP[p]}=${scores[p] === null ? '届かない' : scores[p]}`).join(' ');
        if (part === null) {
          this.ev('選択', `${g.id}: 自動選択 [${detail}] → 届く部位なし、接近する`);
          this.startAction(g, 'approach', '自動選択: 届く位置まで接近する');
        } else {
          const methodJp = pattern.includes('-slash-') ? '斬る' : '突く';
          const label = `デフォルト: 通常攻撃（${methodJp}・${PART_JP[part]}）`;
          this.ev('選択', `${g.id}: 自動選択 [${detail}] → ${PART_JP[part]}`);
          this.moveOrHold(g, `${pattern}-${part}`, label, '自動選択');
        }
      } else {
        const sid = this.atkSets[gid] ?? 'gladius-slash-normal-torso';
        const part = sid.slice(sid.lastIndexOf('-') + 1) as Part;
        const label = `デフォルト: 通常攻撃（斬る・${PART_JP[part]}）`;
        this.moveOrHold(g, sid, label, '固定');
      }
    } else {
      this.startAction(g, 'wait', '体勢崩れ: 待機する');
    }
  }

  // ---- ステップごとの更新 ----
  private updatePose(g: Glad): void {
    const a = g.action;
    if (a === null || a.kind === 'wait') {
      g.pose = { ...STANCE };
      return;
    }
    if (a.kind === 'approach' || a.kind === 'retreat') {
      g.pose = interpPose(a.set!, a.travelled! % 1.0);
      return;
    }
    let tau = a.dur !== Infinity ? (this.t - a.start) / a.dur : 0.0;
    if (a.kind === 'defence' && a.phase) {
      if (a.phase === 'hold') tau = 0.5;
      else if (a.phase === 'exit') tau = 0.5 + (this.t - a.exitStart!) / a.dur;
    }
    g.poseTau = tau;
    g.pose = interpPose(a.set!, tau);
    if (a.kind === 'attack' && a.waOffset) g.pose.weaponAngle += a.waOffset;
  }

  private contactScan(atk: Glad): void {
    const a = atk.action;
    if (!a || a.kind !== 'attack' || a.resolved) return;
    // R1（v3.40）：接触判定は武器が動き始めた後から。開始姿勢の交差では解決しない
    if (this.t <= a.start) return;
    const dfn = atk.opp;
    const { regs } = regionsOf(dfn, dfn.pose);
    const Pa0 = fkPoints(atk, atk.pose);
    const w1 = Pa0.grip;
    const w2 = Pa0.tip;
    const dAct = dfn.action;
    const defending = dAct !== null && dAct.kind === 'defence';
    const hit = classifyContact(w1, w2, regs, {
      defending,
      progress: (this.t - a.start) / a.dur,
      shieldDown: a.shieldDown,
    });
    // 'bind'（R1b）：実行開始印より前の剣同士の接触は構え同士の触れ合いで、攻撃を解決しない
    if (hit === null || hit === 'bind') return;
    const guard = hit === 'shield' || hit === 'weapon';
    const deflecting = defending && dAct.policy === 'deflect';

    // 受け流しの判定（v3.42/v3.43）：最初の盾・武器への接触で、防御姿勢の進み具合から決める
    if (guard && deflecting && !a.deflectJudged) {
      a.deflectJudged = true;
      const set = a.set !== null ? KF.get(a.set) : undefined;
      if (set?.method === 'slash') {
        const tau = dfn.poseTau;
        const setAt = 0.5 - (dfn.techniqueBase - 50) * 0.001;
        const success = setAt <= tau && tau <= 0.85;
        const bad = tau < setAt / 2;
        if (success) {
          a.slide = true; // 下のそらし処理に進む
        } else if (bad && hit === 'shield' && set.strength === 'strong') {
          a.shieldDown = true;
          a.deflected = true;
          a.P! -= 20;
          dfn.stats.deflects += 1;
          this.ev(
            '接触',
            `${atk.id} の攻撃 → ${dfn.id} の盾が弾かれた（受け流しが大きく外れた、威力P=${pyFixed(a.P!, 0)}で継続）`,
          );
          return;
        } else {
          a.deflectFailed = true;
          this.ev('接触', `${atk.id} の攻撃 → ${dfn.id} の受け流しが合わない（盾が弾かれる）`);
        }
      }
      // 突きと判定失敗は、受け止めの処理へ進む
    }
    if (guard && deflecting && !a.deflected && a.slide) {
      // 受け流し（v3.13）：攻撃側の武器を身体から離れる方向へ 30 度回し、威力 -20、判定は継続
      const Pd = fkPoints(dfn, dfn.pose);
      const centre: Vec = [(Pd.hip[0] + Pd.sho[0]) / 2, (Pd.hip[1] + Pd.sho[1]) / 2];
      const Pa = fkPoints(atk, atk.pose);
      const g1 = Pa.grip;
      const tip = Pa.tip;
      const rot = (px: number, py: number, deg: number): Vec => {
        const r = radians(deg);
        const c = cos(r);
        const s = sin(r);
        return [g1[0] + (px - g1[0]) * c - (py - g1[1]) * s, g1[1] + (px - g1[0]) * s + (py - g1[1]) * c];
      };
      const tp = rot(tip[0], tip[1], 30);
      const tm = rot(tip[0], tip[1], -30);
      const dp0 = tp[0] - centre[0];
      const dp1 = tp[1] - centre[1];
      const dm0 = tm[0] - centre[0];
      const dm1 = tm[1] - centre[1];
      const worldRot = dp0 * dp0 + dp1 * dp1 >= dm0 * dm0 + dm1 * dm1 ? 30 : -30;
      a.waOffset = worldRot * atk.facing;
      a.deflected = true;
      a.P! -= 20;
      dfn.stats.deflects += 1;
      this.ev(
        '接触',
        `${atk.id} の攻撃 → ${dfn.id} が受け流した（武器を${pySigned(worldRot)}度そらし、威力P=${pyFixed(a.P!, 0)}に低下）`,
      );
      return;
    }
    a.resolved = true;
    const Patk = a.P!;
    const guardName = hit === 'shield' ? '盾' : '武器';
    if (guard && defending && dAct.policy === 'evade') {
      this.ev('接触', `${atk.id} の攻撃 → ${dfn.id} の盾に接触（回避中につき防御処理なし）`);
    } else if (guard) {
      if (a.slide) {
        // 受け流し成功後は衝撃なく滑り落ち、身体への接触の判定を続ける
        if (!a.slideLogged) {
          a.slideLogged = true;
          this.ev('接触', `${atk.id} の攻撃 → ${dfn.id} の${guardName}を滑り落ちた（衝撃なし）`);
        }
        a.resolved = false;
        return;
      }
      const defenceVal = hit === 'shield' ? dfn.shieldDef : dfn.wblock;
      const E = Patk - defenceVal;
      const st = stageOf(E);
      let eff = st;
      if (a.deflectFailed) eff = STAGE_ORDER[Math.min(3, STAGE_ORDER.indexOf(st) + 1)]!;
      dfn.posture = Math.max(0.0, dfn.posture - BLOCK_POSTURE[eff]);
      dfn.stamina = Math.max(0.0, dfn.stamina - BLOCK_STAMINA[eff]);
      if (eff === '軽微') atk.posture = Math.max(0.0, atk.posture - 10);
      dfn.stats.blocks += 1;
      atk.stats.blocked += 1;
      this.ev('接触', `${atk.id} の攻撃 → ${dfn.id} の${guardName}に接触`);
      this.ev(
        '結果',
        `受け止め: 衝撃E=${pyFixed(E, 0)} → ${st}。${dfn.id} 体勢-${BLOCK_POSTURE[eff]} スタミナ-${BLOCK_STAMINA[eff]}` +
          (eff !== st ? `（受け流し失敗で${eff}に悪化）` : '') +
          (eff === '軽微' ? '、攻撃側に反動 体勢-10' : ''),
      );
    } else {
      const part = hit as Part;
      const E = Patk - dfn.armour[part] + PART_MOD[part];
      const st = stageOf(E);
      const oldDeg = injuryDegree(dfn, part);
      dfn.hp -= HP_LOSS[st];
      dfn.injury[part] += INJ_PTS[st];
      dfn.posture = Math.max(0.0, dfn.posture - POSTURE_LOSS[st]);
      atk.stats.dealt += HP_LOSS[st];
      atk.stats.hits += 1;
      atk.stats.maxHit = Math.max(atk.stats.maxHit, HP_LOSS[st]);
      this.ev('接触', `${atk.id} の攻撃 → ${dfn.id} の${PART_JP[part]}に命中`);
      this.ev(
        '結果',
        `E=${pyFixed(E, 0)} → ${st}。${dfn.id} 体力-${HP_LOSS[st]}（残${pyFixed(Math.max(0, dfn.hp), 0)}） ` +
          `負傷点+${INJ_PTS[st]}（計${dfn.injury[part]}） 体勢-${POSTURE_LOSS[st]}`,
      );
      if (injuryDegree(dfn, part) !== oldDeg) {
        this.ev('状態変化', `${dfn.id} の${part}負傷が度合い${injuryDegree(dfn, part)}に悪化`);
      }
    }
  }

  private pushScan(g: Glad): void {
    const a = g.action;
    if (!a || a.kind !== 'push' || a.resolved) return;
    const dfn = g.opp;
    const { regs: regsA } = regionsOf(g, g.pose);
    if (!regsA.shield) return;
    const { centre, axis, halfLen } = regsA.shield;
    const s1: Vec = [centre[0] - axis[0] * halfLen, centre[1] - axis[1] * halfLen];
    const s2: Vec = [centre[0] + axis[0] * halfLen, centre[1] + axis[1] * halfLen];
    const { regs: d } = regionsOf(dfn, dfn.pose);
    const contact =
      (d.shield !== undefined && segObb(s1, s2, d.shield)) ||
      d.arm.some((b) => segObb(s1, s2, b)) ||
      d.leg.some((b) => segObb(s1, s2, b)) ||
      segObb(s1, s2, d.torso) ||
      segCircle(s1, s2, d.head, HEAD_R + 0.04);
    if (!contact) return;
    a.resolved = true;
    const dAct = dfn.action;
    if (dAct && dAct.kind === 'defence' && dAct.policy === 'evade') {
      this.ev('接触', `${g.id} の押し込み → ${dfn.id} は回避中（押しは空振り）`);
      return;
    }
    const blocking = dAct !== null && dAct.kind === 'defence' && dAct.policy === 'block';
    const loss = blocking ? 15 : 25;
    dfn.posture = Math.max(0.0, dfn.posture - loss);
    const oldX = dfn.x;
    dfn.x = clampToArena(dfn.x - dfn.facing * 0.5);
    this.ev('接触', `${g.id} の盾が ${dfn.id} に接触（押し込み）`);
    this.ev(
      '結果',
      `押し込み成立: ${dfn.id} 体勢-${loss}（${blocking ? '受け止め中' : '通常'}）、` +
        `${pyFixed(Math.abs(dfn.x - oldX), 1)}m後退`,
    );
  }

  /** 受け流しの保持（v3.43）：きっかけの攻撃がまだ生きているか。 */
  private triggerLive(g: Glad, forHold: number | null | undefined): boolean {
    if (forHold === null || forHold === undefined) return false;
    const oh = g.opp.hold;
    if (oh !== null && oh.start === forHold) return true;
    const oa = g.opp.action;
    return oa !== null && oa.kind === 'attack' && oa.holdStart === forHold && !oa.resolved && !oa.deflected;
  }

  step(): void {
    const t = this.t;
    for (const g of [this.a, this.b]) {
      // 構えの期限：予定の攻撃を開始し、以後は切り替えない
      if (g.hold !== null && t >= g.hold.until) {
        const h = g.hold;
        g.hold = null;
        g.switchAt = null;
        this.startAction(g, 'attack', h.label, { setId: h.set, holdStart: h.start });
      }
      // 予定された防御への切り替え（未開始の状態からのみ）
      if (g.switchAt !== null && t >= g.switchAt) {
        g.switchAt = null;
        if (g.action && (g.action.kind === 'attack' || g.action.kind === 'defence')) {
          this.ev('状態変化', `${g.id}: 防御に切り替えられず（行動開始済み）`);
        } else {
          const prev = g.hold ? '構え' : g.action ? g.action.kind : '待機中';
          g.hold = null;
          g.action = null;
          const pol = this.policyOf(g);
          if (pol === 'evade') {
            g.stats.evades += 1;
            g.evadeFor = g.switchFor;
          }
          const dset = defenceSetId(g.shieldName, pol);
          const dlabel = pol === 'evade' ? '回避する' : pol === 'deflect' ? '受け流す' : '受け止める';
          this.startAction(g, 'defence', `防御に切替: ${dlabel}（${prev}から）`, { setId: dset, policy: pol });
        }
      }
      // 受け流しの姿勢保持（v3.43）：整える → 保持 → 戻る → 完了
      let a = g.action;
      if (a && a.kind === 'defence' && a.phase) {
        const live = this.triggerLive(g, a.forHold);
        if (a.phase === 'enter' && t >= a.start + a.dur / 2) {
          a.phase = live ? 'hold' : 'exit';
          if (a.phase === 'exit') a.exitStart = t;
        } else if (a.phase === 'hold' && (!live || t - a.start > a.dur + 1.5)) {
          a.phase = 'exit';
          a.exitStart = t;
        } else if (a.phase === 'exit' && t >= a.exitStart! + a.dur / 2) {
          g.action = null;
          g.decisionAt = t + judgmentDelay(g);
        }
      }
      // 行動の完了
      a = g.action;
      if (a && !a.phase && a.dur !== Infinity && t >= a.start + a.dur) {
        if (a.kind === 'postureRecovery') {
          g.posture = Math.min(100.0, g.posture + 30);
          this.ev('結果', `${g.id}: 体勢を立て直した（体勢${pyFixed(g.posture, 0)}）`);
        }
        if (a.kind === 'attack' && !a.resolved) {
          const strength = a.set !== null ? (KF.get(a.set)?.strength ?? 'normal') : 'normal';
          const whiffCost = strength === 'strong' ? 20 : 10;
          if (a.deflected) {
            g.posture = Math.max(0.0, g.posture - whiffCost);
            this.ev('結果', `${g.id}: 受け流されて空振り（体勢-${whiffCost}）`);
          } else if (g.opp.evadeFor !== null && g.opp.evadeFor === (a.holdStart ?? null)) {
            g.posture = Math.max(0.0, g.posture - whiffCost);
            this.ev('結果', `${g.id}: 回避されて空振り（体勢-${whiffCost}）`);
          } else {
            this.ev('結果', `${g.id}: 攻撃は空振り（接触なし）`);
          }
        }
        if (a.kind === 'push' && !a.resolved) this.ev('結果', `${g.id}: 押し込みは空振り（接触なし）`);
        g.action = null;
        g.decisionAt = t + judgmentDelay(g);
      }
      // 継続行動の終了
      if (g.action && g.action.kind === 'approach' && Math.abs(g.opp.x - g.x) <= g.action.until! + GAP_EPS) {
        g.action = null;
        g.decisionAt = t + judgmentDelay(g);
      }
      if (
        g.action &&
        g.action.kind === 'retreat' &&
        (Math.abs(g.opp.x - g.x) >= g.action.until! - GAP_EPS || g.x * g.facing <= -ARENA_HALF)
      ) {
        // 目標の間隔に達した、または移動範囲の端に背を付けた
        g.action = null;
        g.decisionAt = t + judgmentDelay(g);
      }
      if (g.action && g.action.kind === 'wait' && staminaStage(g)[0] !== '枯渇') {
        g.action = null;
        g.decisionAt = t + judgmentDelay(g);
      }
      // 行動の決定
      if (g.action === null && g.hold === null && t >= g.decisionAt && !this.over) this.decide(g);
      // 移動
      if (g.action && (g.action.kind === 'approach' || g.action.kind === 'retreat')) {
        const a = g.action;
        const gap = Math.abs(g.opp.x - g.x);
        // v3.44：目標の間隔を越えずに止まる
        let stepLen: number;
        let newX: number;
        if (a.kind === 'approach') {
          stepLen = Math.min(moveSpeed(g) * DT, Math.max(0.0, gap - 0.35), Math.max(0.0, gap - a.until!));
          newX = g.x + g.facing * stepLen;
        } else {
          const want = Math.min(moveSpeed(g) * DT, Math.max(0.0, a.until! - gap));
          newX = clampToArena(g.x - g.facing * want);
          stepLen = Math.abs(newX - g.x);
        }
        g.x = newX;
        a.travelled! += stepLen;
        g.stamina = Math.max(0.0, g.stamina - stepLen * 2 * g.equipMult);
      }
      // 行動していない間の回復
      if (g.action === null) {
        g.stamina = Math.min(STAMINA_MAX, g.stamina + 5 * DT);
        g.posture = Math.min(100.0, g.posture + 10 * DT);
      }
      if (g.action && g.action.kind === 'wait') {
        const rec = 10 * ([1.0, 0.8, 0.6, 0.4] as const)[injuryDegree(g, 'torso')];
        g.stamina = Math.min(STAMINA_MAX, g.stamina + rec * DT);
        g.posture = Math.min(100.0, g.posture + 10 * DT);
      }
      // 体勢崩れの出入り
      if (g.posture <= 0 && !g.collapsed) {
        g.collapsed = true;
        this.ev('状態変化', `${g.id}: 体勢崩れ（体勢0）`);
      }
      if (g.collapsed && g.posture >= 50) {
        g.collapsed = false;
        this.ev('状態変化', `${g.id}: 体勢崩れから回復`);
      }
      this.updatePose(g);
    }
    // 接触（両方向）
    this.contactScan(this.a);
    this.contactScan(this.b);
    this.pushScan(this.a);
    this.pushScan(this.b);
    // スタミナ段階の変化
    for (const g of [this.a, this.b]) {
      const st = staminaStage(g)[0];
      if (g.lastStaminaStage !== null && g.lastStaminaStage !== st) {
        this.ev('状態変化', `${g.id}: スタミナ段階が「${st}」に変化（残${pyFixed(g.stamina, 0)}）`);
      }
      g.lastStaminaStage = st;
    }
    // 終了条件
    for (const g of [this.a, this.b]) {
      if (g.hp <= 0 && !this.over) {
        this.over = true;
        const winner = g.opp;
        this.ev('終了', `${g.id} の体力が0。勝者 ${winner.id}（経過 ${pyFixed(t, 2)}秒）`);
        this.summary = { winner: winner.id as GladId, time: pyRound(t, 2), reason: '体力0' };
      }
    }
    if (t >= this.cap && !this.over) {
      this.over = true;
      this.ev('終了', `時間上限 ${pyFixed(this.cap, 0)}秒に到達。決着せず（確認用の打ち切り）`);
      this.summary = { winner: null, time: pyRound(t, 2), reason: '時間上限' };
    }
  }

  run(): { log: string[]; summary: Summary } {
    while (!this.over) {
      this.step();
      this.t += DT;
    }
    return { log: this.log, summary: this.summary! };
  }
}
