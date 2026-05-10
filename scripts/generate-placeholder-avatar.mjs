#!/usr/bin/env node
// Generates 4 placeholder pixel-art avatar frames.
// Replace these PNGs with real art in public/avatar/ to swap in real frames.
//
// Frames produced (32x32 logical, monochrome pink palette):
//   public/avatar/idle-1.png   -- neutral pose, eyes open
//   public/avatar/idle-2.png   -- subtle breathe (one row shifted)
//   public/avatar/talk-1.png   -- mouth closed
//   public/avatar/talk-2.png   -- mouth open
//
// Run: node scripts/generate-placeholder-avatar.mjs

import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'avatar');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const SIZE = 32;
const PALETTE = {
  bg: [0, 0, 0, 0],          // transparent
  body: [255, 77, 109, 255], // #FF4D6D
  shadow: [138, 14, 42, 255],// #8A0E2A
  light: [255, 209, 220, 255],// #FFD1DC
  white: [255, 255, 255, 255],
  black: [22, 6, 12, 255],
};

// 32x32 grid string. Characters:
//   . = transparent, # = body, S = shadow, L = light, W = white, B = black
// Body shape: a rounded chunky blob with two eyes, optional mouth (m for closed, M for open).
//
// Frame layouts. Empty rows trimmed for readability — pad to 32 rows.

const BASE = `
................................
................................
................................
................................
................................
................................
.........SSSSSSSSSSSSSSS........
........S###############S.......
.......S##LLLLLLLLLLLLLL##S.....
......S##LLLLLLLLLLLLLLLLL##S...
.....S##LL####LLLLLL####LL##S...
....S##LLL####LLLLLL####LLL##S..
....S##LLLBBLLLLLLLLLLBBLLLL##S.
....S##LLLBBLLLLLLLLLLBBLLLL##S.
....S##LLLLLLLLLLLLLLLLLLLLL##S.
....S##LLLLLLLLLLLLLLLLLLLLL##S.
....S##LLLLLLL$$$$$$$$LLLLLL##S.
....S##LLLLLLLLLLLLLLLLLLLLL##S.
....S##LLLLLLLLLLLLLLLLLLLLL##S.
.....S##LLLLLLLLLLLLLLLLLL##S...
......S##LLLLLLLLLLLLLLLL##S....
.......S##LLLLLLLLLLLLLL##S.....
........S################S......
.........SSSSSSSSSSSSSSSS.......
.................S..............
................SSS.............
.................S..............
................................
................................
................................
................................
................................
`;

function makeFrame({ shiftDown = 0, mouth = 'closed' } = {}) {
  // Replace `$$$$$$$$` placeholder with mouth pattern
  const mouthLine =
    mouth === 'open' ? 'BBBBBBBB' : mouth === 'wide' ? 'BBBBBBBBBB' : '..BBBB..';
  let g = BASE.trim().replace(/\$+/g, () => mouthLine.padEnd(8, '.').slice(0, 8));
  let rows = g.split('\n').map((r) => r.padEnd(SIZE, '.').slice(0, SIZE));
  while (rows.length < SIZE) rows.push('.'.repeat(SIZE));
  rows = rows.slice(0, SIZE);
  if (shiftDown > 0) {
    rows = [...new Array(shiftDown).fill('.'.repeat(SIZE)), ...rows].slice(0, SIZE);
  }
  return rows;
}

function colorFor(ch) {
  switch (ch) {
    case '#':
      return PALETTE.body;
    case 'S':
      return PALETTE.shadow;
    case 'L':
      return PALETTE.light;
    case 'W':
      return PALETTE.white;
    case 'B':
      return PALETTE.black;
    default:
      return PALETTE.bg;
  }
}

function writePng(rows, file) {
  const png = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) {
    const line = rows[y] || '.'.repeat(SIZE);
    for (let x = 0; x < SIZE; x++) {
      const idx = (SIZE * y + x) << 2;
      const [r, g, b, a] = colorFor(line[x] ?? '.');
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  writeFileSync(file, PNG.sync.write(png));
}

writePng(makeFrame({ shiftDown: 0, mouth: 'closed' }), resolve(OUT, 'idle-1.png'));
writePng(makeFrame({ shiftDown: 1, mouth: 'closed' }), resolve(OUT, 'idle-2.png'));
writePng(makeFrame({ shiftDown: 0, mouth: 'closed' }), resolve(OUT, 'talk-1.png'));
writePng(makeFrame({ shiftDown: 0, mouth: 'open' }), resolve(OUT, 'talk-2.png'));

console.log(`Wrote 4 placeholder avatar PNGs -> ${OUT}`);
