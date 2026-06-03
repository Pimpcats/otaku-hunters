import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';

// Fixed-to-camera run HUD: HP (bottom-left), XP bar (top), level + timer +
// words collected.
export class Hud {
  private xpBar: Phaser.GameObjects.Rectangle;
  private hpBar: Phaser.GameObjects.Rectangle;
  private levelText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private wordsText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const W = GAME_WIDTH;

    // XP bar across the very top.
    scene.add
      .rectangle(0, 0, W, 10, COLORS.bgAlt)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.xpBar = scene.add
      .rectangle(0, 0, 0, 10, COLORS.xpBar)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);

    this.levelText = scene.add
      .text(10, 18, 'LV 1', { fontFamily: 'system-ui', fontSize: '18px', color: '#7CFF9E', fontStyle: 'bold' })
      .setScrollFactor(0)
      .setDepth(902);

    this.timerText = scene.add
      .text(W / 2, 18, '00:00', { fontFamily: 'system-ui', fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(902);

    this.wordsText = scene.add
      .text(W - 10, 18, '語 0', { fontFamily: 'system-ui', fontSize: '18px', color: '#ff7ae0' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(902);

    // HP bar bottom-left.
    scene.add
      .rectangle(10, GAME_HEIGHT - 22, 220, 14, COLORS.hpBack)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.hpBar = scene.add
      .rectangle(10, GAME_HEIGHT - 22, 220, 14, COLORS.hp)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);
  }

  update(state: {
    level: number;
    xp: number;
    xpToNext: number;
    hp: number;
    maxHp: number;
    elapsed: number;
    words: number;
  }): void {
    this.xpBar.width = GAME_WIDTH * Phaser.Math.Clamp(state.xp / state.xpToNext, 0, 1);
    this.hpBar.width = 220 * Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    this.levelText.setText(`LV ${state.level}`);
    this.wordsText.setText(`語 ${state.words}`);
    const m = Math.floor(state.elapsed / 60);
    const s = Math.floor(state.elapsed % 60);
    this.timerText.setText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  }
}
