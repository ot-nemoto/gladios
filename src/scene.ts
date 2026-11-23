import "./scene.css";
import { loadImage, required } from "./wardrobe-common";
import { backgrounds, characters, sceneSize, type SceneItem } from "./scene-data";

const canvas = required<HTMLCanvasElement>("#scene");
const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas 2D is unavailable");
const ctx: CanvasRenderingContext2D = context;
const status = required<HTMLElement>("#status");
const download = required<HTMLButtonElement>("#download");

let character = characters[0]!;
let background = backgrounds[0]!;
let shown: { character: SceneItem; background: SceneItem } | null = null;
let request = 0;

function renderOptions(
  container: HTMLElement,
  items: readonly SceneItem[],
  onSelect: (item: SceneItem) => void,
): (item: SceneItem) => void {
  const buttons = items.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-choice";
    button.dataset.id = item.id;
    const thumb = document.createElement("img");
    thumb.src = item.src;
    thumb.width = sceneSize;
    thumb.height = sceneSize;
    thumb.alt = "";
    const name = document.createElement("span");
    name.textContent = item.name;
    button.append(thumb, name);
    button.addEventListener("click", () => onSelect(item));
    container.append(button);
    return button;
  });
  return (selected) => {
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.id === selected.id));
  };
}

const markCharacter = renderOptions(required("#characters"), characters, (item) => {
  character = item;
  void draw();
});
const markBackground = renderOptions(required("#backgrounds"), backgrounds, (item) => {
  background = item;
  void draw();
});

async function draw(): Promise<void> {
  const ticket = ++request;
  const target = { character, background };
  markCharacter(target.character);
  markBackground(target.background);
  canvas.setAttribute("aria-busy", "true");
  download.disabled = true;
  status.textContent = "画像を読み込んでいます…";
  try {
    const [backImage, charImage] = await Promise.all([loadImage(target.background.src), loadImage(target.character.src)]);
    if (ticket !== request) return;
    ctx.clearRect(0, 0, sceneSize, sceneSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(backImage, 0, 0, sceneSize, sceneSize);
    ctx.drawImage(charImage, 0, 0, sceneSize, sceneSize);
    shown = target;
    canvas.dataset.character = target.character.id;
    canvas.dataset.background = target.background.id;
    canvas.setAttribute("aria-label", `${target.background.name}の背景に立つ${target.character.name}`);
    status.textContent = `${target.character.name} × ${target.background.name}`;
    download.disabled = false;
  } catch {
    if (ticket !== request) return;
    if (shown) {
      markCharacter(shown.character);
      markBackground(shown.background);
      character = shown.character;
      background = shown.background;
      download.disabled = false;
    }
    status.textContent = "画像を読み込めませんでした。もう一度選んでください。";
  } finally {
    if (ticket === request) canvas.removeAttribute("aria-busy");
  }
}

download.addEventListener("click", () => {
  if (!shown) return;
  const name = `gladios-${shown.character.id}-${shown.background.id}.png`;
  canvas.toBlob((blob) => {
    if (!blob) {
      status.textContent = "PNGを作れませんでした。";
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, "image/png");
});

void draw();
