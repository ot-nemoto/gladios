import tadalaImage from "./assets/scene/tadala.png";
import marcusImage from "./assets/scene/marcus-marius-avitus.png";
import seaImage from "./assets/scene/sea.webp";
import snowfieldImage from "./assets/scene/snowfield.png";

/** 合成の出力サイズ。キャラ・背景とも同じ大きさの素材を重ねる。 */
export const sceneSize = 512;

export interface SceneItem {
  id: string;
  name: string;
  src: string;
}

/** 背景透過の512×512キャラ。 */
export const characters: readonly SceneItem[] = [
  { id: "tadala", name: "TADALA", src: tadalaImage },
  { id: "marcus-marius-avitus", name: "MARCUS MARIUS AVITUS", src: marcusImage },
];

/** 512×512の背景。 */
export const backgrounds: readonly SceneItem[] = [
  { id: "sea", name: "海", src: seaImage },
  { id: "snowfield", name: "雪原", src: snowfieldImage },
];
