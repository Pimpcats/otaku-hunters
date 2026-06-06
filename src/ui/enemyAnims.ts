// Animated enemies: per-direction WALK cycles baked from a 4×4 walk sheet.
//
// A walk sheet is a uniform grid (default 4×4 @ 313px) of a single enemy:
//   row 0 = front/down · row 1 = back/up · row 2 = side-left · row 3 = side-right.
// We bake the frames DOWN to the enemy's in-game size (content-cropped + feet-aligned,
// so they match the tightly-sliced static frames), then register the cycles as
//   `${base}-down-walk` · `${base}-up-walk` · `${base}-side-walk`
// — the exact keys applyFacing() already prefers over the static directional frame.
// So once these anims exist, a moving enemy animates with ZERO change to the facing
// code; absent (sheet not dropped in) it cleanly stays on its static art.
//
// `side` uses the RIGHT-facing row (12–15) to match the engine convention (side art
// faces right; applyFacing flips it for left). `reverseFacing` is read in RunScene,
// not here (it only swaps which cardinal is shown — TooCool walking backwards).

import Phaser from 'phaser';
import { TEX } from '../constants';
import type { FacingSet } from '../systems/facing';

export interface EnemyWalkSheet {
  id: string;
  path: string; // public-relative; loaded only when listed in art-manifest.json
  base: string; // TEX key; anims are keyed `${base}-${set}-walk`
  cols: number;
  rows: number;
  srcCell: number; // source frame px (square)
  frameRate: number;
  targetH: number; // baked character height px (match the static enemy size)
  frames: { down: number[]; up: number[]; side: number[] };
}

export const ENEMY_WALK_SHEETS: EnemyWalkSheet[] = [
  {
    id: 'tooCoolWalk',
    path: 'sprites/enemies/toocool_walk.webp',
    base: TEX.tooCool,
    cols: 4,
    rows: 4,
    srcCell: 313,
    frameRate: 8,
    targetH: 48,
    frames: { down: [0, 1, 2, 3], up: [4, 5, 6, 7], side: [12, 13, 14, 15] },
  },
  {
    id: 'rushFanWalk',
    path: 'sprites/enemies/rushfan_walk.webp',
    base: TEX.rushFan,
    cols: 4,
    rows: 4,
    srcCell: 313,
    frameRate: 10, // he's running — a touch faster than TooCool
    targetH: 48,
    frames: { down: [0, 1, 2, 3], up: [4, 5, 6, 7], side: [12, 13, 14, 15] },
  },
];

const loadKey = (id: string) => `ewalk_src_${id}`;
const sheetKey = (id: string) => `ewalk_${id}`;
const MANIFEST_KEY = 'art_manifest';

/** Queue the walk sheets that are actually present (per art-manifest.json). Call in
 *  preload AFTER loadKenneyAssets (which queues the manifest json). */
export function loadEnemyWalkSheets(scene: Phaser.Scene): void {
  const base = import.meta.env.BASE_URL;
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => {
    const data = scene.cache.json.get(MANIFEST_KEY) as unknown;
    const present = new Set(Array.isArray(data) ? (data as string[]) : []);
    for (const s of ENEMY_WALK_SHEETS) {
      if (present.has(s.path)) scene.load.image(loadKey(s.id), `${base}${s.path}`);
    }
  });
}

/** Content bounding box of one source frame (alpha > threshold), in cell coords. */
function frameBBox(
  px: Uint8ClampedArray,
  imgW: number,
  fx: number,
  fy: number,
  cell: number,
): { x: number; y: number; w: number; h: number } {
  let minx = cell;
  let miny = cell;
  let maxx = 0;
  let maxy = 0;
  let any = false;
  for (let y = 0; y < cell; y += 2) {
    const row = (fy + y) * imgW;
    for (let x = 0; x < cell; x += 2) {
      if (px[(row + fx + x) * 4 + 3] > 30) {
        any = true;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  return any ? { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 } : { x: 0, y: 0, w: cell, h: cell };
}

/** Bake one walk sheet to a downscaled spritesheet texture + register its anims. */
function bakeOne(scene: Phaser.Scene, s: EnemyWalkSheet): boolean {
  const srcKey = loadKey(s.id);
  if (!scene.textures.exists(srcKey)) return false; // sheet not dropped in → stay static
  const img = scene.textures.get(srcKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const imgW = img.width;
  const imgH = img.height;

  // Read the source pixels once (scratch canvas) to find each frame's content box.
  const scratch = scene.textures.createCanvas('_ewalk_scratch', imgW, imgH);
  if (!scratch) return false;
  const sctx = scratch.getContext();
  sctx.drawImage(img, 0, 0);
  const px = sctx.getImageData(0, 0, imgW, imgH).data;

  const N = s.cols * s.rows;
  const cell = s.srcCell;
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const dims: { dw: number; dh: number }[] = [];
  let maxW = 1;
  for (let f = 0; f < N; f++) {
    const fx = (f % s.cols) * cell;
    const fy = Math.floor(f / s.cols) * cell;
    const b = frameBBox(px, imgW, fx, fy, cell);
    boxes.push(b);
    const sc = s.targetH / b.h;
    const dw = Math.max(1, Math.round(b.w * sc));
    dims.push({ dw, dh: s.targetH });
    if (dw > maxW) maxW = dw;
  }

  const cellW = maxW + 4;
  const cellH = s.targetH + 6;
  const sheetK = sheetKey(s.id);
  if (scene.textures.exists(sheetK)) scene.textures.remove(sheetK);
  const sheet = scene.textures.createCanvas(sheetK, cellW * N, cellH);
  if (!sheet) {
    scene.textures.remove('_ewalk_scratch');
    return false;
  }
  const dctx = sheet.getContext();
  dctx.imageSmoothingEnabled = true;
  for (let f = 0; f < N; f++) {
    const b = boxes[f];
    const { dw, dh } = dims[f];
    const fx = (f % s.cols) * cell;
    const fy = Math.floor(f / s.cols) * cell;
    const dx = f * cellW + Math.floor((cellW - dw) / 2); // centre horizontally
    const dy = cellH - dh; // feet at the cell bottom
    dctx.drawImage(img, fx + b.x, fy + b.y, b.w, b.h, dx, dy, dw, dh);
    sheet.add(f, 0, f * cellW, 0, cellW, cellH);
  }
  sheet.refresh();
  scene.textures.remove('_ewalk_scratch');

  const SETS: FacingSet[] = ['down', 'up', 'side'];
  for (const set of SETS) {
    const idxs = s.frames[set];
    if (!idxs?.length) continue;
    const key = `${s.base}-${set}-walk`;
    if (scene.anims.exists(key)) scene.anims.remove(key);
    scene.anims.create({
      key,
      frames: idxs.map((frame) => ({ key: sheetK, frame })),
      frameRate: s.frameRate,
      repeat: -1,
    });
  }
  return true;
}

/** Bake every present walk sheet + register its per-direction walk anims. Call in
 *  create() (after the static enemy art is baked). Missing sheets are skipped. */
export function bakeEnemyWalkSheets(scene: Phaser.Scene): void {
  let n = 0;
  for (const s of ENEMY_WALK_SHEETS) if (bakeOne(scene, s)) n++;
  if (n > 0) console.info(`[OtakuHunter] enemy walk anims active for ${n}/${ENEMY_WALK_SHEETS.length} sheet(s).`);
}
