import "./scene.css";
import { loadImage, required } from "./wardrobe-common";
import { backgrounds, characters, sceneSize, thumbOf, thumbSize, type SceneItem } from "./scene-data";

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
let saving = false;
let downloadURL: string | null = null;

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
    // 選択欄には縮小画像を使い、開いた直後の読み込みを減らす。合成には元画像を使う。
    thumb.src = thumbOf(item);
    thumb.width = thumbSize;
    thumb.height = thumbSize;
    thumb.alt = "";
    // 横スクロール欄では、画面外のサムネイルを lazy にするとスワイプ後に空欄が見えるため、
    // 縮小画像は最初にすべて読み込む（全33枚で約0.87MB、#166・#178）。
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
    download.disabled = saving;
  } catch {
    if (ticket !== request) return;
    if (shown) {
      markCharacter(shown.character);
      markBackground(shown.background);
      character = shown.character;
      background = shown.background;
      download.disabled = saving;
    } else {
      canvas.setAttribute("aria-label", "画像を読み込めませんでした");
    }
    status.textContent = "画像を読み込めませんでした。もう一度選んでください。";
  } finally {
    if (ticket === request) canvas.removeAttribute("aria-busy");
  }
}

download.addEventListener("click", () => {
  if (!shown || saving) return;
  const name = `gladios-${shown.character.id}-${shown.background.id}.png`;
  saving = true;
  download.disabled = true;
  status.textContent = "PNGを準備しています…";
  canvas.toBlob((blob) => {
    saving = false;
    const busy = canvas.hasAttribute("aria-busy");
    download.disabled = busy || !shown;
    if (!blob) {
      status.textContent = "PNGを作れませんでした。";
      return;
    }
    // 直後に破棄すると、ブラウザによっては保存が始まる前にURLが無効になる。
    // 次の保存かページ離脱まで保持する。
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadURL;
    link.download = name;
    link.click();
    if (!busy) status.textContent = `${name} を保存しました。`;
  }, "image/png");
});

window.addEventListener("pagehide", () => {
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = null;
});

void draw();
