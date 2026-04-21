#!/usr/bin/env node
/**
 * Second-stage sprite split: pulls the ARMS section out of each
 * *_body.svg and writes it as *_arms.svg. The trimmed body (head +
 * torso + legs, no arms) is written as *_torso.svg so the original
 * *_body.svg files stay on disk unchanged as a legacy reference.
 *
 * Both outputs share the original 96×128 viewBox + <defs>, so the arm
 * pixels can be layered on top of the torso sprite at matching anchor/
 * position and the composite renders identically to the unsplit body.
 *
 * The renderer mounts the arms sprite inside the weapon wrap so arms
 * rotate + translate with the weapon — true arms-independent-of-torso
 * animation.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('public/styles/flat');

const BODIES = [
  'soldier_body.svg',
  'soldier_warden_body.svg',
  'soldier_mystic_body.svg',
  'soldier_sapper_body.svg',
  'enemy_goblin_body.svg',
  'enemy_orc_body.svg',
  'enemy_troll_body.svg',
];

for (const file of BODIES) {
  const srcPath = path.join(DIR, file);
  const src = fs.readFileSync(srcPath, 'utf8');
  const lines = src.split('\n');

  const armsStart = lines.findIndex((l) => /<!--\s*ARMS?\b/i.test(l));
  if (armsStart < 0) { console.warn(`! no ARMS marker in ${file}`); continue; }
  const closeIdx = lines.findLastIndex((l) => l.includes('</svg>'));
  if (closeIdx < 0) { console.warn(`! no </svg> in ${file}`); continue; }
  const defsEndIdx = lines.findIndex((l) => l.includes('</defs>'));
  if (defsEndIdx < 0) { console.warn(`! no </defs> in ${file}`); continue; }

  const header = lines.slice(0, defsEndIdx + 1);
  const torso = lines.slice(defsEndIdx + 1, armsStart);
  const arms = lines.slice(armsStart, closeIdx);
  const close = lines[closeIdx];

  const torsoOut = [...header, ...torso, close].join('\n');
  const armsOut = [...header, ...arms, close].join('\n');

  const base = file.replace('_body.svg', '');
  fs.writeFileSync(path.join(DIR, `${base}_torso.svg`), torsoOut);
  fs.writeFileSync(path.join(DIR, `${base}_arms.svg`), armsOut);
  console.log(`split ${file} → ${base}_torso.svg + ${base}_arms.svg`);
}
