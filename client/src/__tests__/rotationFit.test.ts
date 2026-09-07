import { describe, it, expect } from 'vitest';

/** Mirrors the fit maths in DocumentPreviewModal, where a quarter turn swaps which stage axis each side must fit. */
function fitScale(
  stageW: number,
  stageH: number,
  naturalW: number,
  naturalH: number,
  rotation: number,
): number {
  if (rotation % 180 === 0) return 1;
  const ratio = naturalW / naturalH;
  const drawnW = Math.min(stageW, stageH * ratio);
  const drawnH = drawnW / ratio;
  return Math.min(stageW / drawnH, stageH / drawnW, 1);
}

describe('rotation fit scale', () => {
  it('leaves an upright image alone', () => {
    expect(fitScale(1000, 500, 2000, 1000, 0)).toBe(1);
    expect(fitScale(1000, 500, 2000, 1000, 180)).toBe(1);
  });

  it('shrinks a wide image so a quarter turn still fits the stage', () => {
    // Unrotated it draws 1000x500; turned, it needs 500 wide by 1000 tall in a 1000x500 stage.
    expect(fitScale(1000, 500, 2000, 1000, 90)).toBeCloseTo(0.5, 5);
  });

  it('applies the same scale at 270 as at 90', () => {
    expect(fitScale(1000, 500, 2000, 1000, 270)).toBeCloseTo(fitScale(1000, 500, 2000, 1000, 90), 5);
  });

  it('never enlarges an image that already fits turned', () => {
    // A square in a square stage needs no shrinking.
    expect(fitScale(800, 800, 400, 400, 90)).toBe(1);
  });

  it('handles a tall image in a wide stage', () => {
    const s = fitScale(1200, 400, 500, 1000, 90);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
