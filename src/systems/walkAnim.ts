import Phaser from 'phaser';

// Procedural "walk juice" shared by the in-game player and the character-select
// cards. It layers a step bob (squash/stretch) + a gentle side-rock on top of
// whatever frame/animation a sprite is showing, so EVERY character reads as
// walking even when its sheet has no usable walk frames (kohai/sensei). The goth
// (ronin) additionally swaps real frames — this bob just adds life on top.
//
// Deliberately touches ONLY scale + rotation, never position: the player's
// position is velocity-driven by Arcade physics, and writing `y` each frame
// would fight that and break vertical movement. Scale/rotation are free — the
// arcade body is an axis-aligned circle that ignores rotation and barely moves
// under a few-percent scale wobble.

interface BobData {
  phase: number;
  amt: number; // 0 = at rest, 1 = full walk; eases between so stops settle smoothly
  baseSX: number;
  baseSY: number;
}

const BOB = {
  rate: 0.011, // phase advance per ms while moving → ~3.5 steps/sec
  squash: 0.08, // vertical stretch amplitude (peaks once per step)
  pinch: 0.05, // horizontal squash, opposes the stretch to keep volume
  rock: 0.06, // side-rock rotation amplitude in radians (~3.4°)
  ease: 0.012, // how fast amplitude eases toward target per ms
};

/**
 * Record a sprite's resting scale so the bob can modulate around it. Call once,
 * AFTER the sprite's final scale is set (e.g. after configurePlayerSprite or the
 * card's portrait scaling). Starts each sprite at a random phase so a row of them
 * doesn't bob in lockstep.
 */
export function initWalkBob(sprite: Phaser.GameObjects.Sprite): void {
  sprite.setData('bob', {
    phase: Math.random() * Math.PI * 2,
    amt: 0,
    baseSX: sprite.scaleX,
    baseSY: sprite.scaleY,
  } satisfies BobData);
}

/**
 * Per-frame walk juice. While `moving`, advances the step phase and eases the
 * amplitude up; while idle, eases amplitude back to 0 so the sprite settles to
 * its resting pose. Safe to call every frame on any sprite that was init'd.
 */
export function tickWalkBob(sprite: Phaser.GameObjects.Sprite, moving: boolean, dtMs: number): void {
  const b = sprite.getData('bob') as BobData | undefined;
  if (!b) return;

  if (moving) b.phase += dtMs * BOB.rate; // advance the step phase only while walking
  b.amt = Phaser.Math.Linear(b.amt, moving ? 1 : 0, Math.min(1, dtMs * BOB.ease));

  const step = Math.sin(b.phase); // one full cycle = a left+right stride
  const bounce = Math.abs(step); // peaks once per footfall
  sprite.setScale(
    b.baseSX * (1 - BOB.pinch * bounce * b.amt),
    b.baseSY * (1 + BOB.squash * bounce * b.amt),
  );
  sprite.setRotation(BOB.rock * step * b.amt);
}
