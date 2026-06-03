import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';
import { warmUpTTS } from '../audio/tts';
import { STAGES } from '../data/stages';

// Minimal meta screen for the vertical slice: title + one stage (The Arcade) +
// tap to start. Stage/character select, unlocks and the meta-shop come later.
export class MetaScene extends Phaser.Scene {
  constructor() {
    super('Meta');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(cx, 120, 'OTAKU HUNTER', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '52px',
        color: '#6ad7ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 172, 'survive the swarm · level up in Japanese', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ff7ae0',
      })
      .setOrigin(0.5);

    const stage = STAGES[0];
    this.add
      .text(cx, 268, `STAGE: ${stage.name}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(cx, 360, '▶  TAP TO PLAY', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        color: '#0b0d1a',
        backgroundColor: '#7CFF9E',
        padding: { x: 24, y: 12 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: btn,
      scale: 1.06,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.add
      .text(cx, GAME_HEIGHT - 56, 'Move: WASD / arrows / drag.  Weapons auto-fire.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#8890b5',
      })
      .setOrigin(0.5);

    const start = () => {
      warmUpTTS(); // unlock speech on the user gesture
      this.scene.start('Run', { stageId: stage.id });
    };
    btn.on('pointerup', start);
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
  }
}
