#!/usr/bin/env node
/**
 * Split each character SVG in public/styles/flat into two siblings:
 *   <name>_body.svg    — everything up to the weapon section.
 *   <name>_weapon.svg  — just the weapon, preserving the original viewBox/defs.
 *
 * Both outputs keep the original 96×128 viewBox so pixel coordinates stay
 * identical — the Pixi renderer can layer them with matching anchor/position
 * and then rotate the weapon independently around a shared grip pivot.
 *
 * The baked shadow ellipse (first element after </defs>) is stripped from
 * both outputs; Pixi draws its own shadow Graphics under every unit.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('public/styles/flat');

/**
 * Each entry lists the comment fragment that marks the start of the weapon
 * section for that sprite. Everything from that line onward (up to </svg>)
 * moves into the weapon file.
 */
const SPRITES = [
  { file: 'soldier.svg',         weaponMarker: '<!-- RUNEWEAVE CARBINE' },
  { file: 'soldier_warden.svg',  weaponMarker: '<!-- DRAGONMAW AUTOCANNON' },
  { file: 'soldier_mystic.svg',  weaponMarker: '<!-- ARCLIGHT MARKSMAN' },
  { file: 'soldier_sapper.svg',  weaponMarker: '<!-- HEXBORE SCATTERGUN' },
  { file: 'enemy_goblin.svg',    weaponMarker: '<!-- SCRAP PIPE-GUN' },
  { file: 'enemy_orc.svg',       weaponMarker: '<!-- SCRAP ASSAULT RIFLE' },
  { file: 'enemy_troll.svg',     weaponMarker: '<!-- SCRAP HEAVY MACHINE GUN' },
];

// A baked-in shadow ellipse like `<ellipse cx="48" cy="120" rx="22" ry="4" fill="#000" opacity=".55"/>`
// — Pixi already draws its own shadow, so drop this.
const SHADOW_LINE = /<ellipse[^>]*fill="#000"[^>]*opacity="\.?\d/;

for (const { file, weaponMarker } of SPRITES) {
  const srcPath = path.join(DIR, file);
  const src = fs.readFileSync(srcPath, 'utf8');
  const lines = src.split('\n');

  const weaponStart = lines.findIndex((l) => l.includes(weaponMarker));
  if (weaponStart < 0) { console.warn(`! no weapon marker in ${file}`); continue; }
  const closeIdx = lines.findLastIndex((l) => l.includes('</svg>'));
  if (closeIdx < 0) { console.warn(`! no </svg> in ${file}`); continue; }
  const defsEndIdx = lines.findIndex((l) => l.includes('</defs>'));
  if (defsEndIdx < 0) { console.warn(`! no </defs> in ${file}`); continue; }

  const header = lines.slice(0, defsEndIdx + 1);
  const postDefs = lines.slice(defsEndIdx + 1, weaponStart)
    .filter((l) => !SHADOW_LINE.test(l));
  const weaponLines = lines.slice(weaponStart, closeIdx);
  const close = lines[closeIdx];

  const bodyOut = [...header, ...postDefs, close].join('\n');
  const weaponOut = [...header, ...weaponLines, close].join('\n');

  const base = file.replace('.svg', '');
  fs.writeFileSync(path.join(DIR, `${base}_body.svg`), bodyOut);
  fs.writeFileSync(path.join(DIR, `${base}_weapon.svg`), weaponOut);
  console.log(`split ${file} → ${base}_body.svg + ${base}_weapon.svg`);
}
