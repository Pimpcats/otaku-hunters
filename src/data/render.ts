// 2.5D rendering tunables (Milestone: 2.5D Rendering Pass).
//
// Every depth-illusion parameter lives here as a live-tunable value so "how 3D it
// feels" is a set of dials, not a baked decision. The game stays a flat Phaser 2D
// sprite game — these only affect RENDERING (sort order, shadows, a tilted ground
// illusion, parallax, and a poppy grade). Gameplay/positions are untouched.
//
// Defaults lean SUBTLE + BRIGHT: start low on tilt, keep the palette poppy and
// cheerful (Stardew-like), never moody/dark. Push them up in playtest.

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
  floorTexture: true, // false → fall back to the wireframe grid for comparison
  floorTileWorld: 110, // world px that one texture tile spans (bigger = crisper recession)

  // ── Layer 4: Parallax background ────────────────────────────────────────────
  parallax: true,
  parallaxStrength: [0.12, 0.3, 0.55] as number[], // far → near, fraction of camera scroll

  // ── Layer 5: Vibrant atmosphere (poppy, NOT dark) ───────────────────────────
  vignette: 0.26, // 0..1 strength of the soft edge-darkening
  ambientTint: 0xffffff, // full-screen MULTIPLY grade — neutral by default, never dark
  grade: 0xffe9c8, // warm "poppy" wash (ADD)
  gradeStrength: 0.05, // 0..1 strength of the warm wash
  bloom: true, // soft additive glow on bright elements (XP/attacks) if it holds FPS

  // ── Palette (bright + saturated; swappable for real art later) ───────────────
  skyTop: 0x3a2d6e, // back-wall / far band (upper screen)
  skyBottom: 0x4a3a86,
  floorFar: 0x232a5e, // floor at the horizon (slightly deeper)
  floorNear: 0x2f3b86, // floor at the player's feet (brighter, closer)
  gridColor: 0x5468c0, // floor grid lines — bright enough to read the recession
  gridFar: 0x2b356a, // grid lines fade toward this near the horizon
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
