// Rounded-rectangle distance field: the flat center stays neutral; only the rim refracts.
export function createGlassDisplacement(width, height, radius = 28) {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = Math.min(radius, height / 2, width / 2);
  const rim = Math.min(12, height / 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - width / 2,
        py = y + 0.5 - height / 2;
      const qx = Math.abs(px) - (width / 2 - r);
      const qy = Math.abs(py) - (height / 2 - r);
      const ax = Math.max(qx, 0),
        ay = Math.max(qy, 0);
      const length = Math.hypot(ax, ay);
      const distance = length + Math.min(Math.max(qx, qy), 0) - r;
      const depth = Math.max(0, -distance);
      const bend =
        distance <= 0 && depth < rim ? Math.sin((Math.PI * depth) / rim) : 0;
      let nx = 0,
        ny = 0;
      if (length > 0) {
        nx = ax / length;
        ny = ay / length;
      } else if (qx > qy) nx = 1;
      else ny = 1;
      const i = (y * width + x) * 4;
      data[i] = 128 + Math.sign(px) * nx * bend * 110;
      data[i + 1] = 128 + Math.sign(py) * ny * bend * 110;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return data;
}
