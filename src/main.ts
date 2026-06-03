import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './constants';
import { BootScene } from './scenes/BootScene';
import { MetaScene } from './scenes/MetaScene';
import { RunScene } from './scenes/RunScene';
import { LevelUpScene } from './scenes/LevelUpScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MetaScene, RunScene, LevelUpScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
