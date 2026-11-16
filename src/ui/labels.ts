/** 表示用の名前。段階の境界は判定側（src/sim/rules.ts）と共有する。 */
import { staminaStageOf } from '../sim/rules';

export const staminaStageName = (stamina: number): string => staminaStageOf(stamina)[0];
