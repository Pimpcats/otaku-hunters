import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './constants';
import { BootScene } from './scenes/BootScene';
import { MetaScene } from './scenes/MetaScene';
import { BackgroundScene } from './scenes/BackgroundScene';
import { RunScene } from './scenes/RunScene';
import { HudScene } from './scenes/HudScene';
import { LevelUpScene } from './scenes/LevelUpScene';
import { PauseScene } from './scenes/PauseScene';

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
  // Order == render order. Background sits behind Run (it shows through Run's
  // transparent sky band); Hud sits in front; LevelUp/Pause are modals on top of all.
  scene: [BootScene, MetaScene, BackgroundScene, RunScene, HudScene, LevelUpScene, PauseScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
