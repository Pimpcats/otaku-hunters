import Phaser from 'phaser';

// Procedural "walk juice" shared by the in-game player and the character-select
// cards: a smooth vertical bob + a gentle squash synced to it, so EVERY character
// reads as walking even when its sheet has no usable walk frames. The goth (ronin)
// additionally swaps real frames — this just adds bounce on top.
//
// Design notes (why it looks fluid rather than jittery):
//   • Vertical POSITION hop, not rotation. An oscillating rotation pivots the
//     sprite around its centre and swings the head side to side, which reads as
//     wobbling. A clean up/down bob reads as walking.
//   • The hop uses (1 - cos2φ)/2 — a smooth raised curve with no cusps, so there
//     is no per-step "hitch" (the old abs(sin) had a sharp V at each contact).
//   • Squash is anti-synced to the hop: squat + widen at the contact (foot down),
//     stretch + narrow at the apex. Volume stays roughly constant.
//   • Amplitude eases in/out, so starting and stopping glide — a stop settles the
//     bob to zero and the sprite returns to a clean standing pose.
//
// Because it moves the sprite's POSITION, callers pass the anchor (baseX, baseY)
// the sprite should bob around. For the in-game player that anchor is the
// (invisible) physics body's position, so the hitbox/camera never bob; for a card
// it's the portrait's fixed home position.

interface BobData {
  phase: number;
  amt: number; // 0 = at rest, 1 = full walk; eased so starts/stops glide
  baseSX: number;
  baseSY: number;
  hopPx: number; // hop height in px, derived from the sprite's display height
}

const BOB = {
  rate: 0.0095, // step-phase advance per ms while moving → ~2.6 steps/sec
  hop: 0.1, // hop height as a fraction of the sprite's display height
  squash: 0.06, // squash/stretch amount, synced to the hop
  ease: 0.011, // how fast amplitude eases toward its target, per ms
};

/**
 * Record a sprite's resting scale + size so the bob can modulate around it. Call
 * once, AFTER the sprite's final scale is set. Starts at a random phase so a row
 * of sprites doesn't bob in lockstep.
 */
export function initWalkBob(sprite: Phaser.GameObjects.Sprite): void {
  sprite.setData('bob', {
    phase: Math.random() * Math.PI * 2,
    amt: 0,
    baseSX: sprite.scaleX,
    baseSY: sprite.scaleY,
    hopPx: Math.max(2, sprite.displayHeight * BOB.hop),
  } satisfies BobData);
}

/**
 * Per-frame walk juice. Positions the sprite at (baseX, baseY) plus a smooth
 * vertical bob, and applies a synced squash — while `moving`, eased up; while
 * idle, eased back to a clean resting pose at the anchor. Safe to call every
 * frame on any sprite that was init'd.
 */
export function tickWalkBob(
  sprite: Phaser.GameObjects.Sprite,
  baseX: number,
  baseY: number,
  moving: boolean,
  dtMs: number,
): void {
  const b = sprite.getData('bob') as BobData | undefined;
  if (!b) return;

  if (moving) b.phase += dtMs * BOB.rate; // advance the step phase only while walking
  b.amt = Phaser.Math.Linear(b.amt, moving ? 1 : 0, Math.min(1, dtMs * BOB.ease));

  const c = Math.cos(2 * b.phase);
  const lift = (1 - c) * 0.5; // 0 at each footfall, 1 at the apex — smooth, no cusp
  sprite.setPosition(baseX, baseY - b.hopPx * lift * b.amt);
  sprite.setScale(
    b.baseSX * (1 + BOB.squash * c * b.amt), // widen at contact, narrow at apex
    b.baseSY * (1 - BOB.squash * c * b.amt), // squat at contact, stretch at apex
  );
}
