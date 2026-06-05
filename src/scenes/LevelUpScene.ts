import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';
import type { ResolvedStage } from '../data/stages';
import type { Word } from '../data/types';
import {
  pickPuzzle,
  gradeFromAttempts,
  gradeFromBuild,
  type Puzzle,
  type BuildPuzzle,
  type TranslatePuzzle,
  type AnyPuzzle,
} from '../systems/puzzle';
import { GRADE_STACKS, NOPE_HEAL, type Grade } from '../data/balance';
import { PlayerLoadout, type UpgradeDef } from '../systems/loadout';
import { recordGrade } from '../systems/srs';
import { readingOf, toRomaji } from '../systems/romaji';
import { speak } from '../audio/tts';
import type { LevelUpResult } from './RunScene';

interface LevelUpData {
  stage: ResolvedStage;
  collectedWords: Map<string, Word>;
  collectedSet: Set<string>;
  level: number;
  loadout: PlayerLoadout;
  recent: Set<string>;
  recentParticles: string[];
  onComplete: (result: LevelUpResult) => void;
}

interface TrayChip {
  word: Word;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  used: boolean;
}
interface BuildSlot {
  x: number;
  width: number;
  rect: Phaser.GameObjects.Rectangle;
}

const SOLVE_TIME = 16000; // ms; no answer → "nope" (still rewards)
const HEAL_CARD_AMOUNT = 40;

// The level-up flow (brief §4 + §2 upgrades):
//   1. Particle-socket puzzle (Tier-A). Grade = got_it / kinda / nope.
//   2. Pick 1 of 3 upgrades; the grade scales how many stacks it applies.
// Correctness is always a BONUS — even a wrong answer still lets you pick an
// upgrade (×1) and heals (guardrail §8.2: never a penalty).
export class LevelUpScene extends Phaser.Scene {
  private payload!: LevelUpData;
  private puzzle: AnyPuzzle | null = null;

  private firstTry = true;
  private solved = false;
  private phase: 'puzzle' | 'upgrade' | 'done' = 'puzzle';
  private answerParticle?: string;

  // particle-mode
  private socketBox!: Phaser.GameObjects.Rectangle;
  private socketText!: Phaser.GameObjects.Text;
  private timerEvent?: Phaser.Tweens.Tween;

  // build-mode
  private buildOrder: Word[] = [];
  private buildPlaced = 0;
  private buildMistakes = 0;
  private buildSlots: BuildSlot[] = [];
  private trayChips: TrayChip[] = [];

  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData) {
    this.payload = data;
    this.firstTry = true;
    this.solved = false;
    this.phase = 'puzzle';
    this.answerParticle = undefined;
    this.buildPlaced = 0;
    this.buildMistakes = 0;
    this.buildSlots = [];
    this.trayChips = [];

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62).setOrigin(0, 0).setInteractive();
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 36, 'LEVEL UP!', { fontFamily: 'system-ui', fontSize: '30px', color: '#7CFF9E', fontStyle: 'bold' }).setOrigin(0.5);

    this.puzzle = pickPuzzle(this.payload.stage, this.payload.collectedSet, {
      level: this.payload.level,
      maxDifficulty: 4 + this.payload.level,
      distractors: 2,
      recent: this.payload.recent,
      recentParticles: this.payload.recentParticles,
    });

    if (!this.puzzle) {
      // No eligible content yet — skip straight to the upgrade pick (§8.7).
      this.add.text(cx, 150, 'Collect words to unlock puzzles!', { fontFamily: 'system-ui', fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
      this.time.delayedCall(700, () => this.toUpgrades('kinda'));
      return;
    }

    if (this.puzzle.kind === 'particle') {
      this.renderPrompt(cx, 'Build it in Japanese — pick the missing particle', this.puzzle.promptEn);
      this.renderSentence(cx);
      this.renderOptions(cx);
    } else if (this.puzzle.kind === 'build') {
      this.renderPrompt(cx, 'Put the words in the right order', this.puzzle.promptEn);
      this.renderBuild(cx);
    } else {
      this.renderTranslate(cx);
    }
    this.renderTimer();
  }

  // ── puzzle phase ─────────────────────────────────────────────────────────
  private renderPrompt(cx: number, subtitle: string, promptEn: string) {
    this.add.text(cx, 84, subtitle, { fontFamily: 'system-ui', fontSize: '15px', color: '#8890b5' }).setOrigin(0.5);
    this.add.text(cx, 124, `“${promptEn}”`, { fontFamily: 'system-ui', fontSize: '24px', color: '#ffffff', fontStyle: 'italic', wordWrap: { width: GAME_WIDTH - 120 }, align: 'center' }).setOrigin(0.5);
  }

  /** Small italic romaji caption centred at (x, y) — the reading under a kana chip. */
  private romaji(x: number, y: number, reading: string, size = 12) {
    return this.add
      .text(x, y, reading, { fontFamily: 'system-ui', fontSize: `${size}px`, color: '#8aa0c8', fontStyle: 'italic' })
      .setOrigin(0.5)
      .setDepth(6);
  }

  private renderSentence(cx: number) {
    const p = this.puzzle as Puzzle;
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
            // label was created first (to measure) so the rect would cover it —
            // reposition AND lift it above the rectangle.
            label.setPosition(x + width / 2, y).setDepth(5);
            // romaji reading under the kana, for beginners
            this.romaji(x + width / 2, y + chipH / 2 + 11, tok.word.romaji ?? readingOf(tok.word.jp, tok.word.pos));
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
    const p = this.puzzle as Puzzle;
    const y = 312;
    const btnW = 92;
    const btnH = 56;
    const gap = 18;
    const total = p.options.length * btnW + (p.options.length - 1) * gap;
    let x = cx - total / 2 + btnW / 2;

    for (const opt of p.options) {
      const container = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, btnW, btnH, COLORS.particleChip).setStrokeStyle(2, 0xc4a8ff).setInteractive({ useHandCursor: true });
      const txt = this.add.text(0, -8, opt, { fontFamily: 'system-ui', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      container.add([bg, txt]);
      container.add(this.romaji(0, btnH / 2 - 12, readingOf(opt, 'prt'), 13)); // reading inside the button
      container.setData('bg', bg);
      bg.on('pointerup', () => this.choose(opt, container));
      x += btnW + gap;
    }

    const skip = this.add.text(cx, 392, 'skip ▸', { fontFamily: 'system-ui', fontSize: '16px', color: '#8890b5' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => {
      if (this.phase === 'puzzle') this.toUpgrades('nope');
    });
  }

  // ── build-the-sentence (word order) ────────────────────────────────────────
  private renderBuild(cx: number) {
    const p = this.puzzle as BuildPuzzle;
    this.buildOrder = p.order;

    const n = p.order.length;
    const slotGap = 8;
    const maxRowW = GAME_WIDTH - 80;
    const slotW = Math.min(96, Math.floor((maxRowW - slotGap * (n - 1)) / n));
    const slotH = 50;
    const rowY = 194;
    const totalW = n * slotW + slotGap * (n - 1);
    let sx = cx - totalW / 2 + slotW / 2;
    for (let i = 0; i < n; i++) {
      const rect = this.add.rectangle(sx, rowY, slotW, slotH, COLORS.socket, 0.45).setStrokeStyle(2, 0x3a3f70);
      this.buildSlots.push({ x: sx, width: slotW, rect });
      sx += slotW + slotGap;
    }

    this.add.text(cx, rowY + 44, '▼ tap the words in order ▼', { fontFamily: 'system-ui', fontSize: '13px', color: '#8890b5' }).setOrigin(0.5);
    this.renderTray(cx, p.scrambled, slotW);

    const skip = this.add.text(cx, 408, 'skip ▸', { fontFamily: 'system-ui', fontSize: '16px', color: '#8890b5' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => {
      if (this.phase === 'puzzle') this.toUpgrades('nope');
    });
  }

  private renderTray(cx: number, words: Word[], minW: number) {
    const padX = 14;
    const chipH = 48;
    const gap = 10;
    const rowMaxW = GAME_WIDTH - 80;
    const measure = (s: string) => {
      const t = this.add.text(0, -999, s, { fontFamily: 'system-ui', fontSize: '26px' });
      const w = t.width;
      t.destroy();
      return w;
    };
    const items = words.map((w) => ({ w, width: Math.max(minW, measure(w.jp) + padX * 2) }));

    // wrap chips into centred rows
    const rows: { items: typeof items; width: number }[] = [];
    let row: typeof items = [];
    let rowW = 0;
    for (const it of items) {
      const add = it.width + (row.length ? gap : 0);
      if (row.length && rowW + add > rowMaxW) {
        rows.push({ items: row, width: rowW });
        row = [];
        rowW = 0;
      }
      row.push(it);
      rowW += it.width + (row.length > 1 ? gap : 0);
    }
    if (row.length) rows.push({ items: row, width: rowW });

    let y = 300;
    for (const r of rows) {
      let x = cx - r.width / 2;
      for (const it of r.items) {
        const container = this.add.container(x + it.width / 2, y);
        const bg = this.add.rectangle(0, 0, it.width, chipH, COLORS.chip).setStrokeStyle(2, 0x5560a0).setInteractive({ useHandCursor: true });
        const txt = this.add.text(0, -7, it.w.jp, { fontFamily: 'system-ui', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        container.add([bg, txt]);
        container.add(this.romaji(0, 13, it.w.romaji ?? readingOf(it.w.jp, it.w.pos), 11)); // reading under the kana
        const chip: TrayChip = { word: it.w, container, bg, used: false };
        bg.on('pointerup', () => this.onTrayTap(chip));
        this.trayChips.push(chip);
        x += it.width + gap;
      }
      y += chipH + 12;
    }
  }

  private onTrayTap(chip: TrayChip) {
    if (this.phase !== 'puzzle' || chip.used || !this.puzzle || this.puzzle.kind !== 'build') return;
    const sentence = this.puzzle.sentence;
    const expected = this.buildOrder[this.buildPlaced];
    if (chip.word.jp === expected.jp) {
      chip.used = true;
      chip.bg.disableInteractive();
      this.tweens.add({ targets: chip.container, alpha: 0.22, duration: 150 });

      const slot = this.buildSlots[this.buildPlaced];
      const isVerb = expected === sentence.verb;
      slot.rect.setFillStyle(isVerb ? COLORS.verb : COLORS.correct, 1).setStrokeStyle(2, 0x9affc0);
      const t = this.add.text(slot.x, slot.rect.y - 7, expected.jp, { fontFamily: 'system-ui', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(6);
      if (t.width > slot.width - 8) t.setScale((slot.width - 8) / t.width);
      this.romaji(slot.x, slot.rect.y + 12, expected.romaji ?? readingOf(expected.jp, expected.pos), 11);
      speak(expected.jp);

      this.buildPlaced++;
      if (this.buildPlaced === this.buildOrder.length) {
        this.solved = true;
        speak(sentence.jp);
        this.toUpgrades(gradeFromBuild(this.buildMistakes, false));
      }
    } else {
      this.buildMistakes++;
      this.firstTry = false;
      this.cameras.main.shake(110, 0.004);
      chip.bg.setFillStyle(COLORS.wrong);
      this.tweens.add({ targets: chip.container, x: chip.container.x + 6, duration: 50, yoyo: true, repeat: 3 });
      this.time.delayedCall(260, () => {
        if (!chip.used) chip.bg.setFillStyle(COLORS.chip);
      });
    }
  }

  // ── translate (vocabulary recall) ──────────────────────────────────────────
  private renderTranslate(cx: number) {
    const p = this.puzzle as TranslatePuzzle;
    const subtitle = p.direction === 'jp2en' ? 'What does this word mean?' : 'Pick the Japanese word';
    this.add.text(cx, 84, subtitle, { fontFamily: 'system-ui', fontSize: '15px', color: '#8890b5' }).setOrigin(0.5);

    // The prompt word, large, ABOVE the option buttons (depth-lifted so a
    // button can never paint over it).
    const big = p.direction === 'jp2en';
    this.add
      .text(cx, 150, p.prompt, {
        fontFamily: 'system-ui',
        fontSize: big ? '44px' : '30px',
        color: big ? '#ffffff' : '#ffd166',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 120 },
      })
      .setOrigin(0.5)
      .setDepth(5);
    // reading under the kana prompt (jp→en direction)
    if (big) this.romaji(cx, 190, readingOf(p.word.jp, p.word.pos, p.word.romaji), 18);
    if (big) speak(p.prompt);

    const isJpOption = p.direction === 'en2jp';
    const btnW = 440;
    const btnH = 46;
    const gap = 12;
    let y = 212; // first button sits clearly below the prompt
    for (const opt of p.options) {
      const container = this.add.container(cx, y);
      const bg = this.add.rectangle(0, 0, btnW, btnH, COLORS.chip).setStrokeStyle(2, 0x5560a0).setInteractive({ useHandCursor: true });
      const txt = this.add.text(0, isJpOption ? -7 : 0, opt, {
        fontFamily: 'system-ui',
        fontSize: isJpOption ? '24px' : '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: btnW - 24 },
      }).setOrigin(0.5);
      container.add([bg, txt]);
      // reading inside the button for the kana options (en→jp direction)
      if (isJpOption) container.add(this.romaji(0, 13, toRomaji(opt), 12));
      container.setData('bg', bg);
      bg.on('pointerup', () => this.chooseTranslate(opt, container));
      y += btnH + gap;
    }

    const skip = this.add.text(cx, 422, 'skip ▸', { fontFamily: 'system-ui', fontSize: '16px', color: '#8890b5' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => {
      if (this.phase === 'puzzle') this.toUpgrades('nope');
    });
  }

  private chooseTranslate(opt: string, container: Phaser.GameObjects.Container) {
    if (this.phase !== 'puzzle' || !this.puzzle || this.puzzle.kind !== 'translate') return;
    const bg = container.getData('bg') as Phaser.GameObjects.Rectangle;
    if (opt === this.puzzle.correct) {
      this.solved = true;
      bg.setFillStyle(COLORS.correct);
      speak(this.puzzle.speak);
      this.toUpgrades(gradeFromAttempts(this.firstTry, false));
    } else {
      this.firstTry = false;
      bg.setFillStyle(COLORS.wrong);
      bg.disableInteractive();
      this.cameras.main.shake(110, 0.004);
      this.tweens.add({ targets: container, x: container.x + 6, duration: 50, yoyo: true, repeat: 3 });
    }
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
    if (this.phase !== 'puzzle' || !this.puzzle || this.puzzle.kind !== 'particle') return;
    const bg = container.getData('bg') as Phaser.GameObjects.Rectangle;
    if (opt === this.puzzle.correct) {
      this.solved = true;
      this.answerParticle = this.puzzle.correct;
      bg.setFillStyle(COLORS.correct);
      this.socketText.setText(opt).setColor('#ffffff');
      this.socketBox.setFillStyle(COLORS.correct).setStrokeStyle(3, 0x9affc0);
      this.tweens.killTweensOf(this.socketBox);
      this.socketBox.setScale(1);
      speak(this.puzzle.sentence.jp);
      this.toUpgrades(gradeFromAttempts(this.firstTry, false));
    } else {
      this.firstTry = false;
      bg.setFillStyle(COLORS.wrong);
      bg.disableInteractive();
      this.cameras.main.shake(120, 0.004);
      this.tweens.add({ targets: container, x: container.x + 6, duration: 50, yoyo: true, repeat: 3 });
    }
  }

  /** Sentence id of the current puzzle (translate puzzles are word-level → none). */
  private currentSid(): string | undefined {
    return this.puzzle && this.puzzle.kind !== 'translate' ? this.puzzle.sentence.sid : undefined;
  }

  // ── upgrade phase ────────────────────────────────────────────────────────
  private toUpgrades(grade: Grade) {
    if (this.phase !== 'puzzle') return;
    this.phase = 'upgrade';
    this.timerEvent?.stop();
    const sid = this.currentSid();
    if (sid) recordGrade(sid, grade); // translate puzzles are word-level (no sid)

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

    const offers = this.payload.loadout.offer(3, this.payload.level);
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

    // Vocab line — names double as Japanese lessons (the learning hook).
    if (up.vocab) {
      const v = up.vocab;
      const vocab = this.add
        .text(0, -h / 2 + 88, `${v.jp}  ${v.romaji} — ${v.meaning}`, {
          fontFamily: 'system-ui',
          fontSize: '13px',
          color: '#8aa0c8',
          align: 'center',
          wordWrap: { width: w - 20 },
        })
        .setOrigin(0.5);
      container.add(vocab);
    }

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
    const sid = this.currentSid();
    this.scene.stop();
    this.scene.resume('Run');
    onComplete({ grade, heal, sid, answerParticle: this.answerParticle });
  }
}
