import tadalaImage from "./assets/scene/tadala.png";
import marcusImage from "./assets/scene/marcus-marius-avitus.png";
import bereniceImage from "./assets/scene/berenice.png";
import cassiaImage from "./assets/scene/cassia.png";
import goldHildrImage from "./assets/scene/gold-hildr.png";
import vlattiaImage from "./assets/scene/vlattia.png";
import spataliaImage from "./assets/scene/spatalia.png";
import krimharthImage from "./assets/scene/krimharth.png";
import branthocImage from "./assets/scene/branthoc.png";
import tukhorisImage from "./assets/scene/tukhoris.png";
import kasosImage from "./assets/scene/kasos.png";
import thalesImage from "./assets/scene/thales.png";
import khnubaImage from "./assets/scene/khnuba.png";
import medocusImage from "./assets/scene/medocus.png";
import gaiusImage from "./assets/scene/gaius-pontidius-stolo.png";
import salomonImage from "./assets/scene/salomon.png";
import ambillusImage from "./assets/scene/ambillus.png";
import seaImage from "./assets/scene/sea.webp";
import snowfieldImage from "./assets/scene/snowfield.png";
import meadowImage from "./assets/scene/meadow.png";
import forestImage from "./assets/scene/forest.webp";
import marshImage from "./assets/scene/marsh.webp";
import mountainImage from "./assets/scene/mountain.webp";
import townImage from "./assets/scene/town.webp";
import caveImage from "./assets/scene/cave.png";

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
  { id: "berenice", name: "BERENICE", src: bereniceImage },
  { id: "cassia", name: "CASSIA", src: cassiaImage },
  { id: "gold-hildr", name: "GOLD HILDR", src: goldHildrImage },
  { id: "vlattia", name: "VLATTIA", src: vlattiaImage },
  { id: "spatalia", name: "SPATALIA", src: spataliaImage },
  { id: "krimharth", name: "KRIMHARTH", src: krimharthImage },
  { id: "branthoc", name: "BRANTHOC", src: branthocImage },
  { id: "tukhoris", name: "TUKHORIS", src: tukhorisImage },
  { id: "kasos", name: "KASOS", src: kasosImage },
  { id: "thales", name: "THALES", src: thalesImage },
  { id: "khnuba", name: "KHNUBA", src: khnubaImage },
  { id: "medocus", name: "MEDOCUS", src: medocusImage },
  { id: "gaius-pontidius-stolo", name: "GAIUS PONTIDIUS STOLO", src: gaiusImage },
  { id: "salomon", name: "SALOMON", src: salomonImage },
  { id: "ambillus", name: "AMBILLUS", src: ambillusImage },
];

/** 512×512の背景。 */
export const backgrounds: readonly SceneItem[] = [
  { id: "sea", name: "海", src: seaImage },
  { id: "snowfield", name: "雪原", src: snowfieldImage },
  { id: "meadow", name: "草原", src: meadowImage },
  { id: "forest", name: "森", src: forestImage },
  { id: "marsh", name: "湿地", src: marshImage },
  { id: "mountain", name: "山", src: mountainImage },
  { id: "town", name: "街", src: townImage },
  { id: "cave", name: "洞窟", src: caveImage },
];
