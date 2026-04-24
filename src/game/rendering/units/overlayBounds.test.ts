import { describe, it, expect } from 'vitest';
import { ALL_PACKS } from '../../../content/registry';
import type { Armor } from '../../types';

// Project tsconfig excludes @types/node; declare only what this test needs.
declare function require(id: 'fs'): { readFileSync(p: string, enc: string): string };
declare function require(id: 'path'): { resolve(...parts: string[]): string };
declare const process: { cwd(): string };
const { readFileSync } = require('fs');
const { resolve } = require('path');

/**
 * Guard-rail: every armor chest piece's torso overlay must draw
 * inside the torso band. The original bug that motivated this test
 * was Eagle Corps class-canonical chest pieces (warded_plate_chest,
 * mithril_vest_chest, etc.) pointing at legacy full-body soldier
 * SVGs — head(y~0-38) + torso(y~38-76) + legs(y~76-128) all
 * bundled into one file. At torso zIndex (45, above the base head
 * at 40) those full-body sprites covered the entire rig, producing
 * the "dark silhouette with tiny head peeking out" render.
 *
 * The test walks every chest piece in every shipping pack, reads
 * the referenced SVG off disk, and extracts y-coordinates from the
 * common element types (rect, circle, ellipse, line, path absolute
 * M/L, polygon). Transforms (translate-y on <g>) are tracked so
 * decorative centered sigils don't false-positive. Upper- and
 * lower-bounds are chosen generously: TORSO_MIN=20 catches content
 * that bleeds up into the head band; TORSO_MAX=90 catches content
 * that drops into the legs.
 */

const TORSO_MIN = 20;
const TORSO_MAX = 90;

function extractYExtents(svgText: string): { minY: number; maxY: number } {
  // Strip <defs>...</defs>: gradient-coordinate y1/y2 are unitless 0..1
  // and would pollute the min/max scan.
  const body = svgText.replace(/<defs\b[\s\S]*?<\/defs>/g, '');
  let minY = Infinity;
  let maxY = -Infinity;
  const record = (y: number) => {
    if (!Number.isFinite(y)) return;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // Tokenise tags. Stack tracks active translate-y from <g transform=...>.
  const tagRe = /<(\/?)([a-zA-Z]+)\b([^>]*)\/?>/g;
  const tyStack: number[] = [];
  const ty = () => tyStack.reduce((a, b) => a + b, 0);
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body)) !== null) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3] ?? '';
    if (name === 'g') {
      if (closing) {
        tyStack.pop();
      } else {
        const tr = attrs.match(/transform\s*=\s*"[^"]*?translate\(\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)?\s*\)/);
        tyStack.push(tr && tr[2] != null ? parseFloat(tr[2]) : 0);
      }
      continue;
    }
    if (closing) continue;
    const off = ty();

    if (name === 'rect') {
      const y = attrs.match(/\by\s*=\s*"(-?\d+(?:\.\d+)?)"/);
      const h = attrs.match(/\bheight\s*=\s*"(-?\d+(?:\.\d+)?)"/);
      if (y) {
        record(parseFloat(y[1]) + off);
        if (h) record(parseFloat(y[1]) + parseFloat(h[1]) + off);
      }
      continue;
    }

    if (name === 'circle' || name === 'ellipse') {
      const cy = attrs.match(/\bcy\s*=\s*"(-?\d+(?:\.\d+)?)"/);
      const r =
        attrs.match(/\bry\s*=\s*"(-?\d+(?:\.\d+)?)"/) ??
        attrs.match(/\br\s*=\s*"(-?\d+(?:\.\d+)?)"/);
      if (cy) {
        const cyv = parseFloat(cy[1]);
        const rv = r ? parseFloat(r[1]) : 0;
        record(cyv - rv + off);
        record(cyv + rv + off);
      }
      continue;
    }

    if (name === 'line') {
      const y1 = attrs.match(/\by1\s*=\s*"(-?\d+(?:\.\d+)?)"/);
      const y2 = attrs.match(/\by2\s*=\s*"(-?\d+(?:\.\d+)?)"/);
      if (y1) record(parseFloat(y1[1]) + off);
      if (y2) record(parseFloat(y2[1]) + off);
      continue;
    }

    if (name === 'path') {
      const d = attrs.match(/\bd\s*=\s*"([^"]*)"/);
      if (d) {
        // Split the d string on command letters; then interpret each run.
        const parts = d[1].split(/(?=[A-Za-z])/);
        for (const part of parts) {
          const cmd = part[0];
          if (!cmd) continue;
          const nums = part
            .slice(1)
            .trim()
            .split(/[,\s]+/)
            .map(Number)
            .filter((n) => Number.isFinite(n));
          // Absolute M/L/T/Q/S/C: x,y pairs — y at odd indices.
          if ('MLTQSC'.includes(cmd)) {
            for (let i = 1; i < nums.length; i += 2) record(nums[i] + off);
          } else if (cmd === 'V') {
            // Absolute V: each num is a y.
            for (const n of nums) record(n + off);
          }
          // Relative (lowercase) and H/Z: skipped — approximation.
        }
      }
      continue;
    }

    if (name === 'polygon' || name === 'polyline') {
      const pts = attrs.match(/\bpoints\s*=\s*"([^"]*)"/);
      if (pts) {
        const nums = pts[1].trim().split(/[,\s]+/).map(Number);
        for (let i = 1; i < nums.length; i += 2) {
          if (Number.isFinite(nums[i])) record(nums[i] + off);
        }
      }
    }
  }

  return { minY, maxY };
}

describe('chest armor overlays stay inside the torso band', () => {
  for (const pack of ALL_PACKS) {
    const chestPieces: Armor[] = Object.values(pack.armor).filter((a) => a.slot === 'chest');
    for (const piece of chestPieces) {
      const url = piece.visual?.overlays?.torso?.svg;
      if (!url) continue; // invisible chest is fine
      it(`${pack.id}:${piece.id} torso overlay within y=[${TORSO_MIN}..${TORSO_MAX}]`, () => {
        const absPath = resolve(process.cwd(), 'public' + url);
        const text = readFileSync(absPath, 'utf8');
        const { minY, maxY } = extractYExtents(text);
        expect(minY).toBeGreaterThanOrEqual(TORSO_MIN);
        expect(maxY).toBeLessThanOrEqual(TORSO_MAX);
      });
    }
  }
});
