import { describe, it, expect } from 'vitest';
import { createGlassDisplacement } from '@/utils/glassDisplacement';
describe('glass rim map', () => {
  it('keeps the center neutral and refracts opposite edges in opposite directions', () => {
    const w = 390,
      h = 60,
      data = createGlassDisplacement(w, h);
    const at = (x, y) =>
      Array.from(data.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
    expect(at(195, 30)).toEqual([128, 128, 128, 255]);
    expect(at(195, 5)[1]).toBeLessThan(128);
    expect(at(195, 54)[1]).toBeGreaterThan(128);
  });
});
