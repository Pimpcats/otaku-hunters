// Animated enemies: per-direction WALK cycles baked from a walk sheet.
//
// A walk sheet is a uniform grid (cols × rows of square frames) of one enemy. We
// bake the used frames DOWN to the enemy's in-game size (content-cropped + feet-
// aligned, so they match the tightly-sliced static frames) into a spritesheet, then
// register each direction's cycle as `${base}-${dir}-walk` — the keys applyFacing()
// resolves (8-dir first, then a 4-dir fallback). So:
//   • a 4-dir sheet registers down/up/side  → applyFacing mirrors side for left and
//     uses it for diagonals (graceful 4-dir behaviour);
//   • an 8-dir sheet registers down/up/left/right + the 4 diagonals → true 8-way.
// Absent sheet → the enemy stays on its static directional art. Adding a new animated
// enemy (or upgrading one to 8-dir) is a single config entry here.
//
// Frame cell size is DERIVED from the image so a sheet that was resized on upload
// (e.g. 1254→1000 wide) still slices correctly — we trust the grid (cols), not px.

import Phaser from 'phaser';
import { TEX } from '../constants';

export interface EnemyWalkSheet {
  id: string;
  path: string; // public-relative; loaded only when listed in art-manifest.json
  base: string; // TEX key; anims are keyed `${base}-${dir}-walk`
  cols: number; // grid columns (rows are derived from the image height)
  frameRate: number;
  targetH: number; // baked character height px (match the static enemy size)
  // dir/set suffix → source frame indices. Use down/up/side for a 4-dir sheet, or
  // down/up/left/right/downleft/downright/upleft/upright for a full 8-dir sheet.
  anims: Record<string, number[]>;
}

export const ENEMY_WALK_SHEETS: EnemyWalkSheet[] = [
  {
    id: 'tooCoolWalk',
    path: 'sprites/enemies/toocool_walk.webp',
    base: TEX.tooCool,
    cols: 4,
    frameRate: 8,
    targetH: 48,
    // 4-dir sheet (row2 = left, row3 = right); use the right-facing row for `side`.
    anims: { down: [0, 1, 2, 3], up: [4, 5, 6, 7], side: [12, 13, 14, 15] },
  },
  {
    id: 'rushFanWalk',
    path: 'sprites/enemies/rushfan_walk.webp',
    base: TEX.rushFan,
    cols: 4,
    frameRate: 10, // running — a touch faster than TooCool
    targetH: 48,
    // 8-dir sheet: rows down/up/left/right then the 4 diagonals.
    anims: {
      down: [0, 1, 2, 3],
      up: [4, 5, 6, 7],
      left: [8, 9, 10, 11],
      right: [12, 13, 14, 15],
      downleft: [16, 17, 18, 19],
      downright: [20, 21, 22, 23],
      upleft: [24, 25, 26, 27],
      upright: [28, 29, 30, 31],
    },
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

/** Content bounding box of one cell (alpha > threshold), in cell-local coords. */
function cellBBox(
  px: Uint8ClampedArray,
  imgW: number,
  fx: number,
  fy: number,
  cw: number,
  ch: number,
): { x: number; y: number; w: number; h: number } {
  let minx = cw;
  let miny = ch;
  let maxx = 0;
  let maxy = 0;
  let any = false;
  for (let y = 0; y < ch; y += 2) {
    const row = (fy + y) * imgW;
    for (let x = 0; x < cw; x += 2) {
      if (px[(row + fx + x) * 4 + 3] > 30) {
        any = true;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  return any ? { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 } : { x: 0, y: 0, w: cw, h: ch };
}

/** Bake one walk sheet to a downscaled spritesheet texture + register its anims. */
function bakeOne(scene: Phaser.Scene, s: EnemyWalkSheet): boolean {
  const srcKey = loadKey(s.id);
  if (!scene.textures.exists(srcKey)) return false; // sheet not dropped in → stay static
  const img = scene.textures.get(srcKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const imgW = img.width;
  const imgH = img.height;

  // Derive the grid from the actual image (robust to upload resizing).
  const cw = Math.floor(imgW / s.cols);
  const rows = Math.max(1, Math.round(imgH / cw));
  const ch = Math.floor(imgH / rows);

  const scratch = scene.textures.createCanvas('_ewalk_scratch', imgW, imgH);
  if (!scratch) return false;
  const sctx = scratch.getContext();
  sctx.drawImage(img, 0, 0);
  const px = sctx.getImageData(0, 0, imgW, imgH).data;

  // The frames we actually use (union across all directions), in stable order.
  const used = [...new Set(Object.values(s.anims).flat())].sort((a, b) => a - b);
  const slotOf = new Map<number, number>();
  used.forEach((f, i) => slotOf.set(f, i));

  const boxes = new Map<number, { x: number; y: number; w: number; h: number }>();
  const dims = new Map<number, { dw: number; dh: number }>();
  let maxW = 1;
  for (const f of used) {
    const fx = (f % s.cols) * cw;
    const fy = Math.floor(f / s.cols) * ch;
    const b = cellBBox(px, imgW, fx, fy, cw, ch);
    boxes.set(f, b);
    const dw = Math.max(1, Math.round(b.w * (s.targetH / b.h)));
    dims.set(f, { dw, dh: s.targetH });
    if (dw > maxW) maxW = dw;
  }

  const cellW = maxW + 4;
  const cellH = s.targetH + 6;
  const sheetK = sheetKey(s.id);
  if (scene.textures.exists(sheetK)) scene.textures.remove(sheetK);
  const sheet = scene.textures.createCanvas(sheetK, cellW * used.length, cellH);
  if (!sheet) {
    scene.textures.remove('_ewalk_scratch');
    return false;
  }
  const dctx = sheet.getContext();
  dctx.imageSmoothingEnabled = true;
  for (const f of used) {
    const slot = slotOf.get(f)!;
    const b = boxes.get(f)!;
    const { dw, dh } = dims.get(f)!;
    const fx = (f % s.cols) * cw;
    const fy = Math.floor(f / s.cols) * ch;
    const dx = slot * cellW + Math.floor((cellW - dw) / 2); // centre horizontally
    const dy = cellH - dh; // feet at the cell bottom
    dctx.drawImage(img, fx + b.x, fy + b.y, b.w, b.h, dx, dy, dw, dh);
    sheet.add(f, 0, slot * cellW, 0, cellW, cellH); // frame name = original index
  }
  sheet.refresh();
  scene.textures.remove('_ewalk_scratch');

  for (const [suffix, idxs] of Object.entries(s.anims)) {
    if (!idxs.length) continue;
    const key = `${s.base}-${suffix}-walk`;
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
