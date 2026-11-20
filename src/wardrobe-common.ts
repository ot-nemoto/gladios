export const baseAnchor = { waist: [584, 760] as const, feet: 1396 };

export function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing wardrobe element: ${selector}`);
  return element;
}

const cache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  const existing = cache.get(src);
  if (existing) return existing;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load wardrobe image: ${src}`));
    image.src = src;
  });
  cache.set(src, pending);
  void pending.catch(() => { if (cache.get(src) === pending) cache.delete(src); });
  return pending;
}

export function drawPreview(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | HTMLCanvasElement,
  anchor: { waist: readonly [number, number]; feet: number },
  top = 0,
): void {
  const scale = 300 / (anchor.feet - anchor.waist[1]);
  const x = 320 - anchor.waist[0] * scale;
  const y = 852 - (anchor.feet + top) * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
}
