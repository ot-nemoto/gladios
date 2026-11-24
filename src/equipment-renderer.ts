import { figure, type Equipment } from "./equipment-data";
import { loadImage } from "./wardrobe-common";

interface ComposeOptions {
  isCurrent?: () => boolean;
  mode?: "normal" | "ghost";
}

export async function composeEquipment(item: Equipment, options: ComposeOptions = {}): Promise<HTMLCanvasElement | null> {
  const { isCurrent = () => true, mode = "normal" } = options;
  const images = item.src === null
    ? [await loadImage(figure.base)]
    : await Promise.all([loadImage(mode === "ghost" ? figure.base : figure.body), loadImage(item.src)]);
  // Abandon superseded loads before allocating or drawing another large canvas.
  if (!isCurrent()) return null;
  const result = document.createElement("canvas");
  result.width = figure.width;
  result.height = figure.height;
  const g = result.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  g.drawImage(images[0]!, 0, figure.top);
  if (item.src !== null) {
    if (mode === "ghost") g.globalAlpha = .55;
    g.drawImage(images[1]!, 0, 0);
  }
  return result;
}
