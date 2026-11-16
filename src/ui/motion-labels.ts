/** モーション図鑑の表示用の名前（判定には使わない）。 */
import { METHOD_JP, PART_JP, STRENGTH_JP, type KeyframeSet, type ShieldName, type WeaponName } from '../sim/data';
import { defenceOf, type ContactTarget, type OpponentPose } from '../sim/motion';

export const WEAPON_JP: Record<WeaponName, string> = {
  gladius: 'グラディウス',
  sica: 'スィカ',
  pugio: 'プギオ',
  trident: 'トライデント',
  hasta: 'ハスタ',
};
export const SHIELD_JP: Record<ShieldName | 'none', string> = {
  scutum: 'スクートゥム',
  parmula: 'パルムラ',
  small: '小盾',
  none: '盾なし',
};
export const CONTACT_JP: Record<ContactTarget, string> = { ...PART_JP, shield: '盾', weapon: '武器' };
export const OPPONENT_POSE_JP: Record<OpponentPose, string> = {
  stance: '構え',
  block: '受け止め（防御姿勢）',
  deflect: '受け流し（防御姿勢）',
  evade: '回避（防御姿勢）',
};

const POLICY_JP: Record<string, string> = { block: '受け止め', deflect: '受け流し', evade: '回避' };
const COMMON_JP: Record<string, string> = {
  'common-advance-1m': '接近（1m）',
  'common-retreat-1m': '距離を取る（1m）',
  'common-posture-recovery': '体勢を立て直す',
  'common-shield-push': '盾の押し込み',
};

/** 一式の日本語名。 */
export function setLabel(set: KeyframeSet): string {
  if (set.kind === 'attack') {
    return [
      WEAPON_JP[set.weapon as WeaponName],
      METHOD_JP[set.method!],
      STRENGTH_JP[set.strength!],
      PART_JP[set.part as keyof typeof PART_JP],
    ].join('・');
  }
  const d = defenceOf(set);
  if (d) return `${SHIELD_JP[d.shield ?? 'none']}・${POLICY_JP[d.policy] ?? d.policy}`;
  return COMMON_JP[set.id] ?? set.id;
}

/** 一覧のまとまり（攻撃は武器ごと）。 */
export function groupOf(set: KeyframeSet): string {
  if (set.kind === 'attack') return `攻撃：${WEAPON_JP[set.weapon as WeaponName]}`;
  if (set.kind === 'defence') return '防御';
  return '共通';
}

/** キーフレームの名前（作成標準 §5.4.2：攻撃 5、防御 3）。 */
export function keyframeNames(set: KeyframeSet): string[] {
  const n = set.keyframes.length;
  if (set.kind === 'attack' && n === 5) {
    return ['開始', '予備完了', set.method === 'thrust' ? '突き中間' : '振り中間', '到達想定', '終了'];
  }
  if (set.id === 'common-shield-push' && n === 5) return ['開始', '予備完了', '押し中間', '到達想定', '終了'];
  if (set.kind === 'defence' && n === 3) return ['開始', '防御姿勢', '終了'];
  return set.keyframes.map((_, i) => (i === 0 ? '開始' : i === n - 1 ? '終了' : `中間${i}`));
}
