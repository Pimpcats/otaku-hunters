import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';
import type { ResolvedStage } from '../data/stages';
import type { Word } from '../data/types';
import {
  selectSentence,
  buildTierA,
  gradeFromAttempts,
  type Puzzle,
} from '../systems/puzzle';
import { GRADE_STACKS, NOPE_HEAL, type Grade } from '../data/balance';
import { PlayerLoadout, type UpgradeDef } from '../systems/loadout';
import { recordGrade } from '../systems/srs';
import { speakJa } from '../audio/tts';
import type { LevelUpResult } from './RunScene';

interface LevelUpData {
  stage: ResolvedStage;
  collectedWords: Map<string, Word>;
  collectedSet: Set<string>;
  level: number;
  loadout: PlayerLoadout;
  onComplete: (result: LevelUpResult) => void;
}

const SOLVE_TIME = 15000; // ms; no answer → "nope" (still rewards)
const HEAL_CARD_AMOUNT = 40;

// The level-up flow (brief §4 + §2 upgrades):
//   1. Particle-socket puzzle (Tier-A). Grade = got_it / kinda / nope.
//   2. Pick 1 of 3 upgrades; the grade scales how many stacks it applies.
// Correctness is always a BONUS — even a wrong answer still lets you pick an
// upgrade (×1) and heals (guardrail §8.2: never a penalty).
export class LevelUpScene extends Phaser.Scene {
  private payload!: LevelUpData;
  private puzzle: Puzzle | null = null;

  private firstTry = true;
  private solved = false;
  private phase: 'puzzle' | 'upgrade' | 'done' = 'puzzle';

  private socketBox!: Phaser.GameObjects.Rectangle;
  private socketText!: Phaser.GameObjects.Text;
  private timerEvent?: Phaser.Tweens.Tween;

  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData) {
    this.payload = data;
    this.firstTry = true;
    this.solved = false;
    this.phase = 'puzzle';

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62).setOrigin(0, 0).setInteractive();
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 36, 'LEVEL UP!', { fontFamily: 'system-ui', fontSize: '30px', color: '#7CFF9E', fontStyle: 'bold' }).setOrigin(0.5);

    const maxDifficulty = 4 + this.payload.level;
    const sentence = selectSentence(this.payload.stage, this.payload.collectedSet, { maxDifficulty, distractors: 2 });
    this.puzzle = sentence ? buildTierA(sentence, 2) : null;

    if (!this.puzzle) {
      // No eligible content yet — skip straight to the upgrade pick (§8.7).
      this.add.text(cx, 150, 'Collect words to unlock puzzles!', { fontFamily: 'system-ui', fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
      this.time.delayedCall(700, () => this.toUpgrades('kinda'));
      return;
    }

    this.renderPrompt(cx);
    this.renderSentence(cx);
    this.renderOptions(cx);
    this.renderTimer();
  }

  // ── puzzle phase ─────────────────────────────────────────────────────────
  private renderPrompt(cx: number) {
    this.add.text(cx, 84, 'Build it in Japanese — pick the missing particle', { fontFamily: 'system-ui', fontSize: '15px', color: '#8890b5' }).setOrigin(0.5);
    this.add.text(cx, 124, `“${this.puzzle!.promptEn}”`, { fontFamily: 'system-ui', fontSize: '24px', color: '#ffffff', fontStyle: 'italic', wordWrap: { width: GAME_WIDTH - 120 }, align: 'center' }).setOrigin(0.5);
  }

  private renderSentence(cx: number) {
    const p = this.puzzle!;
    const y = 210;
    const gap = 10;
    const padX = 14;
    const chipH = 52;
    const chips: { width: number; build: (x: number) => void }[] = [];

    for (let i = 0; i < p.tokens.length; i++) {
      const tok = p.tokens[i];
      if (tok.kind === 'socket') {
        const width = 64;
        chips.push({
          width,
          build: (x) => {
            this.socketBox = this.add.rectangle(x + width / 2, y, width, chipH, COLORS.socket).setStrokeStyle(3, COLORS.particleChip);
            this.socketText = this.add.text(x + width / 2, y, '？', { fontFamily: 'system-ui', fontSize: '26px', color: '#8a5cff', fontStyle: 'bold' }).setOrigin(0.5);
            this.tweens.add({ targets: this.socketBox, scaleX: 1.08, scaleY: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          },
        });
      } else {
        const isVerb = tok.word === p.sentence.verb;
        const isTail = tok.kind === 'tail';
        const label = this.add.text(0, -999, tok.jp, { fontFamily: 'system-ui', fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
        const width = label.width + padX * 2;
        const fill = isVerb ? COLORS.verb : isTail ? COLORS.bgAlt : COLORS.chip;
        chips.push({
          width,
          build: (x) => {
            this.add.rectangle(x + width / 2, y, width, chipH, fill).setStrokeStyle(2, isVerb ? 0x9affc0 : 0x5560a0);
            label.setPosition(x + width / 2, y);
          },
        });
      }
    }

    const total = chips.reduce((s, c) => s + c.width, 0) + gap * (chips.length - 1);
    let x = cx - total / 2;
    for (const c of chips) {
      c.build(x);
      x += c.width + gap;
    }
  }

  private renderOptions(cx: number) {
    const p = this.puzzle!;
    const y = 312;
    const btnW = 92;
    const btnH = 56;
    const gap = 18;
    const total = p.options.length * btnW + (p.options.length - 1) * gap;
    let x = cx - total / 2 + btnW / 2;

    for (const opt of p.options) {
      const container = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, btnW, btnH, COLORS.particleChip).setStrokeStyle(2, 0xc4a8ff).setInteractive({ useHandCursor: true });
      const txt = this.add.text(0, 0, opt, { fontFamily: 'system-ui', fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      container.add([bg, txt]);
      container.setData('bg', bg);
      bg.on('pointerup', () => this.choose(opt, container));
      x += btnW + gap;
    }

    const skip = this.add.text(cx, 392, 'skip ▸', { fontFamily: 'system-ui', fontSize: '16px', color: '#8890b5' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => {
      if (this.phase === 'puzzle') this.toUpgrades('nope');
    });
  }

  private renderTimer() {
    const w = GAME_WIDTH - 160;
    this.add.rectangle(80, 440, w, 6, COLORS.bgAlt).setOrigin(0, 0.5);
    const bar = this.add.rectangle(80, 440, w, 6, COLORS.xpBar).setOrigin(0, 0.5);
    this.timerEvent = this.tweens.add({
      targets: bar,
      width: 0,
      duration: SOLVE_TIME,
      ease: 'Linear',
      onComplete: () => {
        if (this.phase === 'puzzle') this.toUpgrades('nope');
      },
    });
  }

  private choose(opt: string, container: Phaser.GameObjects.Container) {
    if (this.phase !== 'puzzle' || !this.puzzle) return;
    const bg = container.getData('bg') as Phaser.GameObjects.Rectangle;
    if (opt === this.puzzle.correct) {
      this.solved = true;
      bg.setFillStyle(COLORS.correct);
      this.socketText.setText(opt).setColor('#ffffff');
      this.socketBox.setFillStyle(COLORS.correct).setStrokeStyle(3, 0x9affc0);
      this.tweens.killTweensOf(this.socketBox);
      this.socketBox.setScale(1);
      speakJa(this.puzzle.sentence.jp);
      this.toUpgrades(gradeFromAttempts(this.firstTry, false));
    } else {
      this.firstTry = false;
      bg.setFillStyle(COLORS.wrong);
      bg.disableInteractive();
      this.cameras.main.shake(120, 0.004);
      this.tweens.add({ targets: container, x: container.x + 6, duration: 50, yoyo: true, repeat: 3 });
    }
  }

  // ── upgrade phase ────────────────────────────────────────────────────────
  private toUpgrades(grade: Grade) {
    if (this.phase !== 'puzzle') return;
    this.phase = 'upgrade';
    this.timerEvent?.stop();
    if (this.puzzle) recordGrade(this.puzzle.sentence.sid, grade);

    const stacks = GRADE_STACKS[grade];
    // A short beat so a correct answer reads before the cards appear.
    const delay = this.solved ? 650 : 250;
    this.time.delayedCall(delay, () => this.renderUpgrades(grade, stacks));
  }

  private renderUpgrades(grade: Grade, stacks: number) {
    const cx = GAME_WIDTH / 2;
    // darker layer over the puzzle
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060f, 0.86).setOrigin(0, 0).setInteractive().setDepth(10);

    const banner =
      grade === 'got_it' ? 'PERFECT!  choose a power (×3)'
      : grade === 'kinda' ? 'GREAT!  choose a power (×2)'
      : '+HEAL — and still choose a power (×1)';
    const bColor = grade === 'nope' ? '#ff7ae0' : '#7CFF9E';
    this.add.text(cx, 96, banner, { fontFamily: 'system-ui', fontSize: '24px', color: bColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(11);
    this.add.text(cx, 132, 'Tap an upgrade', { fontFamily: 'system-ui', fontSize: '15px', color: '#8890b5' }).setOrigin(0.5).setDepth(11);

    const offers = this.payload.loadout.offer(3);
    const cardW = 220;
    const cardH = 210;
    const gap = 24;
    const total = offers.length * cardW + (offers.length - 1) * gap;
    let x = cx - total / 2 + cardW / 2;
    const y = GAME_HEIGHT / 2 + 30;

    for (const up of offers) {
      this.makeCard(up, x, y, cardW, cardH, grade, stacks);
      x += cardW + gap;
    }
  }

  private makeCard(up: UpgradeDef, x: number, y: number, w: number, h: number, grade: Grade, stacks: number) {
    const loadout = this.payload.loadout;
    const isWeapon = up.kind === 'weapon';
    const isHeal = up.kind === 'heal';
    const accent = isHeal ? COLORS.hp : isWeapon ? COLORS.bullet : COLORS.particleChip;

    const cur = isHeal ? 0 : loadout.levelOf(up);
    const after = isHeal ? 0 : Math.min(cur + stacks, up.max);
    const levelStr = isHeal ? '' : cur === 0 ? `NEW · Lv ${after}` : `Lv ${cur} → ${after}`;

    const container = this.add.container(x, y).setDepth(12);
    const bg = this.add.rectangle(0, 0, w, h, COLORS.panel).setStrokeStyle(3, accent).setInteractive({ useHandCursor: true });
    const kind = this.add.text(0, -h / 2 + 22, isWeapon ? 'WEAPON' : isHeal ? 'RECOVERY' : 'PASSIVE', { fontFamily: 'system-ui', fontSize: '13px', color: '#8890b5', fontStyle: 'bold' }).setOrigin(0.5);
    const name = this.add.text(0, -h / 2 + 58, up.name, { fontFamily: 'system-ui', fontSize: '21px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 24 } }).setOrigin(0.5);
    const desc = this.add.text(0, 12, up.desc, { fontFamily: 'system-ui', fontSize: '15px', color: '#c8cde8', align: 'center', wordWrap: { width: w - 28 } }).setOrigin(0.5);
    const lvl = this.add.text(0, h / 2 - 26, levelStr, { fontFamily: 'system-ui', fontSize: '16px', color: '#' + accent.toString(16).padStart(6, '0'), fontStyle: 'bold' }).setOrigin(0.5);
    container.add([bg, kind, name, desc, lvl]);

    bg.on('pointerover', () => container.setScale(1.04));
    bg.on('pointerout', () => container.setScale(1));
    bg.on('pointerup', () => this.pick(up, grade, stacks));
  }

  private pick(up: UpgradeDef, grade: Grade, stacks: number) {
    if (this.phase !== 'upgrade') return;
    this.phase = 'done';

    let heal = grade === 'nope' ? NOPE_HEAL : 0;
    if (up.kind === 'heal') {
      heal += HEAL_CARD_AMOUNT;
    } else {
      const { maxHpGain } = this.payload.loadout.apply(up.id, stacks);
      heal += maxHpGain; // +Max HP upgrades also heal by the amount gained
    }

    const onComplete = this.payload.onComplete;
    this.scene.stop();
    this.scene.resume('Run');
    onComplete({ grade, heal });
  }
}
