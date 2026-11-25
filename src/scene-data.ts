import tadalaImage from "./assets/scene/tadala.webp";
import marcusImage from "./assets/scene/marcus-marius-avitus.webp";
import bereniceImage from "./assets/scene/berenice.webp";
import cassiaImage from "./assets/scene/cassia.webp";
import goldHildrImage from "./assets/scene/gold-hildr.webp";
import vlattiaImage from "./assets/scene/vlattia.webp";
import spataliaImage from "./assets/scene/spatalia.webp";
import krimharthImage from "./assets/scene/krimharth.webp";
import branthocImage from "./assets/scene/branthoc.webp";
import tukhorisImage from "./assets/scene/tukhoris.webp";
import kasosImage from "./assets/scene/kasos.webp";
import thalesImage from "./assets/scene/thales.webp";
import khnubaImage from "./assets/scene/khnuba.webp";
import medocusImage from "./assets/scene/medocus.webp";
import gaiusImage from "./assets/scene/gaius-pontidius-stolo.webp";
import salomonImage from "./assets/scene/salomon.webp";
import ambillusImage from "./assets/scene/ambillus.webp";
import eathyrossImage from "./assets/scene/eathyross.webp";
import akiliasImage from "./assets/scene/akilias.webp";
import igraineImage from "./assets/scene/igraine.webp";
import owainImage from "./assets/scene/owain.webp";
import ignatiusImage from "./assets/scene/ignatius.webp";
import godfireyImage from "./assets/scene/godfirey.webp";
import galeronImage from "./assets/scene/galeron.webp";
import enochImage from "./assets/scene/enoch.webp";
import elijahImage from "./assets/scene/elijah.webp";
import andrewImage from "./assets/scene/andrew.webp";
import adalricImage from "./assets/scene/adalric.webp";
import gwendolynneHeavensbrandImage from "./assets/scene/gwendolynne-heavensbrand.webp";
import seaImage from "./assets/scene/sea.webp";
import snowfieldImage from "./assets/scene/snowfield.webp";
import meadowImage from "./assets/scene/meadow.webp";
import forestImage from "./assets/scene/forest.webp";
import marshImage from "./assets/scene/marsh.webp";
import mountainImage from "./assets/scene/mountain.webp";
import townImage from "./assets/scene/town.webp";
import caveImage from "./assets/scene/cave.webp";
import pineGoldCloudsImage from "./assets/scene/pine-gold-clouds.webp";
import cranesSeigaihaImage from "./assets/scene/cranes-seigaiha.webp";
import sakuraGoldScreenImage from "./assets/scene/sakura-gold-screen.webp";
import bambooGoldMoonImage from "./assets/scene/bamboo-gold-moon.webp";
import plumGoldSnowImage from "./assets/scene/plum-gold-snow.webp";
import fujiGoldCloudsImage from "./assets/scene/fuji-gold-clouds.webp";
import koiWaterfallImage from "./assets/scene/koi-waterfall.webp";
import mapleGoldStreamImage from "./assets/scene/maple-gold-stream.webp";
import cathedralRoseWindowImage from "./assets/scene/cathedral-rose-window.webp";
import gothicPointedArchImage from "./assets/scene/gothic-pointed-arch.webp";
import medievalGrisailleImage from "./assets/scene/medieval-grisaille.webp";
import cathedralNightImage from "./assets/scene/cathedral-night.webp";
import wisteriaDragonfliesImage from "./assets/scene/wisteria-dragonflies.webp";
import roseGardenArchImage from "./assets/scene/rose-garden-arch.webp";
import seaSailingShipsImage from "./assets/scene/sea-sailing-ships.webp";
import celticKnotImage from "./assets/scene/celtic-knot.webp";
import peacockFeathersImage from "./assets/scene/peacock-feathers.webp";
import grapesAutumnLeavesImage from "./assets/scene/grapes-autumn-leaves.webp";
import lotusWaterImage from "./assets/scene/lotus-water.webp";
import constellationRingImage from "./assets/scene/constellation-ring.webp";

/** 合成の出力サイズ。キャラ・背景とも同じ大きさの素材を重ねる。 */
export const sceneSize = 512;

export interface SceneItem {
  id: string;
  name: string;
  /** 合成と保存に使う512×512の元画像。 */
  src: string;
}

/** 選択欄のサムネイルの一辺（px）。元画像を縮小した `thumbs/<id>.webp` を使う。 */
export const thumbSize = 256;

const thumbs = import.meta.glob<string>("./assets/scene/thumbs/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/**
 * 選択欄に表示する縮小画像のURL。素材を追加・差し替えたら縮小画像も用意する（引き継ぎ資料を参照）。
 * 縮小画像がなくてもページ全体は止めず、元画像で表示してコンソールに知らせる。
 */
export function thumbOf(item: SceneItem): string {
  const url = thumbs[`./assets/scene/thumbs/${item.id}.webp`];
  if (url) return url;
  console.error(`Missing scene thumbnail: ${item.id}`);
  return item.src;
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
  { id: "eathyross", name: "EATHYROSS", src: eathyrossImage },
  { id: "akilias", name: "AKILIAS", src: akiliasImage },
  { id: "igraine", name: "IGRAINE", src: igraineImage },
  { id: "owain", name: "OWAIN", src: owainImage },
  { id: "ignatius", name: "IGNATIUS", src: ignatiusImage },
  { id: "godfirey", name: "GODFIREY", src: godfireyImage },
  { id: "galeron", name: "GALERON", src: galeronImage },
  { id: "enoch", name: "ENOCH", src: enochImage },
  { id: "elijah", name: "ELIJAH", src: elijahImage },
  { id: "andrew", name: "ANDREW", src: andrewImage },
  { id: "adalric", name: "ADALRIC", src: adalricImage },
  { id: "gwendolynne-heavensbrand", name: "GWENDOLYNNE HEAVENSBRAND", src: gwendolynneHeavensbrandImage },
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
  { id: "pine-gold-clouds", name: "松と金雲", src: pineGoldCloudsImage },
  { id: "cranes-seigaiha", name: "鶴と青海波", src: cranesSeigaihaImage },
  { id: "sakura-gold-screen", name: "桜と金屏風", src: sakuraGoldScreenImage },
  { id: "bamboo-gold-moon", name: "竹と金月", src: bambooGoldMoonImage },
  { id: "plum-gold-snow", name: "梅と金の雪", src: plumGoldSnowImage },
  { id: "fuji-gold-clouds", name: "富士の裾と金雲", src: fujiGoldCloudsImage },
  { id: "koi-waterfall", name: "鯉と滝", src: koiWaterfallImage },
  { id: "maple-gold-stream", name: "紅葉と金流水", src: mapleGoldStreamImage },
  { id: "cathedral-rose-window", name: "大聖堂のバラ窓", src: cathedralRoseWindowImage },
  { id: "gothic-pointed-arch", name: "ゴシック尖頭アーチ", src: gothicPointedArchImage },
  { id: "medieval-grisaille", name: "中世グリザイユ", src: medievalGrisailleImage },
  { id: "cathedral-night", name: "夜の大聖堂", src: cathedralNightImage },
  { id: "wisteria-dragonflies", name: "藤とトンボ", src: wisteriaDragonfliesImage },
  { id: "rose-garden-arch", name: "バラ園アーチ", src: roseGardenArchImage },
  { id: "sea-sailing-ships", name: "海と帆船", src: seaSailingShipsImage },
  { id: "celtic-knot", name: "ケルト結び目", src: celticKnotImage },
  { id: "peacock-feathers", name: "孔雀の羽", src: peacockFeathersImage },
  { id: "grapes-autumn-leaves", name: "葡萄と秋の葉", src: grapesAutumnLeavesImage },
  { id: "lotus-water", name: "蓮と水", src: lotusWaterImage },
  { id: "constellation-ring", name: "星座の円環", src: constellationRingImage },
];
