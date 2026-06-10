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
import { CLEAN_SLATE } from '../data/render';

// Boots the content index + placeholder art, then hands off to the meta screen.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // CLEAN SLATE: skip ALL art loading — the old assets moved to public/old/ and the
    // game boots a blank arena (procedural placeholder textures, generated in create(),
    // still cover the gated-off loop + menu portraits so nothing 404s or green-boxes).
    if (CLEAN_SLATE) return;

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

    // ── New asset-by-asset street build (public/assets/ pipeline) ──────────────
    // Direct loads (files committed to the repo). NOTE vs the request: storefronts
    // live under assets/storefronts/ (not assets/buildings/storefronts/), and the
    // ground file is ground_neon_v3.png (no plain ground_neon.png) — keyed 'ground_neon'.
    const A = `${import.meta.env.BASE_URL}assets/`;
    this.load.image('ground_neon', `${A}ground/ground_neon_v3.png`);
    for (const k of ['anime_shop', 'game_center', 'karaoke', 'konbini']) {
      this.load.image(k, `${A}storefronts/${k}.png`);
    }
    for (const k of ['utility_wall', 'alley_gap', 'poster_wall', 'service_shutter', 'apartment_wall', 'izakaya', 'hotel', 'pharmacy']) {
      this.load.image(k, `${A}buildings/exteriors/${k}.png`);
    }
  }

  create() {
    // Apply any Kenney drop-ins FIRST so the procedural generator below skips the
    // slots they filled (its textures.exists() guards), and so the floor override
    // lands before the backdrop mesh reads FLOOR_TEXTURE_KEY in the run.
    if (!CLEAN_SLATE) applyKenneyAssets(this);
    generatePlaceholderTextures(this);
    // Begin loading VOICEVOX manifests (optional; Web Speech covers gaps): the
    // shared set + each character's own per-voice set.
    void loadVoiceManifest();
    for (const id of new Set(CHARACTERS.map((c) => c.voiceId).filter((v): v is number => v != null))) {
      void loadVoiceFor(id);
    }
    // Overlay each real sheet's directional frames onto its classes' facing keys,
    // then register the walk-cycle animations for sheets that support them.
    // (All no-ops under CLEAN_SLATE since no sheets were loaded — skipped explicitly.)
    if (!CLEAN_SLATE) {
      bakePlayerSheets(this);
      registerPlayerAnims(this);
      bakeHeroSheets(this); // slice the rect hero sheets over their facing keys (overrides procedural)
      bakeEnemyWalkSheets(this); // bake walk sheets → per-direction enemy walk anims (applyFacing uses them)
      registerPropAnims(this); // register present prop sheets' idle anims (e.g. prop_vending_idle)
    }

    // Build the content index once up front so a malformed lessons.js surfaces
    // in the console here rather than mid-run (guardrail §8.7: never blocks).
    const idx = getContentIndex();
    const eligible = idx.sentences.filter((s) => s.eligible).length;
    console.info(
      `[OtakuHunter] content loaded: ${idx.lessons.length} lessons, ` +
        `${idx.sentences.length} sentences (${eligible} puzzle-eligible).`,
    );

    // Arena pivot: boot into the new ArenaScene prototype. The street game is
    // still intact — switch back to 'Meta' to reach it.
    this.scene.start('Arena');
  }
}
