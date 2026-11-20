import "./dress-up.css";
import "./helmet-fit.css";
import { equipment, figure, type Equipment } from "./equipment-data";
import { composeEquipment } from "./equipment-renderer";
import { loadImage, required } from "./wardrobe-common";

type Helmet = Exclude<Equipment, { src: null }>;
const helmets = equipment.filter((item): item is Helmet => item.src !== null);
const crop = { x: 330, y: figure.top + 70, size: 480 };
// These guides belong to the original face, never to an individual helmet.
const guides = [
  { id: "crown", axis: "y", value: figure.top + 100, color: "#3f679d", label: "頭頂（目安）" },
  { id: "eye", axis: "y", value: figure.top + 335, color: "#196e68", label: "目" },
  { id: "chin", axis: "y", value: figure.top + 455, color: "#9f4b50", label: "顎" },
  { id: "back", axis: "x", value: 450, color: "#77518f", label: "耳側" },
  { id: "front", axis: "x", value: 700, color: "#77518f", label: "鼻先" },
] as const;
const grid = required<HTMLElement>("#comparison-grid");
const status = required<HTMLElement>("#fit-status");
const retry = required<HTMLButtonElement>("#retry");
const ghost = required<HTMLInputElement>("#ghost");
const showGuides = required<HTMLInputElement>("#guides");
const reference = required<HTMLCanvasElement>("#reference");
let baseCrop: HTMLCanvasElement | null = null;
let loading = false;

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const result = canvas.getContext("2d");
  if (!result) throw new Error("Canvas 2D is unavailable");
  return result;
}

function makeCrop(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = crop.size;
  return canvas;
}

function cropImage(image: HTMLImageElement | HTMLCanvasElement, y = crop.y): HTMLCanvasElement {
  const result = makeCrop();
  const ctx = context(result);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, crop.x, y, crop.size, crop.size, 0, 0, crop.size, crop.size);
  return result;
}

function mountGuides(stage: HTMLElement): void {
  const overlay = document.createElement("div");
  overlay.className = "fit-guide-overlay";
  overlay.setAttribute("aria-hidden", "true");
  for (const guide of guides) {
    const line = document.createElement("div");
    line.className = `fit-guide ${guide.axis === "y" ? "horizontal" : "vertical"}`;
    line.dataset.guide = guide.id;
    line.style.setProperty("--guide-color", guide.color);
    const origin = guide.axis === "y" ? crop.y : crop.x;
    line.style[guide.axis === "y" ? "top" : "left"] = `${(guide.value - origin) / crop.size * 100}%`;
    const label = document.createElement("span");
    label.className = "fit-guide-label";
    label.textContent = guide.label;
    line.append(label);
    overlay.append(line);
  }
  stage.append(overlay);
}

interface Card {
  item: Helmet;
  canvas: HTMLCanvasElement;
  status: HTMLElement;
  frames: { normal: HTMLCanvasElement; ghost: HTMLCanvasElement } | null;
  failed: boolean;
}

mountGuides(required("#reference-stage"));
const cards: Card[] = helmets.map(item => {
  const section = document.createElement("section");
  section.className = "fit-card";
  section.dataset.style = item.id;
  const title = document.createElement("h2");
  title.textContent = item.name;
  const stage = document.createElement("div");
  stage.className = "fit-stage";
  const canvas = makeCrop();
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${item.name}を読み込んでいます`);
  canvas.setAttribute("aria-busy", "true");
  stage.append(canvas);
  mountGuides(stage);
  const message = document.createElement("p");
  message.className = "fit-card-status";
  message.textContent = "読み込み中…";
  section.append(title, stage, message);
  grid.append(section);
  return { item, canvas, status: message, frames: null, failed: false };
});
required<HTMLElement>("#helmet-count").textContent = `${helmets.length}種類の兜。`;

function renderCard(card: Card): void {
  if (!card.frames) return;
  const ctx = context(card.canvas);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, crop.size, crop.size);
  ctx.drawImage(ghost.checked ? card.frames.ghost : card.frames.normal, 0, 0);
  card.canvas.setAttribute("aria-label", ghost.checked
    ? `元の顔に${card.item.name}を半透明で重ねた比較`
    : `${card.item.name}を装備した顔周り`);
  if (!card.failed) card.status.textContent = ghost.checked ? "元の顔に半透明で重ねています。" : "現在の装備表示です。";
}

function renderGuides(): void {
  for (const overlay of document.querySelectorAll<HTMLElement>(".fit-guide-overlay")) overlay.hidden = !showGuides.checked;
}

function render(): void {
  renderGuides();
  for (const card of cards) renderCard(card);
}

async function loadCard(card: Card): Promise<void> {
  card.canvas.setAttribute("aria-busy", "true");
  card.status.textContent = "読み込み中…";
  try {
    const normal = await composeEquipment(card.item);
    if (!normal) throw new Error("Missing comparison figure");
    const normalCrop = cropImage(normal);
    normal.width = normal.height = 0;
    const transparent = await composeEquipment(card.item, { mode: "ghost" });
    if (!transparent) throw new Error("Missing comparison figure");
    // Keep only cropped faces; full-size compositions can be released after loading.
    card.frames = { normal: normalCrop, ghost: cropImage(transparent) };
    transparent.width = transparent.height = 0;
    card.failed = false;
    card.canvas.dataset.state = "ready";
    renderCard(card);
  } catch {
    card.failed = true;
    card.canvas.dataset.state = "error";
    card.canvas.setAttribute("aria-label", `${card.item.name}を読み込めませんでした`);
    card.status.textContent = "この兜を読み込めませんでした。再読み込みをお試しください。";
  } finally {
    card.canvas.removeAttribute("aria-busy");
  }
}

async function initialize(): Promise<void> {
  if (loading) return;
  loading = true;
  grid.dataset.state = "loading";
  retry.disabled = true;
  retry.hidden = true;
  status.textContent = "元の顔と兜を読み込んでいます…";
  reference.setAttribute("aria-busy", "true");
  try {
    baseCrop ??= cropImage(await loadImage(figure.base), crop.y - figure.top);
    context(reference).clearRect(0, 0, crop.size, crop.size);
    context(reference).drawImage(baseCrop, 0, 0);
    ghost.disabled = false;
    // Process one helmet at a time and leave successful cards untouched on retry.
    for (const card of cards) if (!card.frames || card.failed) await loadCard(card);
    const failed = cards.filter(card => card.failed).length;
    grid.dataset.state = failed ? "partial" : "ready";
    status.textContent = failed === cards.length && failed > 0
      ? "すべての兜を読み込めませんでした。再読み込みをお試しください。"
      : failed
      ? `${cards.length - failed}/${cards.length}種類を表示しました。一部の兜を読み込めませんでした。`
      : `${cards.length}種類の兜を同じ顔・同じ倍率で比較できます。`;
    retry.hidden = failed === 0;
  } catch {
    for (const card of cards) {
      card.canvas.removeAttribute("aria-busy");
      card.canvas.dataset.state = "error";
      card.canvas.setAttribute("aria-label", "基準の顔を読み込めず比較できませんでした");
      card.status.textContent = "元の顔を読み込めず比較できませんでした。";
    }
    grid.dataset.state = "error";
    status.textContent = "元の顔を読み込めませんでした。再読み込みをお試しください。";
    retry.hidden = false;
  } finally {
    reference.removeAttribute("aria-busy");
    loading = false;
    retry.disabled = false;
  }
}

ghost.addEventListener("change", render);
showGuides.addEventListener("change", renderGuides);
retry.addEventListener("click", () => void initialize());
render();
void initialize();
