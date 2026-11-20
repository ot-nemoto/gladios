import "./dress-up.css";
import { equipment, figure, type Equipment } from "./equipment-data";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing equipment element: ${selector}`);
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
const options = required<HTMLElement>("#equipment-options");
const cache = new Map<string, Promise<HTMLImageElement>>();
const buttons: HTMLButtonElement[] = [];
let request = 0;
let displayed: Equipment | null = null;

function markSelected(id: Equipment["id"] | null): void {
  for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.style === id));
}

function load(src: string): Promise<HTMLImageElement> {
  const existing = cache.get(src);
  if (existing) return existing;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load equipment image: ${src}`));
    image.src = src;
  });
  cache.set(src, pending);
  void pending.catch(() => { if (cache.get(src) === pending) cache.delete(src); });
  return pending;
}

async function compose(item: Equipment): Promise<HTMLCanvasElement> {
  // Prepare each selection separately: an incomplete load never changes the visible figure.
  const result = document.createElement("canvas");
  result.width = figure.width;
  result.height = figure.height;
  const g = result.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  g.imageSmoothingEnabled = false;
  if (item.src === null) {
    g.drawImage(await load(figure.base), 0, figure.top);
  } else {
    const [body, hair, helmet] = await Promise.all([load(figure.body), load(figure.ponytail), load(item.src)]);
    g.drawImage(hair, 0, figure.top + item.hairY);
    g.drawImage(body, 0, figure.top);
    g.drawImage(helmet, 0, 0);
  }
  return result;
}

async function select(item: Equipment): Promise<void> {
  const ticket = ++request;
  markSelected(item.id);
  canvas.setAttribute("aria-busy", "true");
  download.setAttribute("aria-disabled", "true");
  status.textContent = "装備を読み込んでいます…";
  try {
    const composition = await compose(item);
    if (ticket !== request) return;
    const png = composition.toDataURL("image/png");
    // Use the base figure's waist and soles on both pages; helmets never resize the person.
    const scale = 300 / (1396 - 760);
    const x = 320 - 584 * scale;
    const y = 852 - (1396 + figure.top) * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(composition, x, y, composition.width * scale, composition.height * scale);
    displayed = item;
    canvas.dataset.style = item.id;
    canvas.setAttribute("aria-label", item.id === "base"
      ? "兜を外し、元の顔とポニーテールに戻った女性剣闘士"
      : `同じ女性剣闘士に${item.name}を重ね、低いポニーテールを出した姿`);
    label.textContent = selectedName.textContent = item.name;
    selectedDetail.textContent = item.detail;
    counter.textContent = `${String(equipment.indexOf(item) + 1).padStart(2, "0")} / ${String(equipment.length).padStart(2, "0")}`;
    download.href = png;
    download.download = `gladiator-equipment-${item.id}.png`;
    download.removeAttribute("aria-disabled");
    status.textContent = item.id === "base" ? "兜を外し、元の髪型に戻しました。" : `${item.name}を着けています。`;
  } catch {
    if (ticket !== request) return;
    markSelected(displayed?.id ?? null);
    if (displayed) download.removeAttribute("aria-disabled");
    else {
      canvas.setAttribute("aria-label", "装備を読み込めませんでした");
      label.textContent = selectedName.textContent = "読込できません";
      selectedDetail.textContent = "兜を選ぶと、もう一度読み込みます。";
      counter.textContent = `— / ${String(equipment.length).padStart(2, "0")}`;
    }
    status.textContent = "画像を読み込めませんでした。もう一度、兜を選んでください。";
  } finally {
    if (ticket === request) canvas.removeAttribute("aria-busy");
  }
}

for (const item of equipment) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice";
  button.dataset.style = item.id;
  button.setAttribute("aria-pressed", "false");
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  const image = document.createElement("img");
  image.src = item.thumb;
  image.alt = "";
  image.width = 128;
  image.height = 202;
  thumb.append(image);
  const text = document.createElement("span");
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.name;
  const description = document.createElement("span");
  description.className = "description";
  description.textContent = item.detail;
  text.append(name, description);
  const check = document.createElement("span");
  check.className = "check";
  check.setAttribute("aria-hidden", "true");
  check.textContent = "✓";
  button.append(thumb, text, check);
  button.addEventListener("click", () => void select(item));
  buttons.push(button);
  options.append(button);
}
required<HTMLElement>("#style-count").textContent = `${equipment.length} STYLES`;
const base = equipment[0];
const initial = equipment[1];
required<HTMLButtonElement>("#remove").addEventListener("click", () => void select(base));
download.addEventListener("click", (event) => {
  if (download.getAttribute("aria-disabled") === "true") event.preventDefault();
});
void select(initial);
