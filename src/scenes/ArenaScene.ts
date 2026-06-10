import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants';
import { dirTextureKey, vectorToCardinal, type Cardinal, type FacingSet } from '../systems/facing';
import { PlayerFsm } from '../systems/playerFsm';
import { loadSlashVfx, ensureSlashVfx, playSlash, signatureTint } from '../ui/vfx';

// ── Arena pivot: the sakura-plaza arena prototype ──────────────────────────────
// A fresh scene, built ALONGSIDE the street scene (Meta/Run untouched): one static
// background image, a hardcoded walkable polygon, the player, and a smooth-follow
// camera. No enemies/attacks/spawning yet.
//
// Player art: the v2 turnaround sprites (kohai_v2_{down,up,side}.png, side faces
// RIGHT) wired into the 4-direction facing convention — down/up/side + flipX for
// left. Static facings for now; v2 walk cycles come as separate sheets later.
//
// Debug: press G to toggle the walkable-polygon overlay (outline + numbered
// vertices) for tuning WALKABLE against the background art.

const ARENA_KEY = 'arena_sakura_plaza';
const KOHAI_BASE = 'kohai_v2'; // textures: kohai_v2_down / _up / _side (facing.ts convention)
const FACING_SETS: FacingSet[] = ['down', 'up', 'side'];

// Walkable region of the paved plaza, traced from sakura_plaza.png (1774×887)
// and inset ~30px from the visual edges — shop fronts (top), stone walls and
// fences (sides), the corner tree planters, and the bottom wall are all out of
// bounds. Points are image-space px, clockwise from the top-left of the shop row.
// Tune against the G overlay.
const WALKABLE: [number, number][] = [
  [730, 300], // 0 top-left end of shop row
  [1430, 290], // 1 top-right end of shop row
  [1560, 370], // 2 right fence, upper diagonal
  [1660, 470], // 3 right tip (gate area)
  [1500, 545], // 4 below the right wall
  [1320, 600], // 5 bottom-right diagonal (trees cut in)
  [1130, 660], // 6
  [960, 705], // 7 bottom edge, right end
  [745, 705], // 8 bottom edge, left end
  [480, 660], // 9 bottom-left diagonal (planter)
  [320, 600], // 10 bottom-left tree cut-in
  [135, 545], // 11 left wall, bottom
  [150, 460], // 12 left tip
  [260, 360], // 13 left-top diagonal
  [480, 310], // 14 up to the shop row
];

// Player start: the sakura emblem at the plaza center (measured centroid ~904,454;
// nudged down so the sprite's FEET sit on the emblem).
const START = { x: 890, y: 470 };

const PLAYER_SPEED = 250; // px/s
const PLAYER_H = 76; // display height in arena space (~70–80px target)
const PLAYER_W = 34; // capsule fallback width
const CAMERA_LERP = 0.08;
const VIEW_FRAC = 0.7; // ~70% of the arena width visible at once
const ARENA_CHAR_ID = 'kohai'; // whose art + signature color the arena player uses

// Attack hitbox (world px), placed in front of the facing; live on frames 2–3.
const HIT_REACH = 48; // feet → hitbox center, along the facing
const HIT_W = 72;
const HIT_H = 52;

export class ArenaScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private walkable!: Phaser.Geom.Polygon;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private debugLabels: Phaser.GameObjects.Text[] = [];
  private debugOn = false;
  private hasKohai = false;
  private facing: Cardinal = 'down';
  private fsm!: PlayerFsm;
  private hitGfx!: Phaser.GameObjects.Graphics; // live hitbox outline (G overlay)
  attackHitbox = new Phaser.Geom.Rectangle(0, 0, HIT_W, HIT_H); // for future enemy overlap

  constructor() {
    super('Arena');
  }

  preload() {
    this.load.image(ARENA_KEY, `${import.meta.env.BASE_URL}assets/arenas/sakura_plaza.png`);
    for (const set of FACING_SETS) {
      this.load.image(
        dirTextureKey(KOHAI_BASE, set),
        `${import.meta.env.BASE_URL}assets/characters/${KOHAI_BASE}_${set}.png`,
      );
    }
    loadSlashVfx(this); // no-op until the real sheet is dropped in (procedural fallback)
  }

  create() {
    // Static background (NOT a TileSprite); world bounds = the image's own size.
    const bg = this.add.image(0, 0, ARENA_KEY).setOrigin(0, 0).setDepth(0);
    // Painterly art, rendered below 1:1 by the zoom — linear filtering for THIS
    // texture only (the game config's pixelArt nearest-neighbor would shimmer).
    bg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const worldW = bg.width;
    const worldH = bg.height;

    this.walkable = new Phaser.Geom.Polygon(WALKABLE.map(([x, y]) => new Phaser.Geom.Point(x, y)));

    // Contact shadow under the feet — sized off the display height, sits just
    // beneath the player in depth so props can still slot between later.
    this.shadow = this.add.ellipse(START.x, START.y, PLAYER_H * 0.62, PLAYER_H * 0.2, 0x1a1126, 0.35);

    // Player: the v2 kohai facing sprites when present, else the capsule placeholder.
    // Origin bottom-center either way, so the FEET are what we clamp/sort by.
    this.hasKohai = FACING_SETS.every((s) => this.textures.exists(dirTextureKey(KOHAI_BASE, s)));
    if (this.hasKohai) {
      for (const set of FACING_SETS) {
        this.textures.get(dirTextureKey(KOHAI_BASE, set)).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      this.player = this.add.sprite(START.x, START.y, dirTextureKey(KOHAI_BASE, 'down'));
      this.player.setScale(PLAYER_H / this.player.height);
    } else {
      if (!this.textures.exists('arena_player_capsule')) {
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(0, 0, PLAYER_W, PLAYER_H, PLAYER_W / 2);
        g.lineStyle(3, 0x2b3a67, 1);
        g.strokeRoundedRect(1.5, 1.5, PLAYER_W - 3, PLAYER_H - 3, (PLAYER_W - 3) / 2);
        g.generateTexture('arena_player_capsule', PLAYER_W, PLAYER_H);
        g.destroy();
      }
      this.player = this.add.sprite(START.x, START.y, 'arena_player_capsule');
      this.player.setTint(0x6ad7ff);
    }
    this.player.setOrigin(0.5, 1); // bottom-center
    this.player.setDepth(this.player.y); // Y-sort: pass in front of / behind props later
    this.shadow.setDepth(this.player.y - 1);

    // Camera: smooth follow, zoomed so ~70% of the arena width is on screen,
    // bounded to the image rect so it never pans past the arena.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.setZoom(GAME_WIDTH / (VIEW_FRAC * worldW));
    cam.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);
    cam.setBackgroundColor(0x271d2e); // soft dusk behind the transparent corners

    // Input: WASD (+ arrows as a freebie).
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as ArenaScene['wasd'];

    // ── Action FSM: idle / walk / dash / attack / ultimate ────────────────────
    ensureSlashVfx(this);
    this.fsm = new PlayerFsm(this, this.player, PLAYER_SPEED, {
      onGhost: () => this.spawnGhost(),
      onAttackActive: () => this.spawnSlash(1),
      // Ultimate placeholder until it's spec'd: a 4-way slash burst.
      onUltimate: () => {
        for (const f of ['up', 'right', 'down', 'left'] as Cardinal[]) {
          this.time.delayedCall(90 * ['up', 'right', 'down', 'left'].indexOf(f), () =>
            this.spawnSlash(1.5, f),
          );
        }
      },
    });
    // LMB → attack (interrupts walk; not dash/attack/ultimate).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 0) this.fsm.tryAttack(this.time.now);
    });
    // SPACE or SHIFT → dash in the current move direction (facing if standing).
    const dash = () => this.fsm.tryDash(this.time.now, this.moveInput(true));
    this.input.keyboard!.on('keydown-SPACE', dash);
    this.input.keyboard!.on('keydown-SHIFT', dash);
    // R → ultimate (stub).
    this.input.keyboard!.on('keydown-R', () => this.fsm.tryUltimate(this.time.now));

    // Debug overlay (G): walkable polygon outline + numbered vertices.
    this.hitGfx = this.add.graphics().setDepth(10_000);
    this.debugGfx = this.add.graphics().setDepth(10_000).setVisible(false);
    this.drawDebug();
    this.input.keyboard!.on('keydown-G', () => {
      this.debugOn = !this.debugOn;
      this.debugGfx.setVisible(this.debugOn);
      for (const t of this.debugLabels) t.setVisible(this.debugOn);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.debugLabels = [];
    });
  }

  private drawDebug() {
    const g = this.debugGfx;
    g.clear();
    g.lineStyle(3, 0xff2bd6, 0.9);
    g.strokePoints(this.walkable.points, true);
    g.fillStyle(0xff2bd6, 0.12);
    g.fillPoints(this.walkable.points, true);
    this.walkable.points.forEach((p, i) => {
      g.fillStyle(0x00e5ff, 1);
      g.fillCircle(p.x, p.y, 5);
      const label = this.add
        .text(p.x + 8, p.y - 8, `${i}`, { fontFamily: 'monospace', fontSize: '16px', color: '#00e5ff' })
        .setDepth(10_001)
        .setVisible(false);
      this.debugLabels.push(label);
    });
    // start marker
    g.lineStyle(2, 0xffe08a, 0.9);
    g.strokeCircle(START.x, START.y, 10);
  }

  /** Swap to the facing's art: down/up use their own views; left/right share the
   *  right-facing 'side' view, mirrored via flipX for left. */
  private applyFacing() {
    const set: FacingSet = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    const key = dirTextureKey(KOHAI_BASE, set);
    if (this.player.texture.key !== key) this.player.setTexture(key);
    this.player.setFlipX(this.facing === 'left');
  }

  /** Raw movement vector; `orFacing` substitutes the facing when standing still. */
  private moveInput(orFacing = false): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.wasd.A.isDown || this.cursors.left.isDown) x -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) x += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) y -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) y += 1;
    if (orFacing && x === 0 && y === 0) {
      x = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0;
      y = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0;
    }
    return { x, y };
  }

  private facingVec(f: Cardinal): { x: number; y: number } {
    return { x: f === 'left' ? -1 : f === 'right' ? 1 : 0, y: f === 'up' ? -1 : f === 'down' ? 1 : 0 };
  }

  /** Afterimage ghost: a fading clone of the player's current frame, in place. */
  private spawnGhost() {
    const g = this.add.image(this.player.x, this.player.y, this.player.texture.key);
    g.setOrigin(0.5, 1);
    g.setFlipX(this.player.flipX);
    g.setScale(this.player.scaleX, this.player.scaleY);
    g.setAlpha(0.4);
    g.setDepth(this.player.y - 2); // behind the player, above the shadow's slot
    this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }

  /** Slash arc in the signature color, in front of the (or a given) facing. */
  private spawnSlash(scale = 1, facing?: Cardinal) {
    const f = facing ?? this.facing;
    const d = this.facingVec(f);
    const cy = this.player.y - PLAYER_H * 0.45; // arc rides at torso height
    playSlash(this, {
      x: this.player.x + d.x * HIT_REACH,
      y: cy + d.y * HIT_REACH * 0.8,
      facing: f,
      tint: signatureTint(ARENA_CHAR_ID),
      scale,
      depth: this.player.y + 1,
    });
  }

  /** Keep the attack rect glued in front of the facing (frames 2–3 only). */
  private updateHitbox() {
    const d = this.facingVec(this.facing);
    const cx = this.player.x + d.x * HIT_REACH;
    const cy = this.player.y - PLAYER_H * 0.45 + d.y * HIT_REACH * 0.8;
    const horiz = this.facing === 'left' || this.facing === 'right';
    this.attackHitbox.setSize(horiz ? HIT_W : HIT_H + 16, horiz ? HIT_H : HIT_W - 16);
    this.attackHitbox.centerX = cx;
    this.attackHitbox.centerY = cy;
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;
    const input = this.moveInput();
    const { vx, vy } = this.fsm.update(time, input);

    if (vx !== 0 || vy !== 0) {
      const nx = this.player.x + vx * dt;
      const ny = this.player.y + vy * dt;
      // Clamp the FEET point to the walkable polygon; per-axis fallback gives
      // wall-sliding instead of a dead stop on diagonals (dashes slide too).
      if (Phaser.Geom.Polygon.Contains(this.walkable, nx, ny)) {
        this.player.setPosition(nx, ny);
      } else if (Phaser.Geom.Polygon.Contains(this.walkable, nx, this.player.y)) {
        this.player.setX(nx);
      } else if (Phaser.Geom.Polygon.Contains(this.walkable, this.player.x, ny)) {
        this.player.setY(ny);
      }
      this.player.setDepth(this.player.y);
      // Facing follows movement only while walking — attack/dash keep their aim.
      if (this.hasKohai && this.fsm.state === 'walk') {
        this.facing = vectorToCardinal(input.x, input.y, this.facing);
        this.applyFacing();
      }
    }

    if (this.fsm.hitboxActive) this.updateHitbox();
    // hitbox outline rides the G debug overlay
    this.hitGfx.clear();
    if (this.debugOn && this.fsm.hitboxActive) {
      this.hitGfx.lineStyle(2, 0xffe08a, 0.95);
      this.hitGfx.strokeRectShape(this.attackHitbox);
    }

    this.shadow.setPosition(this.player.x, this.player.y);
    this.shadow.setDepth(this.player.y - 1);
  }
}
