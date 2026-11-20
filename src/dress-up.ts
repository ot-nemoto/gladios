import "./dress-up.css";
import baseImage from "./assets/dress-up/base.png";
import silverImage from "./assets/dress-up/silver-teal.png";
import purpleImage from "./assets/dress-up/black-gold-purple.png";
import goldRedImage from "./assets/dress-up/gold-red.png";
import hornedImage from "./assets/dress-up/silver-horned.png";
import goldHornImage from "./assets/dress-up/gold-single-horn.png";
import blackRedImage from "./assets/dress-up/black-red-crest.png";

type Style = "base" | "silver" | "purple" | "goldred" | "horned" | "goldhorn" | "blackred";
interface Variant {
  src: string;
  name: string;
  detail: string;
  alt: string;
  waist: readonly [number, number];
  feet: number;
}

const styles: readonly Style[] = ["base", "silver", "purple", "goldred", "horned", "goldhorn", "blackred"];
const silverAnchor = { waist: [540, 948] as const, feet: 1490 };
const variants: Record<Style, Variant> = {
  base: {
    src: baseImage,
    name: "兜なし",
    detail: "基本の服装。顔と髪型をそのまま見られます。",
    alt: "兜を着けず、ポニーテールとベージュのチュニックで立つ低頭身の女性剣闘士",
    waist: [584, 760],
    feet: 1396,
  },
  silver: {
    src: silverImage,
    name: "銀・青緑の兜",
    detail: "目穴から顔がのぞく、銀色の兜。",
    alt: "青緑の大きな飾り毛がある銀色の兜を着けた、低頭身の女性剣闘士",
    ...silverAnchor,
  },
  purple: {
    src: purpleImage,
    name: "黒金・紫の兜",
    detail: "紫の飾り毛と白い仮面がついた、黒と金の兜。",
    alt: "紫の飾り毛と白い仮面がある黒金の兜を着けた、低頭身の女性剣闘士",
    waist: [535, 925],
    feet: 1490,
  },
  goldred: {
    src: goldRedImage,
    name: "金・赤の兜",
    detail: "赤い飾り毛がある、金色の兜。",
    alt: "赤い大きな飾り毛がある金色の兜を着けた、低頭身の女性剣闘士",
    ...silverAnchor,
  },
  horned: {
    src: hornedImage,
    name: "銀・角付きの兜",
    detail: "下へ曲がる茶色の角と、金の付け根がある銀色の兜。",
    alt: "金色の付け根から下へ曲がる茶色の角が付いた銀の兜を着けた、低頭身の女性剣闘士",
    waist: [534, 916],
    feet: 1458,
  },
  goldhorn: {
    src: goldHornImage,
    name: "金・一本角の兜",
    detail: "上へ湾曲する一本角と、長い頬当てのある金色の兜。",
    alt: "上へ湾曲する一本の角が付いた金の兜を着けた、低頭身の女性剣闘士",
    waist: [583, 766],
    feet: 1393,
  },
  blackred: {
    src: blackRedImage,
    name: "黒・赤い鶏冠の兜",
    detail: "赤い鶏冠状の飾りと、鼻当てのある黒い兜。",
    alt: "赤い鶏冠状の飾りが前後に伸びる黒い兜を着けた、低頭身の女性剣闘士",
    waist: [582, 793],
    feet: 1401,
  },
};

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing wardrobe element: ${selector}`);
  return element;
}

const canvas = required<HTMLCanvasElement>("#character");
const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas 2D is unavailable");
const ctx: CanvasRenderingContext2D = context;
const status = required<HTMLElement>("#status");
const download = required<HTMLAnchorElement>("#download");
const label = required<HTMLElement>("#variant-label");
const selectedName = required<HTMLElement>("#selected-name");
const selectedDetail = required<HTMLElement>("#selected-detail");
const counter = required<HTMLElement>("#counter");
const buttons = [...document.querySelectorAll<HTMLButtonElement>("button[data-style]")];
const cache = new Map<string, Promise<HTMLImageElement>>();
let request = 0;
let selected: Style | null = null;

function markSelected(style: Style | null): void {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.style === style));
  }
}

function load(src: string): Promise<HTMLImageElement> {
  const existing = cache.get(src);
  if (existing) return existing;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
  cache.set(src, pending);
  void pending.catch(() => cache.delete(src));
  return pending;
}

async function select(style: Style): Promise<void> {
  const ticket = ++request;
  const variant = variants[style];
  markSelected(style);
  canvas.setAttribute("aria-busy", "true");
  download.setAttribute("aria-disabled", "true");
  status.textContent = "立ち絵を読み込んでいます…";

  try {
    const image = await load(variant.src);
    if (ticket !== request) return;
    // These authored images have different native sizes. Align the waist
    // and soles so the body does not shrink when a crest is added.
    const scale = 300 / (variant.feet - variant.waist[1]);
    const x = 320 - variant.waist[0] * scale;
    const y = 852 - variant.feet * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, x, y, image.naturalWidth * scale, image.naturalHeight * scale);
    selected = style;
    // Identify the actually displayed style for browser checks and inspection.
    canvas.dataset.style = style;
    canvas.setAttribute("aria-label", variant.alt);
    label.textContent = variant.name;
    selectedName.textContent = variant.name;
    selectedDetail.textContent = variant.detail;
    counter.textContent = `${String(styles.indexOf(style) + 1).padStart(2, "0")} / ${String(styles.length).padStart(2, "0")}`;
    download.href = variant.src;
    download.download = `gladiator-chibi-${style}.png`;
    download.removeAttribute("aria-disabled");
    status.textContent = style === "base"
      ? "兜を外した立ち絵です。"
      : `${variant.name}を着けた立ち絵です。`;
  } catch {
    if (ticket !== request) return;
    markSelected(selected);
    if (selected) download.removeAttribute("aria-disabled");
    else {
      canvas.setAttribute("aria-label", "立ち絵を読み込めませんでした");
      label.textContent = "読込できません";
      selectedName.textContent = "立ち絵を読み込めませんでした";
      selectedDetail.textContent = "兜を選ぶと、もう一度読み込みます。";
      counter.textContent = "— / 07";
    }
    status.textContent = "画像を読み込めませんでした。もう一度、兜を選んでください。";
  } finally {
    if (ticket === request) canvas.removeAttribute("aria-busy");
  }
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    const style = button.dataset.style;
    if (style === "base" || style === "silver" || style === "purple" || style === "goldred" || style === "horned" || style === "goldhorn" || style === "blackred") void select(style);
  });
}
required<HTMLButtonElement>("#remove").addEventListener("click", () => void select("base"));
download.addEventListener("click", (event) => {
  if (download.getAttribute("aria-disabled") === "true") event.preventDefault();
});
void select("silver");
