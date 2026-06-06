// 2.5D rendering tunables (Milestone: 2.5D Rendering Pass).
//
// Every depth-illusion parameter lives here as a live-tunable value so "how 3D it
// feels" is a set of dials, not a baked decision. The game stays a flat Phaser 2D
// sprite game — these only affect RENDERING (sort order, shadows, a tilted ground
// illusion, parallax, and a poppy grade). Gameplay/positions are untouched.
//
// The full "look" (palette + atmosphere + neon glow) is bundled into named LOOKS
// you can swap wholesale in playtest by changing ACTIVE_LOOK. Default is "neon" —
// a dark Edgerunners night-city base with hot neon accents and an everything-glows
// bloom. Structural dials (tilt, grid size, shadows) stay on RENDER directly.

// ── Named looks (swap the whole vibe in one line: change ACTIVE_LOOK) ─────────
export interface Look {
  label: string;
  // palette
  skyTop: number;
  skyBottom: number;
  floorFar: number;
  floorNear: number;
  gridColor: number;
  gridFar: number;
  // atmosphere (baked screen overlay)
  vignette: number;
  ambientTint: number;
  grade: number;
  gradeStrength: number;
  // neon glow (camera post-FX; WebGL only, gracefully skipped on Canvas)
  bloom: boolean;
  bloomColor: number;
  bloomStrength: number;
  bloomBlur: number;
  bloomSteps: number;
  saturate: number; // ColorMatrix saturate amount: 0 = none, ~0.35 = punchy neon
}

export const LOOKS: Record<string, Look> = {
  // Hot neon on near-black: electric-cyan grid lines glowing on a dark floor,
  // a magenta-biased centre, deep vignette, everything-glows bloom (Edgerunners).
  neon: {
    label: 'Neon Edgerunners',
    skyTop: 0x0a0618, // near-black indigo back wall (upper screen)
    skyBottom: 0x1a0e3a, // dark purple toward the horizon so neon silhouettes read
    floorFar: 0x0c0a22, // very dark floor at the horizon
    floorNear: 0x1c1640, // dark indigo floor at the player's feet (slightly lifted)
    gridColor: 0x00eaff, // electric-cyan neon grid lines glowing on the dark floor
    gridFar: 0x2a1a6a, // grid lines fade to dark purple near the horizon
    vignette: 0.42, // deep dark edges (neon-night focus)
    ambientTint: 0xffffff, // no global multiply; the glow comes from post-FX
    grade: 0xff37c0, // hot-magenta wash biases the centre saturated
    gradeStrength: 0.05,
    bloom: true,
    bloomColor: 0xffffff,
    bloomStrength: 1.0,
    bloomBlur: 1.0,
    bloomSteps: 6,
    saturate: 0.35,
  },
  // Bright poppy daylight (the earlier Stardew direction) kept as a swap-in alt.
  stardew: {
    label: 'Stardew Daylight',
    skyTop: 0x57c1ff,
    skyBottom: 0xbfeaff,
    floorFar: 0x6fbf7a,
    floorNear: 0x9be08a,
    gridColor: 0xeafdf0,
    gridFar: 0x6fbf7a,
    vignette: 0.2,
    ambientTint: 0xffffff,
    grade: 0xffe9c8,
    gradeStrength: 0.05,
    bloom: true,
    bloomColor: 0xffffff,
    bloomStrength: 0.5,
    bloomBlur: 1.0,
    bloomSteps: 4,
    saturate: 0.12,
  },
};

/** Switch the whole visual vibe here. */
export const ACTIVE_LOOK: keyof typeof LOOKS = 'neon';
const L = LOOKS[ACTIVE_LOOK];

export const RENDER = {
  // ── Layer 1: Y-sort ────────────────────────────────────────────────────────
  ySort: true, // sort ground-occupiers by baseline y so lower-on-screen draws in front

  // ── Layer 2: Drop shadows ───────────────────────────────────────────────────
  shadows: true,
  shadowOpacity: 0.33, // 0..1 darkness of the planted ellipse
  shadowScaleY: 0.4, // vertical squash — shadows are flat ellipses on the floor
  shadowWidth: 0.92, // shadow width as a fraction of the sprite's display width
  shadowFootLift: 0.04, // nudge the shadow up from the very baseline by this × height

  // ── Layer 3: Tilted ground plane ────────────────────────────────────────────
  groundTilt: 0.4, // 0 = flat top-down grid, 1 = dramatic Hades-like recession. START LOW.
  horizonFrac: 0.18, // at full tilt, the floor's far edge sits this fraction down the screen
  cameraHeightBias: 0.12, // shifts framing up as tilt rises so the swarm stays visible (0..1)
  gridSize: 72, // world px between floor grid lines
  gridScroll: 1.0, // how strongly the floor grid tracks camera movement
  // Real tiling floor texture (vs. the wireframe grid). Same perspective/rowY
  // recession either way — this just swaps the wireframe look for a real surface.
  // DEFAULT false: the glowing electric-cyan wireframe grid on near-black IS the
  // neon Edgerunners payoff (Bible §3 gaps 1–2) and reads more "neon" than the
  // plain grayscale placeholder paver. Gap 3 (floor texture) is fully wired and a
  // one-line flip: drop a seamless tile into public/textures/floors/arcade_floor_tile.png
  // (see that folder's README), set this true, and it rides the same recession.
  floorTexture: true, // ON: the arcade neon tile (public/textures/floors/arcade_floor_tile.png)
  floorTileWorld: 110, // world px that one texture tile spans (bigger = crisper recession)
  floorTextureTint: 0xffffff, // mesh multiply tint NEAR (white = show colored art true); hazes to floorFar at the horizon

  // ── Layer 4: Parallax background ────────────────────────────────────────────
  parallax: true,
  parallaxStrength: [0.12, 0.3, 0.55] as number[], // far → near, fraction of camera scroll
  useParallaxArt: true, // true = real skyline art per layer (procedural where a layer has none);
  //                       false = the procedural rectangle silhouettes everywhere (A/B compare)

  // ── Layer 5: Atmosphere + neon glow (sourced from the ACTIVE_LOOK) ──────────
  vignette: L.vignette, // 0..1 soft edge-darkening (baked overlay)
  ambientTint: L.ambientTint, // full-screen MULTIPLY grade; neutral white = no-op
  grade: L.grade, // colour wash at the centre of the baked overlay
  gradeStrength: L.gradeStrength, // 0..1 strength of that wash
  // Camera post-FX (WebGL only; Canvas falls back to just the baked overlay):
  bloom: L.bloom, // the signature Edgerunners "everything glows"
  bloomColor: L.bloomColor,
  bloomStrength: L.bloomStrength, // glow intensity
  bloomBlur: L.bloomBlur, // glow blur radius
  bloomSteps: L.bloomSteps, // blur quality (more = smoother, costs a little)
  saturate: L.saturate, // ColorMatrix saturate amount (0 = none, ~0.35 = punchy)
  scanlines: false, // optional CRT scanline overlay (cheap; off by default)
  scanlineAlpha: 0.06, // darkness of each scanline row when enabled

  // ── Palette (sourced from the ACTIVE_LOOK; edit LOOKS above, not here) ───────
  // floorFar/floorNear multiply the grayscale floor tile (so they colour the
  // surface); sky values drive the back wall + parallax silhouettes; gridColor is
  // the wireframe-fallback line colour.
  skyTop: L.skyTop,
  skyBottom: L.skyBottom,
  floorFar: L.floorFar,
  floorNear: L.floorNear,
  gridColor: L.gridColor,
  gridFar: L.gridFar,
};

// Depth bands. Entities are y-sorted using their baseline y, which lives in
// [0, WORLD] (~4000), so everything that must sit ABOVE the swarm uses a band well
// past that, and everything BELOW (ground, shadows, parallax) uses negatives.
export const DEPTH = {
  parallaxFar: -300000, // farther parallax layers subtract more from here
  ground: -100000,
  grid: -90000,
  shadow: -80000,
  // entities: y-sorted, depth === baseline y, roughly [0 .. 4000]
  vfx: 50000, // bursts / hit sparks, above the swarm
  hpBar: 80000,
  label: 90000,
  atmosphere: 94000, // vignette + grade overlays
  hud: 100000,
  banner: 110000,
  overlay: 120000, // end screen
};

/** Baseline (feet) y of a display object — where it meets the floor; the anchor
 *  for both y-sort and its shadow. */
export function baselineY(obj: { y: number; displayHeight: number; originY: number }): number {
  return obj.y + obj.displayHeight * (1 - obj.originY);
}
