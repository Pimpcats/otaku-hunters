import Phaser from 'phaser';
import { COLORS, TEX } from '../constants';
import { getStage, type ResolvedStage } from '../data/stages';
import { getCharacter, type CharacterDef } from '../data/characters';
import type { Word } from '../data/types';
import {
  PLAYER_BASE,
  enemyStatsAt,
  xpForLevel,
  wordTokenXp,
  WORD_XP,
  BOSS,
  BOSS_TIME,
  type Grade,
} from '../data/balance';
import { InputController } from '../systems/input';
import { WeaponManager } from '../systems/weapons';
import { Spawner } from '../systems/spawner';
import { Hud } from '../ui/hud';
import { ARCHETYPES, type EnemyData } from '../entities/enemies/archetypes';
import { PlayerLoadout } from '../systems/loadout';
import { speakJa } from '../audio/tts';
import { beginRun } from '../systems/srs';
import { applyFacing, dirTextureKey, vectorToCardinal, type Cardinal } from '../systems/facing';
import { configurePlayerSprite } from '../ui/playerSheet';
import { readingOf } from '../systems/romaji';

const WORLD = 4000;
const WORD_DROP_CHANCE = 0.18;
const HP_BAR_W = 46;

type Sprite = Phaser.Physics.Arcade.Sprite;

export interface LevelUpResult {
  grade: Grade;
  heal: number;
  sid?: string; // the sentence that was served (for variety tracking)
  answerParticle?: string; // particle drills only (for skew tracking)
}

export class RunScene extends Phaser.Scene {
  private stage!: ResolvedStage;
  private character!: CharacterDef;
  private loadout!: PlayerLoadout;
  private player!: Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private wordTokens!: Phaser.Physics.Arcade.Group;
  private weapon!: WeaponManager;
  private spawner!: Spawner;
  private controls!: InputController;
  private hud!: Hud;
  private hpBarBack!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;

  private dir = new Phaser.Math.Vector2();
  private facing: Cardinal = 'down';

  private level = 1;
  private xp = 0;
  private xpToNext = xpForLevel(1);
  private hp = PLAYER_BASE.maxHp;
  private maxHp = PLAYER_BASE.maxHp;
  private elapsed = 0;
  private lastHit = 0;
  private leveling = false;
  private dead = false;
  private won = false;
  private bossSpawned = false;
  private boss: Sprite | null = null;
  private revivesUsed = 0; // Extra Life passives consumed this run

  private collectedWords = new Map<string, Word>();
  private collectedSet = new Set<string>();
  private recentSids: string[] = []; // last few puzzle sentences, for variety
  private recentParticles: string[] = []; // last few answer particles, for skew

  constructor() {
    super('Run');
  }

  init() {
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.hp = PLAYER_BASE.maxHp;
    this.maxHp = PLAYER_BASE.maxHp;
    this.elapsed = 0;
    this.lastHit = 0;
    this.leveling = false;
    this.dead = false;
    this.won = false;
    this.bossSpawned = false;
    this.boss = null;
    this.revivesUsed = 0;
    this.collectedWords = new Map();
    this.collectedSet = new Set();
    this.recentSids = [];
    this.recentParticles = [];
    this.facing = 'down';
  }

  create(data: { stageId?: string; characterId?: string }) {
    this.stage = getStage(data.stageId ?? 'arcade');
    this.character = getCharacter(data.characterId);
    this.loadout = new PlayerLoadout(this.character);
    // Base HP/move-speed come from the chosen character.
    this.maxHp = this.loadout.stats().maxHp;
    this.hp = this.maxHp;
    beginRun();

    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.cameras.main.setBounds(0, 0, WORLD, WORLD);
    this.drawBackground();

    this.player = this.physics.add.sprite(WORLD / 2, WORLD / 2, dirTextureKey(this.character.texture, 'down'));
    configurePlayerSprite(this, this.player, this.character.id);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(50);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.enemies = this.physics.add.group();
    this.gems = this.physics.add.group();
    this.wordTokens = this.physics.add.group();

    this.weapon = new WeaponManager(this, this.loadout);
    this.spawner = new Spawner((key, x, y) => this.spawnEnemy(key, x, y));
    this.controls = new InputController(this);
    this.hud = new Hud(this);

    this.physics.add.overlap(this.weapon.bullets, this.enemies, this.onBulletHit, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.gems, this.onCollectGem, undefined, this);
    this.physics.add.overlap(this.player, this.wordTokens, this.onCollectWord, undefined, this);

    // Floating HP bar above the player (world-space).
    this.hpBarBack = this.add.rectangle(0, 0, HP_BAR_W, 6, COLORS.hpBack).setOrigin(0, 0.5).setDepth(60);
    this.hpBarFill = this.add.rectangle(0, 0, HP_BAR_W, 6, COLORS.hp).setOrigin(0, 0.5).setDepth(61);

    // Pause on ESC or Space.
    this.input.keyboard?.on('keydown-ESC', this.openPause, this);
    this.input.keyboard?.on('keydown-SPACE', this.openPause, this);
  }

  private openPause() {
    if (this.dead || this.won || this.leveling) return;
    this.scene.launch('Pause');
    this.scene.pause();
  }

  private updateHpBar() {
    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    const x = this.player.x - HP_BAR_W / 2;
    const y = this.player.y - 24;
    this.hpBarBack.setPosition(x, y);
    this.hpBarFill.setPosition(x, y);
    this.hpBarFill.width = HP_BAR_W * ratio;
    const col = ratio > 0.5 ? 0x7cff9e : ratio > 0.25 ? 0xffd166 : 0xff5a5a;
    this.hpBarFill.setFillStyle(col);
  }

  private drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, WORLD, WORLD);
    g.lineStyle(1, COLORS.bgAlt, 1);
    for (let x = 0; x <= WORLD; x += 64) g.lineBetween(x, 0, x, WORLD);
    for (let y = 0; y <= WORLD; y += 64) g.lineBetween(0, y, WORLD, y);
    g.setDepth(-10);
  }

  // ── spawning ───────────────────────────────────────────────────────────
  private spawnEnemy(key: string, x: number, y: number) {
    const arc = ARCHETYPES[key];
    if (!arc) return;
    const st = enemyStatsAt(key, this.elapsed);
    // Cursed Manga (curse): tougher, faster enemies that also pay out more XP.
    const curse = this.loadout.stats().curse;
    const e = this.enemies.get(x, y, dirTextureKey(arc.texture, 'down')) as Sprite | null;
    if (!e) return;
    e.enableBody(true, x, y, true, true);
    e.setCircle(9, 0, 0);
    e.setScale(1);
    e.setFlipX(false);
    e.setDepth(40);
    e.clearTint();
    e.setData('speed', Math.round(st.speed * curse));
    e.setData('tint', undefined);
    e.setData('face', 'down');
    e.setData('faceSet', ''); // force applyFacing to refresh this recycled sprite
    e.setData('faceState', '');
    const edata: EnemyData = {
      archetype: arc,
      hp: Math.round(st.hp * curse),
      contact: Math.round(st.contact * curse),
      xp: Math.max(1, Math.round(st.xp * curse)),
      wanderAngle: Phaser.Math.FloatBetween(0, Math.PI * 2),
      flipTimer: 0,
    };
    e.setData('edata', edata);
  }

  private spawnBoss() {
    this.bossSpawned = true;
    const arc = ARCHETYPES.UltimateCollector;
    const e = this.enemies.get(this.player.x, this.player.y - 360, dirTextureKey(arc.texture, 'down')) as Sprite | null;
    if (!e) return;
    e.enableBody(true, this.player.x, this.player.y - 360, true, true);
    e.setScale(5);
    e.setCircle(9, 0, 0);
    e.setFlipX(false);
    e.setDepth(48);
    e.clearTint(); // its texture is already the purple Ultimate Collector
    e.setData('speed', BOSS.speed);
    e.setData('tint', undefined);
    e.setData('face', 'down');
    e.setData('faceSet', '');
    e.setData('faceState', '');
    const edata: EnemyData = {
      archetype: arc,
      hp: BOSS.hp,
      contact: BOSS.contact,
      xp: BOSS.xp,
      isBoss: true,
      wanderAngle: 0,
      flipTimer: 0,
    };
    e.setData('edata', edata);
    e.setData('maxHp', BOSS.hp);
    this.boss = e;
    this.cameras.main.shake(400, 0.012);
    this.banner(`⚠  ${BOSS.name}  ⚠`, COLORS.word);
  }

  // ── damage & collisions ──────────────────────────────────────────────────
  private dealDamage = (e: Sprite, amount: number) => {
    const ed = e.getData('edata') as EnemyData | undefined;
    if (!ed || !e.active) return;
    ed.hp -= amount;
    e.setTintFill(0xffffff);
    this.time.delayedCall(40, () => {
      if (!e.active) return;
      const tc = e.getData('tint') as number | undefined;
      if (tc !== undefined) e.setTint(tc);
      else e.clearTint();
    });
    if (ed.hp <= 0) this.killEnemy(e, ed);
  };

  private onBulletHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bObj, eObj) => {
    this.weapon.onBulletOverlap(bObj as Sprite, eObj as Sprite, this.dealDamage);
  };

  private killEnemy(e: Sprite, ed: EnemyData) {
    const { x, y } = e;
    if (ed.isBoss) {
      this.burst(x, y, COLORS.word);
      e.disableBody(true, true);
      this.enemies.killAndHide(e);
      this.boss = null;
      this.runClear();
      return;
    }
    this.burst(x, y, ed.archetype.color);
    this.dropGem(x, y, ed.xp);
    // Maneki-neko (luck): better odds a kill coughs up a word token.
    const dropChance = WORD_DROP_CHANCE * this.loadout.stats().luck;
    if (ed.archetype.dropsWord || Math.random() < dropChance) this.dropWord(x, y);
    e.disableBody(true, true);
    this.enemies.killAndHide(e);
  }

  private onPlayerHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_p, eObj) => {
    if (this.dead || this.leveling || this.won) return;
    if (this.time.now - this.lastHit < 600) return;
    const ed = (eObj as Sprite).getData('edata') as EnemyData | undefined;
    if (!ed) return;
    this.lastHit = this.time.now;
    // Kotatsu Blanket (armor): flat damage reduction, but a hit always stings ≥1.
    const dmg = Math.max(1, ed.contact - this.loadout.stats().armor);
    this.hp -= dmg;
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
    this.xp += value * this.loadout.stats().growth; // Study Streak (growth): +XP
    this.checkLevelUp();
  };

  private onCollectWord: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_p, wObj) => {
    const w = wObj as Sprite;
    if (!w.active) return;
    const word = w.getData('word') as Word;
    // XP boost: scales with level, decays the longer it sat on the ground.
    const age = (this.time.now - ((w.getData('dropTime') as number) ?? this.time.now)) / 1000;
    const gain = Math.round(wordTokenXp(this.level, age) * this.loadout.stats().growth);
    (w.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
    w.setData('label', undefined);
    w.disableBody(true, true);
    this.wordTokens.killAndHide(w);
    this.xp += gain;
    if (word && !this.collectedSet.has(word.jp)) {
      this.collectedSet.add(word.jp);
      this.collectedWords.set(word.jp, word);
    }
    if (word) {
      speakJa(word.jp);
      // jp + romaji + english + the XP gained, held a few seconds then slow-fade
      const romaji = `  (${readingOf(word.jp, word.pos, word.romaji)})`;
      this.floatLabel(
        this.player.x,
        this.player.y - 28,
        `${word.jp}${romaji}\n${word.en}   +${gain} XP`,
        COLORS.word,
        { hold: 2400, fade: 1400, size: 20, rise: 26 },
      );
    }
    this.checkLevelUp();
  };

  // ── drops & juice ─────────────────────────────────────────────────────────
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
    const word = this.pickSpawnWord(pool);
    const w = this.wordTokens.get(x, y, TEX.word) as Sprite | null;
    if (!w) return;
    w.enableBody(true, x, y, true, true);
    w.setDepth(31);
    w.setAlpha(1);
    w.setData('word', word);
    w.setData('dropTime', this.time.now);
    w.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: w, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
    // Floating reading (kana + romaji) so beginners can read it on the ground.
    const label = this.add
      .text(x, y - 14, `${word.jp}\n${readingOf(word.jp, word.pos, word.romaji)}`, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        lineSpacing: 1,
        stroke: '#0b0d1a',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(32);
    w.setData('label', label);
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

  private floatLabel(
    x: number,
    y: number,
    text: string,
    color: number,
    opts: { hold?: number; fade?: number; size?: number; rise?: number } = {},
  ) {
    const { hold = 0, fade = 900, size = 16, rise = 36 } = opts;
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui',
        fontSize: `${size}px`,
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
        align: 'center',
        stroke: '#0b0d1a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(200);
    // Drift up slowly over the whole life; stay solid for `hold`, then fade.
    this.tweens.add({ targets: t, y: y - rise, duration: hold + fade, ease: 'Sine.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: hold, duration: fade, onComplete: () => t.destroy() });
  }

  private banner(text: string, color: number) {
    const cam = this.cameras.main;
    const t = this.add
      .text(cam.midPoint.x, cam.midPoint.y - 120, text, {
        fontFamily: 'system-ui',
        fontSize: '34px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(400);
    this.tweens.add({ targets: t, alpha: 0, scale: 1.3, duration: 1400, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  // ── level up ───────────────────────────────────────────────────────────────
  private checkLevelUp() {
    if (this.leveling || this.dead || this.won) return;
    if (this.xp >= this.xpToNext) this.doLevelUp();
  }

  private doLevelUp() {
    this.leveling = true;
    this.xp -= this.xpToNext;
    this.level += 1;
    this.xpToNext = xpForLevel(this.level);

    this.cameras.main.flash(120, 120, 215, 255);
    this.input.enabled = false;
    this.scene.launch('LevelUp', {
      stage: this.stage,
      collectedWords: this.collectedWords,
      collectedSet: this.collectedSet,
      level: this.level,
      loadout: this.loadout,
      recent: new Set(this.recentSids),
      recentParticles: [...this.recentParticles],
      onComplete: (result: LevelUpResult) => this.onLevelUpDone(result),
    });
    this.scene.pause();
  }

  private onLevelUpDone(result: LevelUpResult) {
    this.maxHp = this.loadout.stats().maxHp;
    if (result.heal > 0) this.hp = Math.min(this.maxHp, this.hp + result.heal);
    if (result.sid) {
      this.recentSids.push(result.sid);
      if (this.recentSids.length > 10) this.recentSids.shift(); // remember the last 10
    }
    if (result.answerParticle) {
      this.recentParticles.push(result.answerParticle);
      if (this.recentParticles.length > 5) this.recentParticles.shift();
    }
    this.input.enabled = true;
    this.leveling = false;
    this.checkLevelUp();
  }

  // ── end states ──────────────────────────────────────────────────────────────
  private gameOver() {
    if (this.dead || this.won) return;
    // Extra Life (revival): spend a charge to spring back at full HP with a
    // brief window of invulnerability instead of dying.
    if (this.revivesUsed < this.loadout.stats().revival) {
      this.revivesUsed += 1;
      this.hp = this.maxHp;
      this.lastHit = this.time.now + 1200; // ~1.8s of i-frames to get clear
      this.cameras.main.flash(220, 180, 255, 200);
      this.banner('REVIVED!', COLORS.xpBar);
      this.player.clearTint();
      return;
    }
    this.dead = true;
    this.endScreen('YOU DIED', COLORS.hp);
  }

  private runClear() {
    if (this.won || this.dead) return;
    this.won = true;
    this.endScreen('STAGE CLEAR!', COLORS.xpBar);
  }

  private endScreen(title: string, color: number) {
    this.physics.pause();
    this.cameras.main.shake(260, 0.01);
    const cx = this.cameras.main.midPoint.x;
    const cy = this.cameras.main.midPoint.y;
    this.add
      .text(cx, cy - 20, title, { fontFamily: 'system-ui', fontSize: '48px', color: '#' + color.toString(16).padStart(6, '0'), fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(500);
    this.add
      .text(cx, cy + 34, `LV ${this.level} · 語 ${this.collectedWords.size} · tap to continue`, { fontFamily: 'system-ui', fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(500);
    this.controls.destroy();
    this.time.delayedCall(700, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start('Meta'));
    });
  }

  // ── main loop ────────────────────────────────────────────────────────────────
  update(time: number, delta: number) {
    if (this.dead || this.won) return;
    const dt = delta / 1000;
    this.elapsed += dt;
    const stats = this.loadout.stats();

    // movement + 4-direction facing
    this.controls.getDirection(this.dir);
    const speed = this.character.baseMoveSpeed * stats.moveSpeed;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(this.dir.x * speed, this.dir.y * speed);
    const moving = this.dir.x !== 0 || this.dir.y !== 0;
    this.facing = vectorToCardinal(this.dir.x, this.dir.y, this.facing);
    applyFacing(this.player, this.character.texture, this.facing, moving ? 'walk' : 'idle');

    // enemy AI + facing (from their resulting velocity)
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Sprite;
      if (!e.active) continue;
      const arc = (e.getData('edata') as EnemyData).archetype;
      arc.ai(e, this.player, delta);
      const body = e.body as Phaser.Physics.Arcade.Body;
      const face = vectorToCardinal(body.velocity.x, body.velocity.y, (e.getData('face') as Cardinal) ?? 'down');
      e.setData('face', face);
      applyFacing(e, arc.texture, face, 'walk');
    }

    // weapons
    this.weapon.update(time, this.player.x, this.player.y, this.enemies, this.dealDamage);

    // XP magnet (scaled by Collector's Magnet)
    this.magnetize(this.gems, PLAYER_BASE.pickupRadius * stats.magnet, 280);

    // Word tokens fade as they decay (grab them fast for full XP).
    for (const obj of this.wordTokens.getChildren()) {
      const w = obj as Sprite;
      if (!w.active) continue;
      const age = (this.time.now - ((w.getData('dropTime') as number) ?? this.time.now)) / 1000;
      const f = Phaser.Math.Clamp(age / WORD_XP.decaySeconds, 0, 1);
      w.setAlpha(1 - 0.5 * f);
      const label = w.getData('label') as Phaser.GameObjects.Text | undefined;
      if (label) label.setPosition(w.x, w.y - 14).setAlpha(1 - 0.5 * f);
    }

    // regen + maxHp upkeep
    this.maxHp = stats.maxHp;
    if (stats.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + stats.regen * dt);
    this.updateHpBar();

    // spawning + boss
    if (!this.bossSpawned && this.elapsed >= BOSS_TIME) this.spawnBoss();
    this.spawner.update(delta, this.elapsed, this.player.x, this.player.y, this.countActive(this.enemies));

    this.hud.update({
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hp: this.hp,
      maxHp: this.maxHp,
      elapsed: this.elapsed,
      words: this.collectedWords.size,
      boss: this.boss && this.boss.active
        ? { hp: (this.boss.getData('edata') as EnemyData).hp, maxHp: this.boss.getData('maxHp') as number, name: BOSS.name }
        : null,
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
