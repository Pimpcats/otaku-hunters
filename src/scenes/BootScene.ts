import Phaser from 'phaser';
import { generatePlaceholderTextures } from '../ui/textures';
import { bakePlayerSheets, loadPlayerSheets, registerPlayerAnims, loadHeroSheets, bakeHeroSheets } from '../ui/playerSheet';
import { applyKenneyAssets, loadKenneyAssets } from '../ui/kenneyAssets';
import { loadEnemyWalkSheets, bakeEnemyWalkSheets } from '../ui/enemyAnims';
import { loadPropSheets, registerPropAnims } from '../ui/props';
import { loadVoiceManifest, loadVoiceFor } from '../audio/tts';
import { CHARACTERS } from '../data/characters';
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
    loadHeroSheets(this); // per-character 4-direction rect sheets (e.g. Kōhai)
    // Optional CC0 Kenney drop-ins for enemies / projectiles / pickups / floor.
    // Any missing file is safe; that slot keeps its procedural/placeholder art.
    loadKenneyAssets(this);
    // Animated-enemy walk sheets (optional; manifest-gated). Must follow
    // loadKenneyAssets — it queues the art-manifest json these read to self-gate.
    loadEnemyWalkSheets(this);
    // Optional world-space street prop sheets (e.g. the animated vending machine);
    // manifest-gated like the walk sheets — absent files fall back to procedural props.
    loadPropSheets(this);
    // Tiling floor texture for the 2.5D ground plane (placeholder; see CREDITS.md).
    // A Kenney floor.png (loaded above) overrides this in create(); if neither is
    // present the backdrop falls back to the wireframe grid.
    this.load.image(FLOOR_TEXTURE_KEY, `${import.meta.env.BASE_URL}textures/floors/floor_placeholder.png`);
  }

  create() {
    // Apply any Kenney drop-ins FIRST so the procedural generator below skips the
    // slots they filled (its textures.exists() guards), and so the floor override
    // lands before the backdrop mesh reads FLOOR_TEXTURE_KEY in the run.
    applyKenneyAssets(this);
    generatePlaceholderTextures(this);
    // Begin loading VOICEVOX manifests (optional; Web Speech covers gaps): the
    // shared set + each character's own per-voice set.
    void loadVoiceManifest();
    for (const id of new Set(CHARACTERS.map((c) => c.voiceId).filter((v): v is number => v != null))) {
      void loadVoiceFor(id);
    }
    // Overlay each real sheet's directional frames onto its classes' facing keys,
    // then register the walk-cycle animations for sheets that support them.
    bakePlayerSheets(this);
    registerPlayerAnims(this);
    bakeHeroSheets(this); // slice the rect hero sheets over their facing keys (overrides procedural)
    bakeEnemyWalkSheets(this); // bake walk sheets → per-direction enemy walk anims (applyFacing uses them)
    registerPropAnims(this); // register present prop sheets' idle anims (e.g. prop_vending_idle)

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
