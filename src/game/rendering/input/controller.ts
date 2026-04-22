import type { Vec2 } from '../../types';
import { screenToGrid } from '../isoProjection';

/** Mutable camera used by the renderer. */
export type Camera = { x: number; y: number; zoom: number };

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.2;
const DRAG_THRESHOLD_PX = 6;

/**
 * Attach pan / zoom / pinch / tap handlers to the Pixi canvas.
 *   - Single-pointer drag pans the camera.
 *   - Two-pointer pinch zooms the camera.
 *   - Wheel zooms at cursor (well, at camera origin — pointer-anchored
 *     zoom is a future enhancement).
 *   - A pointer-up without a drag > threshold counts as a tap; the
 *     canvas coords get converted to grid coords and forwarded to
 *     `onTap`.
 *
 * Returns a cleanup function that removes every listener.
 */
export function attachInputController(args: {
  canvas: HTMLCanvasElement;
  cam: Camera;
  applyCam: () => void;
  onTap: (g: Vec2) => void;
}): () => void {
  const { canvas, cam, applyCam, onTap } = args;

  const pointers = new Map<number, { x: number; y: number }>();
  let panStart: { cx: number; cy: number; px: number; py: number } | null = null;
  let pinchStart: { dist: number; zoom: number } | null = null;
  let dragged = false;

  const screenToWorld = (x: number, y: number) => ({
    x: (x - cam.x) / cam.zoom,
    y: (y - cam.y) / cam.zoom,
  });

  canvas.style.touchAction = 'none';

  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    if (pointers.size === 1) {
      panStart = { cx: cam.x, cy: cam.y, px: e.clientX, py: e.clientY };
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      pinchStart = { dist: Math.hypot(dx, dy), zoom: cam.zoom };
      panStart = null;
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && panStart) {
      const dx = e.clientX - panStart.px, dy = e.clientY - panStart.py;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) dragged = true;
      cam.x = panStart.cx + dx; cam.y = panStart.cy + dy;
      applyCam();
    } else if (pointers.size === 2 && pinchStart) {
      const pts = [...pointers.values()];
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const d = Math.hypot(dx, dy);
      cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStart.zoom * (d / pinchStart.dist)));
      dragged = true;
      applyCam();
    }
  };

  const onUp = (e: PointerEvent) => {
    const hadTwo = pointers.size === 2;
    pointers.delete(e.pointerId);
    if (!hadTwo && !dragged) {
      const rect = canvas.getBoundingClientRect();
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      onTap(screenToGrid(w));
    }
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) panStart = null;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    applyCam();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}
