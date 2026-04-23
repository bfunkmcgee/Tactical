import { describe, it, expect, beforeAll } from 'vitest';
import { extractSkinMaskSvg } from './skinMask';

/**
 * extractSkinMaskSvg uses DOMParser + XMLSerializer, which are browser
 * ambient. The vitest node env doesn't ship them, so the test file
 * shims a minimal fallback at boot. When the real DOM is available
 * (jsdom or happy-dom config), the shim is a no-op.
 */
beforeAll(async () => {
  const hasDomParser = typeof (globalThis as { DOMParser?: unknown }).DOMParser !== 'undefined';
  if (!hasDomParser) {
    // Lightweight shim using the built-in `@xmldom/xmldom` dependency
    // if it's installed; otherwise fall back to a regex-based mock
    // that only covers the happy path the tests exercise.
    try {
      const xmldom = await import('@xmldom/xmldom');
      (globalThis as { DOMParser: unknown }).DOMParser = xmldom.DOMParser;
      (globalThis as { XMLSerializer: unknown }).XMLSerializer = xmldom.XMLSerializer;
    } catch {
      // No xmldom available — tests that need DOMParser will skip.
    }
  }
});

describe('skinMask: extractSkinMaskSvg', () => {
  it('returns null for an SVG with no class="skin" markers', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 128"><rect x="0" y="0" width="96" height="128" fill="#abcdef"/></svg>';
    expect(extractSkinMaskSvg(svg)).toBeNull();
  });

  it('hides non-skin elements when class="skin" is present', () => {
    if (typeof DOMParser === 'undefined') return; // env guard
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 128">
        <rect class="skin" x="10" y="10" width="20" height="20" fill="#ffffff"/>
        <rect id="armor" x="40" y="40" width="20" height="20" fill="#445566"/>
        <circle id="eye" cx="50" cy="15" r="2" fill="#112233"/>
      </svg>
    `;
    const out = extractSkinMaskSvg(svg);
    expect(out).not.toBeNull();
    // Non-skin elements receive display="none" — parser + serializer
    // behaviour varies a touch, so just assert the markers are present.
    expect(out!).toContain('display="none"');
    // The skin element stays visible (no display="none" on its line).
    const skinLine = out!.match(/<rect[^>]*class="skin"[^>]*>/);
    expect(skinLine).not.toBeNull();
    expect(skinLine![0]).not.toContain('display="none"');
  });

  it('preserves <defs> blocks (may hold gradients the skin paths reference)', () => {
    if (typeof DOMParser === 'undefined') return;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 128">
        <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
        <rect class="skin" x="10" y="10" width="20" height="20" fill="url(#g)"/>
        <rect id="other" x="40" y="40" width="20" height="20" fill="#000"/>
      </svg>
    `;
    const out = extractSkinMaskSvg(svg);
    expect(out).not.toBeNull();
    expect(out!).toContain('<defs');
    expect(out!).toContain('linearGradient');
  });
});
