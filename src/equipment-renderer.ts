import { figure, type Equipment } from "./equipment-data";
import { loadImage } from "./wardrobe-common";

export async function composeEquipment(item: Equipment, isCurrent: () => boolean = () => true): Promise<HTMLCanvasElement | null> {
  const images = item.src === null
    ? [await loadImage(figure.base)]
    : await Promise.all([loadImage(figure.ponytail), loadImage(figure.body), loadImage(item.src)]);
  // Abandon superseded loads before allocating or drawing another large canvas.
  if (!isCurrent()) return null;
  const result = document.createElement("canvas");
  result.width = figure.width;
  result.height = figure.height;
  const g = result.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  if (item.src === null) {
    g.drawImage(images[0]!, 0, figure.top);
  } else {
    g.drawImage(images[0]!, 0, figure.top + item.hairY);
    g.drawImage(images[1]!, 0, figure.top);
    g.drawImage(images[2]!, 0, 0);
  }
  return result;
}

