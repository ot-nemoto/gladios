import "./scene.css";
import { loadImage, required } from "./common";
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

/*
 * サムネイルは段階的に読み込む（#186。手順は引き継ぎ資料を参照）。
 * 1. 各欄のスクロール位置で見えている選択肢と、左右に欄の幅1つ分の先までをすぐに読む。
 * 2. 欄が初めてスクロールされたら、その欄の残りを読み始める（素早いスワイプで空欄を見せない）。
 * 3. どれでもない残りは、ページの読み込み後、優先度を下げて数枚ずつ読む
 *    （直後に選んだキャラ・背景の元画像の読み込みを妨げない）。
 * loading="lazy" は横スクロール欄の先読みが足りず、空欄が見えたため使わない（#178）。
 */
const thumbBatchSize = 2;
const pendingThumbs = new Set<HTMLImageElement>();
const thumbObservers = new Map<HTMLImageElement, IntersectionObserver>();

/** サムネイルの読み込みを始め、読み終わる（または失敗する）まで待つ。 */
function loadThumb(thumb: HTMLImageElement, priority: "auto" | "low" = "auto"): Promise<void> {
  const src = thumb.dataset.src;
  if (!src) return Promise.resolve();
  thumbObservers.get(thumb)?.unobserve(thumb);
  thumbObservers.delete(thumb);
  pendingThumbs.delete(thumb);
  delete thumb.dataset.src;
  thumb.fetchPriority = priority;
  const done = new Promise<void>((resolve) => {
    thumb.addEventListener("load", () => resolve(), { once: true });
    thumb.addEventListener("error", () => resolve(), { once: true });
  });
  thumb.src = src;
  return done;
}

function whenIdle(callback: () => void): void {
  if ("requestIdleCallback" in window) window.requestIdleCallback(callback, { timeout: 2000 });
  else setTimeout(callback, 200);
}

/**
 * 残りのサムネイルを、優先度を下げて数枚ずつ読む。前の数枚を読み終えてから次へ進む。
 * プレビューの元画像を読み込んでいる間は止め、選んだキャラ・背景の表示を先にする。
 */
function loadRemainingThumbsWhenIdle(): void {
  whenIdle(() => {
    if (pendingThumbs.size === 0) return;
    if (canvas.hasAttribute("aria-busy")) {
      setTimeout(loadRemainingThumbsWhenIdle, 200);
      return;
    }
    const batch = [...pendingThumbs].slice(0, thumbBatchSize);
    void Promise.all(batch.map((thumb) => loadThumb(thumb, "low"))).then(loadRemainingThumbsWhenIdle);
  });
}

function renderOptions(
  container: HTMLElement,
  items: readonly SceneItem[],
  onSelect: (item: SceneItem) => void,
): (item: SceneItem) => void {
  // IntersectionObserver のないブラウザでは、従来どおり最初にすべて読む。
  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) if (entry.isIntersecting) void loadThumb(entry.target as HTMLImageElement);
          },
          { root: container, rootMargin: "0px 100%" },
        )
      : null;
  const thumbs: HTMLImageElement[] = [];
  container.addEventListener(
    "scroll",
    () => {
      for (const thumb of thumbs) void loadThumb(thumb);
    },
    { once: true, passive: true },
  );
  const buttons = items.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-choice";
    button.dataset.id = item.id;
    const thumb = document.createElement("img");
    // 選択欄には縮小画像を使い、開いた直後の読み込みを減らす。合成には元画像を使う。
    thumb.dataset.src = thumbOf(item);
    thumb.width = thumbSize;
    thumb.height = thumbSize;
    thumb.alt = "";
    thumbs.push(thumb);
    pendingThumbs.add(thumb);
    if (observer) {
      thumbObservers.set(thumb, observer);
      observer.observe(thumb);
    } else {
      void loadThumb(thumb);
    }
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

if (document.readyState === "complete") loadRemainingThumbsWhenIdle();
else window.addEventListener("load", loadRemainingThumbsWhenIdle, { once: true });

void draw();
