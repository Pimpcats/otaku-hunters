import Phaser from 'phaser';
import { generatePlaceholderTextures } from '../ui/textures';
import { bakePlayerSheets, loadPlayerSheets, registerPlayerAnims } from '../ui/playerSheet';
import { applyKenneyAssets, loadKenneyAssets } from '../ui/kenneyAssets';
import { getContentIndex } from '../data/contentIndex';
import { FLOOR_TEXTURE_KEY } from '../systems/backdrop';

// Boots the content index + placeholder art, then hands off to the meta screen.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Real player sprite sheets (optional — falls back to procedural art if absent).
    loadPlayerSheets(this);
    // Optional CC0 Kenney drop-ins for enemies / projectiles / pickups / floor.
    // Any missing file is safe; that slot keeps its procedural/placeholder art.
    loadKenneyAssets(this);
    // Tiling floor texture for the 2.5D ground plane (placeholder; see CREDITS.md).
    // A Kenney floor.png (loaded above) overrides this in create(); if neither is
    // present the backdrop falls back to the wireframe grid.
    this.load.image(FLOOR_TEXTURE_KEY, `${import.meta.env.BASE_URL}textures/floor_placeholder.png`);
  }

  create() {
    // Apply any Kenney drop-ins FIRST so the procedural generator below skips the
    // slots they filled (its textures.exists() guards), and so the floor override
    // lands before the backdrop mesh reads FLOOR_TEXTURE_KEY in the run.
    applyKenneyAssets(this);
    generatePlaceholderTextures(this);
    // Overlay each real sheet's directional frames onto its classes' facing keys,
    // then register the walk-cycle animations for sheets that support them.
    bakePlayerSheets(this);
    registerPlayerAnims(this);

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
