/**
 * Phase 6d follow-through — partOverrides skin-mask.
 *
 * When a soldier's `appearance.partOverrides.head` (or `.arms-*`)
 * ships a bespoke SVG with exposed-skin paths tagged `class="skin"`,
 * this helper extracts a skin-only variant of that SVG so the
 * renderer can mount it as a tinted sprite on top of the untinted
 * base, producing a recolor-by-tint effect without double-tinting
 * the non-skin pixels (armor, hair, eyes, etc.).
 *
 * The extraction clones the SVG DOM and sets `display="none"` on
 * every element that isn't:
 *   - the root <svg>
 *   - a <defs> block (may hold gradient references the skin paths
 *     need)
 *   - an element with class="skin" (or an ancestor of one)
 *
 * Returns the serialized skin-only SVG string, or `null` when the
 * source SVG has no `class="skin"` markers (the common case — 95%
 * of override SVGs don't opt in, and the caller should skip the
 * mask pass for them).
 *
 * Authoring convention: paint `.skin` paths white (`#ffffff`) so
 * tinting multiplies cleanly to the target skinTone. Paths painted
 * at a specific tone still work — tinting multiplies the authored
 * color by skinTone — but produces a darker result than pure white.
 */
/**
 * DOM-Element children iterator — walks `childNodes` and filters to
 * nodeType 1 (Element). Keeps the implementation compatible across
 * browser DOMParser and node-side xmldom (used in tests), neither of
 * which guarantees `Element.children`.
 */
function elementChildren(el: Element): Element[] {
  const out: Element[] = [];
  const nodes = el.childNodes;
  if (!nodes) return out;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n && n.nodeType === 1) out.push(n as Element);
  }
  return out;
}

export function extractSkinMaskSvg(svgText: string): string | null {
  if (!svgText.includes('class="skin"')) return null;
  // Browser-only — DOMParser is ambient in Pixi apps. The caller
  // (ensureSpritesLoaded) runs inside a mounted PixiStage / RigPreview,
  // so DOMParser is always available here.
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') return null;

  // First pass: mark every element whose `class` attribute contains
  // the token "skin", plus their ancestors up to <svg> so wrapping
  // groups stay visible. Manual recursion because xmldom (used in the
  // test env shim) doesn't implement querySelectorAll.
  const keep = new Set<Element>();
  const markAncestors = (el: Element) => {
    let cur: Element | null = el;
    while (cur && cur !== root) {
      keep.add(cur);
      cur = cur.parentElement;
    }
  };
  const hasSkinClass = (el: Element): boolean => {
    const cls = el.getAttribute('class');
    if (!cls) return false;
    return cls.split(/\s+/).includes('skin');
  };
  const findSkin = (el: Element) => {
    if (hasSkinClass(el)) markAncestors(el);
    for (const child of elementChildren(el)) findSkin(child);
  };
  findSkin(root);
  if (keep.size === 0) return null;

  // Second pass: hide every element NOT in `keep` and NOT a <defs>.
  // Walk the tree manually so we don't re-hide keeps that live inside
  // a wrapping <g> that we marked as an ancestor.
  const walk = (el: Element) => {
    for (const child of elementChildren(el)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'defs') {
        // defs stays — clipPath / gradient refs may be used by skin paths.
        continue;
      }
      if (!keep.has(child)) {
        child.setAttribute('display', 'none');
      } else {
        walk(child);
      }
    }
  };
  walk(root);

  return new XMLSerializer().serializeToString(root);
}

/**
 * Browser-side fetch + extract wrapper. Returns a data URL suitable
 * for passing to Pixi.Assets.load, or null when the source SVG has
 * no skin markers. Caller decides whether to preload the data URL
 * under a second cache key.
 */
export async function loadSkinMaskDataUrl(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  const masked = extractSkinMaskSvg(text);
  if (!masked) return null;
  return `data:image/svg+xml;utf8,${encodeURIComponent(masked)}`;
}
