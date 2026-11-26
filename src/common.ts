export function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const cache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  const existing = cache.get(src);
  if (existing) return existing;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    image.src = src;
  });
  cache.set(src, pending);
  void pending.catch(() => { if (cache.get(src) === pending) cache.delete(src); });
  return pending;
}
