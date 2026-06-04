import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';
import { warmUpTTS } from '../audio/tts';
import { STAGES } from '../data/stages';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { WEAPONS } from '../data/balance';
import { dirTextureKey } from '../systems/facing';

// Meta screen: title + character select (three distinct hunters) + tap to start.
// Picking a card launches the run with that character. Stage select / unlocks /
// meta-shop come later.
export class MetaScene extends Phaser.Scene {
  constructor() {
    super('Meta');
  }

  private speedLabel(spd: number): string {
    if (spd < 200) return 'slow';
    if (spd < 250) return 'normal';
    return 'fast';
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(cx, 52, 'OTAKU HUNTER', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '46px',
        color: '#6ad7ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 92, 'survive the swarm · level up in Japanese', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ff7ae0',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 134, 'CHOOSE YOUR HUNTER', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const stage = STAGES[0];
    const cardW = 270;
    const cardH = 286;
    const gap = 30;
    const total = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    let x = cx - total / 2 + cardW / 2;
    const y = 318;

    CHARACTERS.forEach((c, i) => {
      this.makeCard(c, x, y, cardW, cardH, i + 1, stage.id);
      x += cardW + gap;
    });

    this.add
      .text(cx, GAME_HEIGHT - 34, 'Tap a hunter (or press 1 / 2 / 3).  Move: WASD / arrows / drag · weapons auto-fire.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#8890b5',
      })
      .setOrigin(0.5);
  }

  private makeCard(
    c: CharacterDef,
    x: number,
    y: number,
    w: number,
    h: number,
    index: number,
    stageId: string,
  ) {
    const accent = c.themeColor;
    const accentHex = '#' + accent.toString(16).padStart(6, '0');
    const container = this.add.container(x, y);

    const bg = this.add
      .rectangle(0, 0, w, h, COLORS.panel)
      .setStrokeStyle(3, accent)
      .setInteractive({ useHandCursor: true });

    const num = this.add
      .text(-w / 2 + 16, -h / 2 + 14, `${index}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#8890b5',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);

    // The character's actual generated placeholder sprite, scaled up.
    const sprite = this.add
      .image(0, -h / 2 + 70, dirTextureKey(c.texture, 'down'))
      .setScale(3.4);

    const name = this.add
      .text(0, -h / 2 + 124, c.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: accentHex,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);

    const blurb = this.add
      .text(0, -h / 2 + 168, c.blurb, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#c8cde8',
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: w - 28 },
      })
      .setOrigin(0.5, 0);

    const weaponName = WEAPONS[c.startWeapon]?.name ?? c.startWeapon;
    const stats = this.add
      .text(0, h / 2 - 46, `❤ ${c.baseMaxHp}   ·   ⚡ ${this.speedLabel(c.baseMoveSpeed)}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    const weapon = this.add
      .text(0, h / 2 - 22, `🗡 ${weaponName}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: accentHex,
        align: 'center',
      })
      .setOrigin(0.5);

    container.add([bg, num, sprite, name, blurb, stats, weapon]);

    bg.on('pointerover', () => container.setScale(1.04));
    bg.on('pointerout', () => container.setScale(1));
    bg.on('pointerup', () => this.start(c.id, stageId));
    this.input.keyboard?.on(`keydown-${['ONE', 'TWO', 'THREE'][index - 1]}`, () =>
      this.start(c.id, stageId),
    );
  }

  private start(characterId: string, stageId: string) {
    warmUpTTS(); // unlock speech on the user gesture
    this.scene.start('Run', { stageId, characterId });
  }
}
