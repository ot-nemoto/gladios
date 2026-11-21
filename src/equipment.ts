import "./dress-up.css";
import { composeEquipment } from "./equipment-renderer";
import { baseAnchor, drawPreview, required } from "./wardrobe-common";
import { equipment, equipmentThumbnailSize, figure, type Equipment } from "./equipment-data";

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
const buttons: HTMLButtonElement[] = [];
let request = 0;
let displayed: Equipment | null = null;
let composition: HTMLCanvasElement | null = null;
let saving = false;
let downloadURL: string | null = null;

function markSelected(id: Equipment["id"] | null): void {
  for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.style === id));
}

function updateDownload(): void {
  download.setAttribute("aria-disabled", String(!composition || canvas.hasAttribute("aria-busy") || saving));
}

async function save(): Promise<void> {
  if (!composition || !displayed || download.getAttribute("aria-disabled") === "true") return;
  const snapshot = composition;
  const item = displayed;
  const ticket = request;
  saving = true;
  updateDownload();
  status.textContent = "PNGを準備しています…";
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      snapshot.toBlob(result => result ? resolve(result) : reject(new Error("PNG encoding failed")), "image/png");
    });
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadURL;
    link.download = `gladiator-equipment-${item.id}.png`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    if (ticket === request) status.textContent = `${item.name}のPNGの保存を開始しました。`;
  } catch {
    if (ticket === request) status.textContent = "PNGを保存できませんでした。もう一度お試しください。";
  } finally {
    saving = false;
    updateDownload();
  }
}

async function select(item: Equipment): Promise<void> {
  const ticket = ++request;
  markSelected(item.id);
  canvas.setAttribute("aria-busy", "true");
  download.setAttribute("aria-disabled", "true");
  status.textContent = "装備を読み込んでいます…";
  try {
    const result = await composeEquipment(item, { isCurrent: () => ticket === request });
    if (!result || ticket !== request) return;
    drawPreview(ctx, canvas, result, baseAnchor, figure.top);
    composition = result;
    displayed = item;
    canvas.dataset.style = item.id;
    canvas.setAttribute("aria-label", item.id === "base"
      ? "兜を外し、元の顔とポニーテールに戻った女性剣闘士"
      : `同じ女性剣闘士に${item.name}を重ね、${"hideHair" in item && item.hideHair ? "後ろ髪を兜の中へ収めた" : "低いポニーテールを出した"}姿`);
    label.textContent = selectedName.textContent = item.name;
    selectedDetail.textContent = item.detail;
    counter.textContent = `${String(equipment.indexOf(item) + 1).padStart(2, "0")} / ${String(equipment.length).padStart(2, "0")}`;
    status.textContent = item.id === "base" ? "兜を外し、元の髪型に戻しました。" : `${item.name}を着けています。`;
  } catch {
    if (ticket !== request) return;
    markSelected(displayed?.id ?? null);
    if (!displayed) {
      canvas.setAttribute("aria-label", "装備を読み込めませんでした");
      label.textContent = selectedName.textContent = "読込できません";
      selectedDetail.textContent = "兜を選ぶと、もう一度読み込みます。";
      counter.textContent = `— / ${String(equipment.length).padStart(2, "0")}`;
    }
    status.textContent = "画像を読み込めませんでした。もう一度、兜を選んでください。";
  } finally {
    if (ticket === request) {
      canvas.removeAttribute("aria-busy");
      updateDownload();
    }
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
  if (item.thumb) {
    const image = document.createElement("img");
    image.src = item.thumb;
    image.alt = "";
    image.width = equipmentThumbnailSize.width;
    image.height = equipmentThumbnailSize.height;
    thumb.append(image);
  } else {
    thumb.classList.add("thumb-empty");
    thumb.setAttribute("aria-hidden", "true");
    thumb.textContent = "—";
  }
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
  event.preventDefault();
  void save();
});
counter.textContent = `— / ${String(equipment.length).padStart(2, "0")}`;
window.addEventListener("pagehide", () => {
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = null;
});
void select(initial);
