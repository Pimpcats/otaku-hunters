import Phaser from 'phaser';
import { COLORS, PLAYER, RUN, TEX } from '../constants';
import { getStage, type ResolvedStage } from '../data/stages';
import type { Word } from '../data/types';
import { InputController } from '../systems/input';
import { Weapon } from '../systems/weapons';
import { Spawner } from '../systems/spawner';
import { Hud } from '../ui/hud';
import { ARCHETYPES, type EnemyData } from '../entities/enemies/archetypes';
import { speakJa } from '../audio/tts';
import { beginRun } from '../systems/srs';
import type { Grade } from '../systems/puzzle';

const WORLD = 4000;

type Sprite = Phaser.Physics.Arcade.Sprite;

export interface LevelUpResult {
  grade: Grade;
}

export class RunScene extends Phaser.Scene {
  private stage!: ResolvedStage;
  private player!: Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private wordTokens!: Phaser.Physics.Arcade.Group;
  private weapon!: Weapon;
  private spawner!: Spawner;
  private controls!: InputController;
  private hud!: Hud;

  private dir = new Phaser.Math.Vector2();

  // run state
  private level = 1;
  private xp = 0;
  private xpToNext = RUN.xpForLevel(1);
  private hp = PLAYER.maxHp;
  private maxHp = PLAYER.maxHp;
  private elapsed = 0;
  private lastHit = 0;
  private leveling = false;
  private dead = false;

  // run-only collected pool (brief §3)
  private collectedWords = new Map<string, Word>();
  private collectedSet = new Set<string>();

  constructor() {
    super('Run');
  }

  init() {
    // reset state on (re)start
    this.level = 1;
    this.xp = 0;
    this.xpToNext = RUN.xpForLevel(1);
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.elapsed = 0;
    this.lastHit = 0;
    this.leveling = false;
    this.dead = false;
    this.collectedWords = new Map();
    this.collectedSet = new Set();
  }

  create(data: { stageId?: string }) {
    this.stage = getStage(data.stageId ?? 'arcade');
    beginRun();

    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.cameras.main.setBounds(0, 0, WORLD, WORLD);
    this.drawBackground();

    this.player = this.physics.add.sprite(WORLD / 2, WORLD / 2, TEX.player);
    this.player.setCircle(PLAYER.radius, 0, 0);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(50);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.enemies = this.physics.add.group();
    this.gems = this.physics.add.group();
    this.wordTokens = this.physics.add.group();

    this.weapon = new Weapon(this);
    this.spawner = new Spawner(this.stage.config.enemyTable, (key, x, y) =>
      this.spawnEnemy(key, x, y),
    );
    this.controls = new InputController(this);
    this.hud = new Hud(this);

    this.physics.add.overlap(this.weapon.bullets, this.enemies, this.onBulletHit, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.gems, this.onCollectGem, undefined, this);
    this.physics.add.overlap(this.player, this.wordTokens, this.onCollectWord, undefined, this);
  }

  private drawBackground() {
    // Subtle grid so motion reads. One static graphics over the whole world.
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, WORLD, WORLD);
    g.lineStyle(1, COLORS.bgAlt, 1);
    for (let x = 0; x <= WORLD; x += 64) g.lineBetween(x, 0, x, WORLD);
    for (let y = 0; y <= WORLD; y += 64) g.lineBetween(0, y, WORLD, y);
    g.setDepth(-10);
  }

  // ---- spawning -----------------------------------------------------------

  private spawnEnemy(key: string, x: number, y: number) {
    const arc = ARCHETYPES[key];
    if (!arc) return;
    const e = this.enemies.get(x, y, arc.texture) as Sprite | null;
    if (!e) return;
    e.setTexture(arc.texture);
    e.enableBody(true, x, y, true, true); // re-enables recycled bodies
    e.setCircle(9, 0, 0);
    e.setDepth(40);
    e.clearTint();
    e.setData('speed', arc.speed);
    e.setData('arc', arc);
    const edata: EnemyData = {
      archetype: arc,
      hp: arc.hp,
      wanderAngle: Phaser.Math.FloatBetween(0, Math.PI * 2),
      flipTimer: 0,
    };
    e.setData('edata', edata);
  }

  // ---- collisions ---------------------------------------------------------

  private onBulletHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bObj, eObj) => {
    const b = bObj as Sprite;
    const e = eObj as Sprite;
    if (!b.active || !e.active) return;
    const dmg = (b.getData('damage') as number) ?? 1;
    this.weapon.killBullet(b);

    const edata = e.getData('edata') as EnemyData;
    edata.hp -= dmg;
    // hit flash
    e.setTintFill(0xffffff);
    this.time.delayedCall(40, () => e.active && e.clearTint());

    if (edata.hp <= 0) this.killEnemy(e, edata);
  };

  private killEnemy(e: Sprite, edata: EnemyData) {
    const { x, y } = e;
    const arc = edata.archetype;
    this.burst(x, y, arc.texture === TEX.merchMule ? COLORS.merchMule : COLORS.rushFan);
    this.dropGem(x, y, arc.xp);
    if (arc.dropsWord || Math.random() < RUN.wordDropChance) this.dropWord(x, y);
    e.disableBody(true, true);
    this.enemies.killAndHide(e);
  }

  private onPlayerHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_p, eObj) => {
    if (this.dead || this.leveling) return;
    if (this.time.now - this.lastHit < 600) return;
    const e = eObj as Sprite;
    const edata = e.getData('edata') as EnemyData | undefined;
    if (!edata) return;
    this.lastHit = this.time.now;
    this.hp -= edata.archetype.contactDamage;
    this.cameras.main.shake(120, 0.006);
    this.player.setTintFill(0xff5a5a);
    this.time.delayedCall(90, () => this.player.clearTint());
    if (this.hp <= 0) this.gameOver();
  };

  private onCollectGem: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_p, gObj) => {
    const g = gObj as Sprite;
    if (!g.active) return;
    const value = (g.getData('xp') as number) ?? 1;
    g.disableBody(true, true);
    this.gems.killAndHide(g);
    this.xp += value;
    this.checkLevelUp();
  };

  private onCollectWord: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_p, wObj) => {
    const w = wObj as Sprite;
    if (!w.active) return;
    const word = w.getData('word') as Word;
    w.disableBody(true, true);
    this.wordTokens.killAndHide(w);
    if (word && !this.collectedSet.has(word.jp)) {
      this.collectedSet.add(word.jp);
      this.collectedWords.set(word.jp, word);
    }
    if (word) {
      speakJa(word.jp);
      this.floatLabel(this.player.x, this.player.y - 24, `${word.jp}  ${word.en}`, COLORS.word);
    }
  };

  // ---- drops & juice ------------------------------------------------------

  private dropGem(x: number, y: number, xp: number) {
    const g = this.gems.get(x, y, TEX.xp) as Sprite | null;
    if (!g) return;
    g.enableBody(true, x, y, true, true);
    g.setDepth(30);
    g.setData('xp', xp);
  }

  private dropWord(x: number, y: number) {
    const pool = this.stage.wordPool;
    if (pool.length === 0) return;
    // Bias toward role-relevant words (nouns/verbs/adj) so puzzles can form.
    const word = this.pickSpawnWord(pool);
    const w = this.wordTokens.get(x, y, TEX.word) as Sprite | null;
    if (!w) return;
    w.enableBody(true, x, y, true, true);
    w.setDepth(31);
    w.setData('word', word);
    w.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: w, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
  }

  private pickSpawnWord(pool: Word[]): Word {
    const useful = pool.filter((w) => ['n', 'v', 'adj', 'adv'].includes(w.pos));
    const src = useful.length > 0 && Math.random() < 0.8 ? useful : pool;
    return src[Phaser.Math.Between(0, src.length - 1)];
  }

  private burst(x: number, y: number, color: number) {
    const e = this.add.particles(x, y, TEX.bullet, {
      lifespan: 280,
      speed: { min: 40, max: 140 },
      scale: { start: 1, end: 0 },
      quantity: 8,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });
    e.explode(8);
    this.time.delayedCall(320, () => e.destroy());
  }

  private floatLabel(x: number, y: number, text: string, color: number) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui',
        fontSize: '16px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.out',
      onComplete: () => t.destroy(),
    });
  }

  // ---- level up -----------------------------------------------------------

  private checkLevelUp() {
    if (this.leveling || this.dead) return;
    if (this.xp >= this.xpToNext) this.doLevelUp();
  }

  private doLevelUp() {
    this.leveling = true;
    this.xp -= this.xpToNext;
    this.level += 1;
    this.xpToNext = RUN.xpForLevel(this.level);

    // freeze-frame juice, then open the minigame overlay (brief §4.1).
    this.cameras.main.flash(120, 120, 215, 255);
    this.input.enabled = false; // overlay owns input while paused
    this.scene.launch('LevelUp', {
      stage: this.stage,
      collectedWords: this.collectedWords,
      collectedSet: this.collectedSet,
      level: this.level,
      onComplete: (result: LevelUpResult) => this.onLevelUpDone(result),
    });
    this.scene.pause();
  }

  private onLevelUpDone(result: LevelUpResult) {
    // Reward scaling — baseline is decent; correctness is a BONUS (guardrail §8.2).
    let banner = '';
    switch (result.grade) {
      case 'got_it':
        this.weapon.applyLevels(3);
        banner = 'PERFECT!  +FULL POWER';
        break;
      case 'kinda':
        this.weapon.applyLevels(1);
        banner = 'NICE!  +POWER';
        break;
      case 'nope':
        this.weapon.applyLevels(0);
        this.hp = Math.min(this.maxHp, this.hp + 15);
        banner = '+HEAL';
        break;
    }
    this.floatLabel(this.player.x, this.player.y - 40, banner, COLORS.xpBar);
    this.input.enabled = true;
    this.leveling = false;
    // handle XP overflow into another level
    this.checkLevelUp();
  }

  // ---- game over ----------------------------------------------------------

  private gameOver() {
    if (this.dead) return;
    this.dead = true;
    this.physics.pause();
    this.cameras.main.shake(260, 0.01);
    const cx = this.cameras.main.midPoint.x;
    const cy = this.cameras.main.midPoint.y;
    this.add
      .text(cx, cy - 20, 'YOU DIED', {
        fontFamily: 'system-ui',
        fontSize: '48px',
        color: '#ff5a5a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(500)
      .setScrollFactor(1);
    const sub = this.add
      .text(cx, cy + 34, `LV ${this.level} · 語 ${this.collectedWords.size} · tap to continue`, {
        fontFamily: 'system-ui',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(500)
      .setScrollFactor(1);
    void sub;
    this.controls.destroy();
    this.time.delayedCall(700, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start('Meta'));
    });
  }

  // ---- main loop ----------------------------------------------------------

  update(time: number, delta: number) {
    if (this.dead) return;
    const dt = delta / 1000;
    this.elapsed += dt;

    // movement
    this.controls.getDirection(this.dir);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(
      this.dir.x * PLAYER.speed,
      this.dir.y * PLAYER.speed,
    );

    // enemy AI
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Sprite;
      if (!e.active) continue;
      const edata = e.getData('edata') as EnemyData;
      edata.archetype.ai(e as never, this.player, delta);
    }

    // weapon auto-fire
    this.weapon.update(time, this.player.x, this.player.y, this.enemies);

    // XP magnet
    this.magnetize(this.gems, PLAYER.pickupRange, 260);

    // spawning
    this.spawner.update(
      delta,
      this.elapsed,
      this.player.x,
      this.player.y,
      this.countActive(this.enemies),
    );

    this.hud.update({
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hp: this.hp,
      maxHp: this.maxHp,
      elapsed: this.elapsed,
      words: this.collectedWords.size,
    });
  }

  private magnetize(group: Phaser.Physics.Arcade.Group, range: number, speed: number) {
    const px = this.player.x;
    const py = this.player.y;
    const r2 = range * range;
    for (const obj of group.getChildren()) {
      const s = obj as Sprite;
      if (!s.active) continue;
      const dx = px - s.x;
      const dy = py - s.y;
      if (dx * dx + dy * dy < r2) {
        const len = Math.hypot(dx, dy) || 1;
        (s.body as Phaser.Physics.Arcade.Body).setVelocity((dx / len) * speed, (dy / len) * speed);
      }
    }
  }

  private countActive(group: Phaser.Physics.Arcade.Group): number {
    let n = 0;
    for (const obj of group.getChildren()) if ((obj as Sprite).active) n++;
    return n;
  }
}
