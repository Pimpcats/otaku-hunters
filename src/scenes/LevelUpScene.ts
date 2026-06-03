import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';
import type { ResolvedStage } from '../data/stages';
import type { Word } from '../data/types';
import {
  selectSentence,
  buildTierA,
  gradeFromAttempts,
  type Puzzle,
  type Grade,
} from '../systems/puzzle';
import { recordGrade } from '../systems/srs';
import { speakJa } from '../audio/tts';
import type { LevelUpResult } from './RunScene';

interface LevelUpData {
  stage: ResolvedStage;
  collectedWords: Map<string, Word>;
  collectedSet: Set<string>;
  level: number;
  onComplete: (result: LevelUpResult) => void;
}

const SOLVE_TIME = 15000; // ms before a no-answer counts as "nope" (still rewards)

// The particle-socket minigame (brief §4). Slice = Tier-A: role words shown in
// order, ONE particle blanked, pick it from seen distractors. Reward scales
// with correctness as a BONUS — there is no run-ending fail (guardrail §8.2).
export class LevelUpScene extends Phaser.Scene {
  private payload!: LevelUpData;
  private puzzle: Puzzle | null = null;

  private firstTry = true;
  private solved = false;
  private finished = false;

  private socketBox!: Phaser.GameObjects.Rectangle;
  private socketText!: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private timerBar!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData) {
    this.payload = data;
    this.firstTry = true;
    this.solved = false;
    this.finished = false;
    this.optionButtons = [];

    // dim backdrop
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62)
      .setOrigin(0, 0)
      .setInteractive(); // swallow clicks behind the panel

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 36, 'LEVEL UP!', {
        fontFamily: 'system-ui',
        fontSize: '30px',
        color: '#7CFF9E',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Pick a sentence (run-only pool + cold-start grace, brief §4.5) and build
    // the Tier-A puzzle. Difficulty budget ramps with player level (§4.3).
    const maxDifficulty = 4 + this.payload.level;
    const sentence = selectSentence(this.payload.stage, this.payload.collectedSet, {
      maxDifficulty,
      distractors: 2,
    });
    this.puzzle = sentence ? buildTierA(sentence, 2) : null;

    if (!this.puzzle) {
      // No eligible content at all — grant a freebie rather than block (§8.7).
      this.add
        .text(cx, GAME_HEIGHT / 2, 'Collect words to power up!', {
          fontFamily: 'system-ui',
          fontSize: '20px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      this.time.delayedCall(900, () => this.finish('kinda'));
      return;
    }

    this.renderPrompt(cx);
    this.renderSentence(cx);
    this.renderOptions(cx);
    this.renderTimer();
  }

  private renderPrompt(cx: number) {
    this.add
      .text(cx, 84, 'Build it in Japanese — pick the missing particle', {
        fontFamily: 'system-ui',
        fontSize: '15px',
        color: '#8890b5',
      })
      .setOrigin(0.5);

    // English prompt only — never the JP answer (guardrail §8.1).
    this.add
      .text(cx, 124, `“${this.puzzle!.promptEn}”`, {
        fontFamily: 'system-ui',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'italic',
        wordWrap: { width: GAME_WIDTH - 120 },
        align: 'center',
      })
      .setOrigin(0.5);
  }

  /** Render the sentence chips in order with the blank socket inline. */
  private renderSentence(cx: number) {
    const p = this.puzzle!;
    const y = 220;
    const gap = 10;
    const padX = 14;
    const chipH = 52;

    // First pass: build measured chips to compute total width for centring.
    const chips: { width: number; build: (x: number) => void }[] = [];

    for (let i = 0; i < p.tokens.length; i++) {
      const tok = p.tokens[i];
      if (tok.kind === 'socket') {
        const width = 64;
        chips.push({
          width,
          build: (x) => {
            this.socketBox = this.add
              .rectangle(x + width / 2, y, width, chipH, COLORS.socket)
              .setStrokeStyle(3, COLORS.particleChip);
            this.socketText = this.add
              .text(x + width / 2, y, '？', {
                fontFamily: 'system-ui',
                fontSize: '26px',
                color: '#8a5cff',
                fontStyle: 'bold',
              })
              .setOrigin(0.5);
            // gentle pulse to draw the eye
            this.tweens.add({
              targets: this.socketBox,
              scaleX: 1.08,
              scaleY: 1.08,
              duration: 600,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.inOut',
            });
          },
        });
      } else {
        const isVerb = tok.word === p.sentence.verb;
        const isTail = tok.kind === 'tail';
        const label = this.add
          .text(0, -999, tok.jp, { fontFamily: 'system-ui', fontSize: '26px', color: '#ffffff' })
          .setOrigin(0.5);
        const width = label.width + padX * 2;
        const fill = isVerb ? COLORS.verb : isTail ? COLORS.bgAlt : COLORS.chip;
        chips.push({
          width,
          build: (x) => {
            this.add.rectangle(x + width / 2, y, width, chipH, fill).setStrokeStyle(
              2,
              isVerb ? 0x9affc0 : 0x5560a0,
            );
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
    const y = 330;
    const btnW = 92;
    const btnH = 56;
    const gap = 18;
    const total = p.options.length * btnW + (p.options.length - 1) * gap;
    let x = cx - total / 2 + btnW / 2;

    for (const opt of p.options) {
      const container = this.add.container(x, y);
      const bg = this.add
        .rectangle(0, 0, btnW, btnH, COLORS.particleChip)
        .setStrokeStyle(2, 0xc4a8ff)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(0, 0, opt, {
          fontFamily: 'system-ui',
          fontSize: '28px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      container.add([bg, txt]);
      container.setData('opt', opt);
      container.setData('bg', bg);
      bg.on('pointerup', () => this.choose(opt, container));
      this.optionButtons.push(container);
      x += btnW + gap;
    }

    // A no-pressure "skip" — counts as nope but still rewards (a small heal).
    const skip = this.add
      .text(cx, 408, 'skip ▸', { fontFamily: 'system-ui', fontSize: '16px', color: '#8890b5' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => {
      if (!this.finished) this.finish('nope');
    });
  }

  private renderTimer() {
    const w = GAME_WIDTH - 160;
    this.add.rectangle(80, 458, w, 6, COLORS.bgAlt).setOrigin(0, 0.5);
    this.timerBar = this.add.rectangle(80, 458, w, 6, COLORS.xpBar).setOrigin(0, 0.5);
    this.tweens.add({
      targets: this.timerBar,
      width: 0,
      duration: SOLVE_TIME,
      ease: 'Linear',
      onComplete: () => {
        if (!this.solved && !this.finished) this.finish('nope');
      },
    });
  }

  private choose(opt: string, container: Phaser.GameObjects.Container) {
    if (this.solved || this.finished || !this.puzzle) return;
    const bg = container.getData('bg') as Phaser.GameObjects.Rectangle;

    if (opt === this.puzzle.correct) {
      this.solved = true;
      bg.setFillStyle(COLORS.correct);
      this.socketText.setText(opt).setColor('#ffffff');
      this.socketBox.setFillStyle(COLORS.correct).setStrokeStyle(3, 0x9affc0);
      this.tweens.killTweensOf(this.socketBox);
      this.socketBox.setScale(1);
      speakJa(this.puzzle.sentence.jp); // full sentence audio on solve (§4.7)

      const grade = gradeFromAttempts(this.firstTry, false);
      this.showBanner(grade);
      this.time.delayedCall(1150, () => this.finish(grade));
    } else {
      // Wrong: mark it, shake, let them retry. Never ends the puzzle (§8.2).
      this.firstTry = false;
      bg.setFillStyle(COLORS.wrong);
      bg.disableInteractive();
      this.cameras.main.shake(120, 0.004);
      this.tweens.add({
        targets: container,
        x: container.x + 6,
        duration: 50,
        yoyo: true,
        repeat: 3,
      });
    }
  }

  private showBanner(grade: Grade) {
    const text =
      grade === 'got_it' ? 'PERFECT!  +FULL POWER' : 'GOT IT!  +POWER';
    this.add
      .text(GAME_WIDTH / 2, 168, text, {
        fontFamily: 'system-ui',
        fontSize: '22px',
        color: '#7CFF9E',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  private finish(grade: Grade) {
    if (this.finished) return;
    this.finished = true;
    if (this.puzzle) recordGrade(this.puzzle.sentence.sid, grade);
    const onComplete = this.payload.onComplete;
    this.scene.stop();
    this.scene.resume('Run');
    onComplete({ grade });
  }
}
