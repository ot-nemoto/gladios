import { figure, type Equipment } from "./equipment-data";
import { loadImage } from "./wardrobe-common";

interface ComposeOptions {
  isCurrent?: () => boolean;
  mode?: "normal" | "ghost";
}

const imagePixels = new WeakMap<HTMLImageElement, ImageData>();

function readImagePixels(image: HTMLImageElement): ImageData {
  const cached = imagePixels.get(image);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  g.drawImage(image, 0, 0);
  const pixels = g.getImageData(0, 0, canvas.width, canvas.height);
  imagePixels.set(image, pixels);
  return pixels;
}

export async function composeEquipment(item: Equipment, options: ComposeOptions = {}): Promise<HTMLCanvasElement | null> {
  const { isCurrent = () => true, mode = "normal" } = options;
  const images = item.src === null
    ? [await loadImage(figure.base)]
    : mode === "ghost"
      ? await Promise.all([loadImage(figure.base), loadImage(item.src)])
      : await Promise.all([loadImage(figure.body), loadImage(figure.napePatch.src), loadImage(item.src)]);
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
    g.drawImage(images[0]!, 0, figure.top);
    // Replace RGBA, including transparency, to remove baked-in back-hair fragments.
    g.putImageData(readImagePixels(images[1]!), figure.napePatch.x, figure.napePatch.y);
  }
  if (item.src !== null) {
    if (mode === "ghost") g.globalAlpha = .55;
    g.drawImage(images[mode === "ghost" ? 1 : 2]!, 0, 0);
  }
  return result;
}
