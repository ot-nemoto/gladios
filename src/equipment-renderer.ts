import { figure, type Equipment } from "./equipment-data";
import { loadImage } from "./wardrobe-common";

interface ComposeOptions {
  isCurrent?: () => boolean;
  mode?: "normal" | "ghost";
}

function drawHair(g: CanvasRenderingContext2D, hair: HTMLImageElement, item: Equipment): void {
  const hairTop = figure.top + item.hairY;
  if ("hairRoot" in item) {
    const join = figure.ponytailJoinY;
    const span = join - figure.ponytailRootY;
    const { x, y } = item.hairRoot;
    // Move only the root. The lower curl stays aligned with the original body.
    g.save();
    g.imageSmoothingEnabled = false;
    g.transform(1, 0, -x / span, 1 - y / span, x * join / span, hairTop + y * join / span);
    g.drawImage(hair, 0, 0, figure.width, join, 0, 0, figure.width, join);
    g.restore();
    g.drawImage(hair, 0, join, figure.width, hair.height - join,
      0, hairTop + join, figure.width, hair.height - join);
  } else {
    g.drawImage(hair, 0, hairTop);
  }
}

export async function composeEquipment(item: Equipment, options: ComposeOptions = {}): Promise<HTMLCanvasElement | null> {
  const { isCurrent = () => true, mode = "normal" } = options;
  const images = item.src === null
    ? [await loadImage(figure.base)]
    : mode === "ghost"
      ? await Promise.all([loadImage(figure.base), loadImage(item.src)])
      : await Promise.all([loadImage(figure.ponytail), loadImage(figure.body), loadImage(item.src)]);
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
    drawHair(g, images[0]!, item);
    g.drawImage(images[1]!, 0, figure.top);
  }
  if (item.src !== null) {
    if (mode === "ghost") g.globalAlpha = .55;
    g.drawImage(images[images.length - 1]!, 0, 0);
    if (mode === "normal" && "hairFrontClip" in item) {
      // The rear rim sits behind this small section of the ponytail root.
      // The rest of the helmet, including the cheek plate, remains in front.
      g.save();
      g.beginPath();
      item.hairFrontClip.forEach(([x, y], index) => index ? g.lineTo(x, y) : g.moveTo(x, y));
      g.closePath();
      g.clip();
      drawHair(g, images[0]!, item);
      g.restore();
    }
  }
  return result;
}

