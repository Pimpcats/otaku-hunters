import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

// Pause overlay (ESC / Space). Pauses the RunScene beneath it; Resume continues,
// Quit returns to the meta screen.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.66).setOrigin(0, 0).setInteractive();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy - 110, 'PAUSED', { fontFamily: 'system-ui', fontSize: '52px', color: '#6ad7ff', fontStyle: 'bold' })
      .setOrigin(0.5);

    this.button(cx, cy - 14, '▶  RESUME', '#7CFF9E', () => this.resume());
    this.button(cx, cy + 54, '⏏  QUIT TO MENU', '#ff7ae0', () => this.quit());

    this.add
      .text(cx, cy + 124, 'ESC / SPACE to resume', { fontFamily: 'system-ui', fontSize: '15px', color: '#8890b5' })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-ESC', () => this.resume());
    this.input.keyboard?.once('keydown-SPACE', () => this.resume());
  }

  private button(x: number, y: number, label: string, color: string, cb: () => void) {
    const t = this.add
      .text(x, y, label, {
        fontFamily: 'system-ui',
        fontSize: '24px',
        color: '#0b0d1a',
        backgroundColor: color,
        padding: { x: 22, y: 11 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setScale(1.05));
    t.on('pointerout', () => t.setScale(1));
    t.on('pointerup', cb);
    return t;
  }

  private resume() {
    this.scene.resume('Run');
    this.scene.stop();
  }

  private quit() {
    this.scene.stop('Run');
    this.scene.start('Meta');
  }
}
