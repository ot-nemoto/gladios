import { figure, type Equipment } from "./equipment-data";
import { loadImage } from "./wardrobe-common";

interface ComposeOptions {
  isCurrent?: () => boolean;
  mode?: "normal" | "ghost";
}

const rootPixels = new WeakMap<HTMLImageElement, ImageData>();

function readRootPixels(image: HTMLImageElement): ImageData {
  const cached = rootPixels.get(image);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  g.drawImage(image, 0, 0);
  const pixels = g.getImageData(0, 0, canvas.width, canvas.height);
  rootPixels.set(image, pixels);
  return pixels;
}

export async function composeEquipment(item: Equipment, options: ComposeOptions = {}): Promise<HTMLCanvasElement | null> {
  const { isCurrent = () => true, mode = "normal" } = options;
  const images = item.src === null
    ? [await loadImage(figure.base)]
    : mode === "ghost"
      ? await Promise.all([loadImage(figure.base), loadImage(item.src)])
      : await Promise.all([
        loadImage("hairLayers" in item ? item.hairLayers.rear : figure.ponytail),
        loadImage(figure.body), loadImage(item.src),
        "hairLayers" in item ? loadImage(item.hairLayers.root.src) : null,
      ]);
  // Abandon superseded loads before allocating or drawing another large canvas.
  if (!isCurrent()) return null;
  const result = document.createElement("canvas");
  result.width = figure.width;
  result.height = figure.height;
  const g = result.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  if (item.src === null || mode === "ghost") {
    g.drawImage(images[0]!, 0, figure.top);
  } else {
    g.drawImage(images[0]!, 0, "hairLayers" in item ? 0 : figure.top + item.hairY);
    g.drawImage(images[1]!, 0, figure.top);
  }
  if (item.src !== null) {
    if (mode === "ghost") g.globalAlpha = .55;
    g.drawImage(images[mode === "ghost" ? 1 : 2]!, 0, 0);
    if (mode === "normal" && "hairLayers" in item) {
      // This is an approved composite of the root AND rear rim, not raw hair.
      // Copy RGBA once: source-over would accumulate translucent edge pixels.
      const root = item.hairLayers.root;
      g.putImageData(readRootPixels(images[3]!), root.x, root.y);
    }
  }
  return result;
}
