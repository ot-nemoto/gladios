// Browser-only authoring helper; not imported by the published pages.
// Inputs: shared ponytail PNG and the approved 1086x1708 equipped figure PNG.
export function bakeGoldhornHairLayers(hair, approvedFigure) {
  if (hair.naturalWidth !== 1086 || hair.naturalHeight !== 1448 ||
      approvedFigure.naturalWidth !== 1086 || approvedFigure.naturalHeight !== 1708) {
    throw new Error("Unexpected hair or approved figure dimensions");
  }
  const make = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
  const rear = make(1086, 1708);
  const g = rear.getContext("2d");
  const root = 405, join = 540, span = join - root;
  const x = 50, y = 30, top = 220;
  g.save();
  g.imageSmoothingEnabled = false;
  g.transform(1, 0, -x / span, 1 - y / span, x * join / span, top + y * join / span);
  g.drawImage(hair, 0, 0, 1086, join, 0, 0, 1086, join);
  g.restore();
  g.drawImage(hair, 0, join, 1086, 1448 - join, 0, top + join, 1086, 1448 - join);

  // Keep the approved root/rim overlap as exact RGBA pixels. This includes the
  // small rim area behind the root, so it is a composite patch, not raw hair.
  const rootPatch = make(105, 105);
  rootPatch.getContext("2d").drawImage(approvedFigure, 350, 630, 105, 105, 0, 0, 105, 105);
  return { rear, rootPatch };
}
