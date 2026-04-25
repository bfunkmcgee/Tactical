import { describe, it, expect } from 'vitest';
import { apDots } from './SelectedUnitHeader';

/**
 * Pure-data smoke tests for the selected-unit header. The component
 * itself is presentational (no logic worth a render-tree assertion);
 * the AP-dot fill arithmetic is the only computation, so we test that
 * directly rather than pulling in React Testing Library.
 */

describe('apDots: filled/empty counts for the AP dot row', () => {
  it('full AP: every dot filled, none empty', () => {
    expect(apDots(2, 2)).toEqual({ filled: 2, empty: 0 });
  });

  it('half AP: one filled, one empty', () => {
    expect(apDots(1, 2)).toEqual({ filled: 1, empty: 1 });
  });

  it('zero AP: no filled, all empty', () => {
    expect(apDots(0, 2)).toEqual({ filled: 0, empty: 2 });
  });

  it('clamps overflow when ap > apMax (defensive)', () => {
    expect(apDots(5, 2)).toEqual({ filled: 2, empty: 0 });
  });

  it('clamps negative ap (defensive)', () => {
    expect(apDots(-1, 3)).toEqual({ filled: 0, empty: 3 });
  });

  it('apMax 0: zero filled, zero empty (degenerate but safe)', () => {
    expect(apDots(0, 0)).toEqual({ filled: 0, empty: 0 });
  });
});
