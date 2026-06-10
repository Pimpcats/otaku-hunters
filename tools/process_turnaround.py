#!/usr/bin/env python3
"""Slice an already-transparent (RGBA) 4-view turnaround sheet into facing sprites.

Usage: python3 tools/process_turnaround.py <input.png> <out_dir> <name>
e.g.   python3 tools/process_turnaround.py assets-raw/kohai_v2_sheet.png \
           public/assets/characters kohai_v2

Sheet layout (horizontal row): front, back, right profile, left profile
(verified against the v2 sheets — the profiles are in this order, not L-then-R).
Saves {name}_down.png (front), {name}_up.png (back), {name}_side.png (the RIGHT
profile, view 3 — the game flipXes it for left), all normalized onto one identical
canvas with feet baseline-aligned and alpha-centroid centering (no jitter
between facings). The left profile (view 4) is sliced but not saved.

If two figures touch (no fully-transparent gap), the widest segment is force-
split at its minimum-alpha-occupancy column until 4 views exist.
"""
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from process_walk_sheet import normalize, slice_frames  # noqa: E402

MIN_SEG_W = 40  # ignore stray-pixel slivers narrower than this


def slice_views(rgba: np.ndarray, expected: int = 4) -> list[np.ndarray]:
    views = [v for v in slice_frames(rgba) if v.shape[1] >= MIN_SEG_W]
    while len(views) < expected:
        # widest segment holds the merged figures; cut at its sparsest column,
        # searching the middle half so we never shave a figure's outer edge
        i = int(np.argmax([v.shape[1] for v in views]))
        v = views[i]
        w = v.shape[1]
        occ = (v[..., 3] > 0).sum(axis=0)
        lo, hi = w // 4, 3 * w // 4
        cut = int(np.argmin(occ[lo:hi])) + lo
        print(f'  forced split of {w}px segment at col {cut} (occupancy {occ[cut]})')
        views[i:i + 1] = [v[:, :cut], v[:, cut:]]
    if len(views) != expected:
        raise SystemExit(f'expected {expected} views, found {len(views)}')
    return views


def main() -> None:
    src, out_dir, name = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
    rgba = np.array(Image.open(src).convert('RGBA'))
    views = normalize(slice_views(rgba))
    h, w = views[0].shape[:2]
    print(f'{src}: 4 views normalized to {w}x{h}')
    out = {'down': views[0], 'up': views[1], 'side': views[2]}  # view 3 = RIGHT profile
    for suffix, v in out.items():
        path = f'{out_dir}/{name}_{suffix}.png'
        Image.fromarray(v, 'RGBA').save(path)
        print(f'  -> {path}')


if __name__ == '__main__':
    main()
