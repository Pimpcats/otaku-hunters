import Phaser from 'phaser';
import { generatePlaceholderTextures } from '../ui/textures';
import { bakePlayerSheets, loadPlayerSheets } from '../ui/playerSheet';
import { getContentIndex } from '../data/contentIndex';

// Boots the content index + placeholder art, then hands off to the meta screen.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Real player sprite sheets (optional — falls back to procedural art if absent).
    loadPlayerSheets(this);
  }

  create() {
    generatePlaceholderTextures(this);
    // Overlay each real sheet's directional frames onto its classes' facing keys.
    bakePlayerSheets(this);

    // Build the content index once up front so a malformed lessons.js surfaces
    // in the console here rather than mid-run (guardrail §8.7: never blocks).
    const idx = getContentIndex();
    const eligible = idx.sentences.filter((s) => s.eligible).length;
    console.info(
      `[OtakuHunter] content loaded: ${idx.lessons.length} lessons, ` +
        `${idx.sentences.length} sentences (${eligible} puzzle-eligible).`,
    );

    this.scene.start('Meta');
  }
}
