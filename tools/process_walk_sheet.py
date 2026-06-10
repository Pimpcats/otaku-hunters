#!/usr/bin/env python3
"""Process a green-screen character walk sheet into normalized, baseline-aligned frames.

Usage: python3 tools/process_walk_sheet.py <input.png> <out_dir> <base_name>
e.g.   python3 tools/process_walk_sheet.py "assets-raw/kohai_walk_down.png" \
           public/assets/characters kohai_walk_down

Pipeline:
 1. Chroma removal — hard (#00FF00-ish: G>180 & R<110 & B<110) + tight fringe
    pass ((G - max(R,B)) > 60 & G > 140), same recipe proven on the arena art.
 2. 2px gaussian feather on the alpha edge + green despill (G -> avg(R,B)) on
    partial-alpha pixels.
 3. Slice frames at fully-transparent vertical gaps (no trimming inside a frame).
 4. Normalize: every frame on an IDENTICAL canvas — feet baseline-aligned (solid
    alpha bottom -> common baseline) and horizontally centered on the alpha
    centroid, so the loop doesn't jitter.

Outputs <base_name>_f1.png .. _fN.png plus a single horizontal sheet
<base_name>_sheet.png, and prints the frame size for the Phaser spritesheet load.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

SOLID = 128  # alpha threshold for bbox/baseline measurement (ignores feather tail)


def chroma_key(im: Image.Image) -> np.ndarray:
    a = np.array(im.convert('RGBA')).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    hard = (G > 180) & (R < 110) & (B < 110)
    fringe = ((G - np.maximum(R, B)) > 60) & (G > 140)
    remove = hard | fringe
    alpha = np.where(remove, 0, 255).astype(np.uint8)
    alpha = np.array(Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(2)))
    alpha = np.where(remove & (alpha < 16), 0, alpha).astype(np.uint8)
    edge = (alpha > 0) & (alpha < 255)
    avg_rb = (R + B) // 2
    spill = edge & (G > avg_rb)
    Gout = np.where(spill, avg_rb, G)
    return np.dstack([R, Gout, B, alpha]).astype(np.uint8)


def slice_frames(rgba: np.ndarray) -> list[np.ndarray]:
    """Split at columns that are fully transparent (the gaps between figures)."""
    occupied = (rgba[..., 3] > 0).any(axis=0)
    frames, start = [], None
    for x, occ in enumerate(occupied.tolist() + [False]):
        if occ and start is None:
            start = x
        elif not occ and start is not None:
            frames.append(rgba[:, start:x])
            start = None
    return frames


def normalize(frames: list[np.ndarray], pad: int = 4) -> list[np.ndarray]:
    """Identical canvases; feet on a common baseline; centered on alpha centroid."""
    stats = []
    for f in frames:
        solid = f[..., 3] >= SOLID
        ys, xs = np.where(solid)
        any_ys, any_xs = np.where(f[..., 3] > 0)
        stats.append({
            'foot': ys.max(),                    # solid-alpha bottom = feet
            'top': any_ys.min(), 'bottom': any_ys.max(),
            'cx': xs.mean(),                     # solid-alpha centroid x
            'left': any_xs.min(), 'right': any_xs.max(),
        })
    # canvas tall enough for the largest above-foot extent + below-foot feather
    above = max(s['foot'] - s['top'] for s in stats)
    below = max(s['bottom'] - s['foot'] for s in stats)
    half_w = max(max(s['cx'] - s['left'], s['right'] - s['cx']) for s in stats)
    W = int(np.ceil(half_w)) * 2 + 1 + 2 * pad
    H = above + below + 1 + 2 * pad
    baseline = pad + above  # same row in every canvas
    out = []
    for f, s in zip(frames, stats):
        canvas = np.zeros((H, W, 4), dtype=np.uint8)
        oy = baseline - s['foot']
        ox = int(round(W / 2 - s['cx']))
        h, w = f.shape[:2]
        canvas[oy:oy + h, ox:ox + w] = f
        out.append(canvas)
    return out


def main() -> None:
    src, out_dir, base = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
    rgba = chroma_key(Image.open(src))
    frames = normalize(slice_frames(rgba))
    print(f'{len(frames)} frames, canvas {frames[0].shape[1]}x{frames[0].shape[0]}')
    for i, f in enumerate(frames, 1):
        Image.fromarray(f, 'RGBA').save(f'{out_dir}/{base}_f{i}.png')
    sheet = np.concatenate(frames, axis=1)
    Image.fromarray(sheet, 'RGBA').save(f'{out_dir}/{base}_sheet.png')
    h, w = frames[0].shape[:2]
    print(f'sheet: {out_dir}/{base}_sheet.png  ->  frameWidth: {w}, frameHeight: {h}')
    # verify: zero visible chroma green
    vis = sheet[..., 3] > 0
    pure = vis & (sheet[..., 0] < 30) & (sheet[..., 1] > 220) & (sheet[..., 2] < 30)
    print(f'visible chroma-green px remaining: {int(pure.sum())}')


if __name__ == '__main__':
    main()
