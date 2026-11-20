import base from "./assets/dress-up/base.png";
import body from "./assets/equipment/body.png";
import ponytail from "./assets/equipment/ponytail.png";
import silver from "./assets/equipment/silver-teal.png";
import purple from "./assets/equipment/black-gold-purple.png";
import goldred from "./assets/equipment/gold-red.png";
import horned from "./assets/equipment/silver-horned.png";
import goldhorn from "./assets/equipment/gold-single-horn.png";
import blackred from "./assets/equipment/black-red-crest.png";
import silverThumb from "./assets/equipment/thumbs/silver.png";
import purpleThumb from "./assets/equipment/thumbs/purple.png";
import goldredThumb from "./assets/equipment/thumbs/goldred.png";
import hornedThumb from "./assets/equipment/thumbs/horned.png";
import goldhornThumb from "./assets/equipment/thumbs/goldhorn.png";
import blackredThumb from "./assets/equipment/thumbs/blackred.png";

export const figure = { base, body, ponytail, top: 260, width: 1086, height: 1708 } as const;
export const equipmentThumbnailSize = { width: 128, height: 128 } as const;

export const equipment = [
  { id: "base", name: "兜なし", detail: "兜を外し、元の顔と髪型に戻ります。", src: null, thumb: null, hairY: 0 },
  { id: "silver", name: "銀・青緑の兜", detail: "青緑の大きな飾り毛と銀の面頬。", src: silver, thumb: silverThumb, hairY: -25 },
  { id: "purple", name: "黒金・紫の兜", detail: "紫の飾り毛と、金で縁取られた白い仮面。", src: purple, thumb: purpleThumb, hairY: 0 },
  { id: "goldred", name: "金・赤の兜", detail: "赤い飾り毛と金の面頬。", src: goldred, thumb: goldredThumb, hairY: -45 },
  { id: "horned", name: "銀・角付きの兜", detail: "下へ曲がる茶色の角と、金の付け根。", src: horned, thumb: hornedThumb, hairY: -45 },
  { id: "goldhorn", name: "金・一本角の兜", detail: "短く上へ湾曲する一本角と、丸い金の兜。", src: goldhorn, thumb: goldhornThumb, hairY: -40 },
  { id: "blackred", name: "黒・赤い鶏冠の兜", detail: "高い赤の鶏冠状の飾りと、黒い面頬。", src: blackred, thumb: blackredThumb, hairY: 0 },
] as const;

export type Equipment = (typeof equipment)[number];
