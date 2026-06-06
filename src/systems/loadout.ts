// Player loadout + the upgrade pool (brief §2 upgrades, VS-style). Tracks weapon
// levels and passive stat levels, derives concrete stats via balance.ts, and
// generates the 1-of-3 level-up choices. No Phaser here — pure state/logic.

import {
  PASSIVES,
  WEAPONS,
  EVOLVE_MIN_LEVEL,
  deriveStats,
  type DerivedStats,
  type StatId,
  type Vocab,
} from '../data/balance';
import type { CharacterDef } from '../data/characters';

export type UpgradeKind = 'weapon' | 'passive' | 'heal';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  kind: UpgradeKind;
  statId?: StatId;
  weaponId?: string;
  max: number;
  vocab?: Vocab; // themed JP label shown on the upgrade card; names double as vocab
  // VS passives that are ported as data but not yet wired into a gameplay system
  // are marked `wired: false` — they're kept out of the live level-up offer pool
  // so we never show a card that does nothing. Flip to true (or remove) once the
  // consuming system (armor→onPlayerHit, growth→XP, curse→spawner, …) exists.
  wired?: boolean;
}

// The pool. Themed flavour names; numbers all live in balance.ts (ported from
// the real VS data). Every one of these is still earned through the Japanese
// level-up drill — these are just the rewards, not a replacement for the lesson.
// Themed as the fame/otaku arsenal (weapons) + fan-culture accessories
// (passives). Each carries a JP vocab label so the upgrade screen teaches words.
// Stat names in parentheses are the themed "Star Power" stat (§2). Numbers all
// live in balance.ts; every pick is still earned through the Japanese level-up.
export const UPGRADES: UpgradeDef[] = [
  { id: 'w_pocky', name: 'Okashi Barrage', desc: 'More damage, projectiles & pierce', kind: 'weapon', weaponId: 'pocky', max: WEAPONS.pocky.maxLevel, vocab: { jp: 'お菓子', romaji: 'Okashi', meaning: 'sweets / snacks' } },
  { id: 'w_aura', name: 'Ōen Wave', desc: 'A pulsing cheer that hits all around you', kind: 'weapon', weaponId: 'aura', max: WEAPONS.aura.maxLevel, vocab: { jp: '応援', romaji: 'Ōen', meaning: 'cheer / support' } },
  { id: 'w_shuriken', name: 'Shuriken Storm', desc: 'A fast storm of short-range piercing stars', kind: 'weapon', weaponId: 'shuriken', max: WEAPONS.shuriken.maxLevel, vocab: { jp: '手裏剣', romaji: 'Shuriken', meaning: 'throwing star' } },
  { id: 'p_might', name: 'Oshi', desc: '+5% Charisma (damage)', kind: 'passive', statId: 'might', max: PASSIVES.might.max, vocab: { jp: '推し', romaji: 'Oshi', meaning: "one's favorite" } },
  { id: 'p_haste', name: 'Tempo', desc: '+2.5% Tempo (attack speed)', kind: 'passive', statId: 'haste', max: PASSIVES.haste.max, vocab: { jp: 'テンポ', romaji: 'Tenpo', meaning: 'tempo' } },
  { id: 'p_amount', name: 'Dōjinshi', desc: '+1 Encore (projectile, all weapons)', kind: 'passive', statId: 'amount', max: PASSIVES.amount.max, vocab: { jp: '同人誌', romaji: 'Dōjinshi', meaning: 'self-published work' } },
  { id: 'p_area', name: 'Presence', desc: '+5% Presence (attack size)', kind: 'passive', statId: 'area', max: PASSIVES.area.max, vocab: { jp: '存在感', romaji: 'Sonzaikan', meaning: 'presence' } },
  { id: 'p_projSpeed', name: 'Hype', desc: '+10% Hype (projectile speed)', kind: 'passive', statId: 'projSpeed', max: PASSIVES.projSpeed.max, vocab: { jp: '勢い', romaji: 'Ikioi', meaning: 'momentum' } },
  { id: 'p_moveSpeed', name: 'Sneakers', desc: '+5% Footwork (move speed)', kind: 'passive', statId: 'moveSpeed', max: PASSIVES.moveSpeed.max, vocab: { jp: 'スニーカー', romaji: 'Sunīkā', meaning: 'sneakers' } },
  { id: 'p_maxHp', name: 'Energy Drink', desc: '+10 Stamina (max HP, and heal)', kind: 'passive', statId: 'maxHp', max: PASSIVES.maxHp.max, vocab: { jp: '栄養ドリンク', romaji: 'Eiyō-dorinku', meaning: 'energy drink' } },
  { id: 'p_regen', name: 'Second Wind', desc: '+0.1 Recovery (HP/sec)', kind: 'passive', statId: 'regen', max: PASSIVES.regen.max, vocab: { jp: '回復', romaji: 'Kaifuku', meaning: 'recovery' } },
  { id: 'p_magnet', name: 'Magnetism', desc: '+25% Fascination (pickup range)', kind: 'passive', statId: 'magnet', max: PASSIVES.magnet.max, vocab: { jp: 'カリスマ', romaji: 'Karisuma', meaning: 'charisma' } },

  // ── Ported from VS, wired into gameplay (RunScene consumes each). ──
  { id: 'p_armor', name: 'Composure', desc: '−1 damage taken (Calm)', kind: 'passive', statId: 'armor', max: PASSIVES.armor.max, vocab: { jp: '平常心', romaji: 'Heijōshin', meaning: 'composure' } },
  { id: 'p_growth', name: 'Fame', desc: '+3% Fame Growth (XP gain)', kind: 'passive', statId: 'growth', max: PASSIVES.growth.max, vocab: { jp: '名声', romaji: 'Meisei', meaning: 'fame' } },
  { id: 'p_luck', name: 'Star Luck', desc: '+10% word-token drops', kind: 'passive', statId: 'luck', max: PASSIVES.luck.max, vocab: { jp: '運', romaji: 'Un', meaning: 'luck' } },
  { id: 'p_curse', name: 'Cursed Merch', desc: '+10% enemy strength & XP', kind: 'passive', statId: 'curse', max: PASSIVES.curse.max, vocab: { jp: '呪い', romaji: 'Noroi', meaning: 'curse' } },
  { id: 'p_revival', name: 'Extra Life', desc: 'Revive once on death', kind: 'passive', statId: 'revival', max: PASSIVES.revival.max, vocab: { jp: '復活', romaji: 'Fukkatsu', meaning: 'revival' } },

  // Still inert — no economy/shop exists for coins yet, so this stays out of the
  // offer pool (no dead card). Wire it if/when a coin sink lands.
  { id: 'p_greed', name: 'Merch Sales', desc: '+10% coin gain', kind: 'passive', statId: 'greed', max: PASSIVES.greed.max, wired: false, vocab: { jp: '商売', romaji: 'Shōbai', meaning: 'business' } },
];

export const HEAL_UPGRADE: UpgradeDef = {
  id: 'heal',
  name: 'First-Aid Snack',
  desc: 'Restore some HP',
  kind: 'heal',
  max: Infinity,
  vocab: { jp: '手当て', romaji: 'Teate', meaning: 'treatment' },
};

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class PlayerLoadout {
  readonly character: CharacterDef;
  weaponLevels: Map<string, number>;
  statLevels: Partial<Record<StatId, number>>;

  // Initialised from the chosen character: its starting weapon (level 1) and any
  // identity passives. Base HP/move-speed come from the character too (see stats).
  constructor(character: CharacterDef) {
    this.character = character;
    this.weaponLevels = new Map<string, number>([[character.startWeapon, 1]]);
    this.statLevels = { ...character.startStats };
  }

  stats(): DerivedStats {
    return deriveStats(this.statLevels, this.character.baseMaxHp);
  }

  ownsWeapon(id: string): boolean {
    return (this.weaponLevels.get(id) ?? 0) > 0;
  }
  weaponLevel(id: string): number {
    return this.weaponLevels.get(id) ?? 0;
  }
  ownedWeaponIds(): string[] {
    return [...this.weaponLevels.keys()].filter((id) => (this.weaponLevels.get(id) ?? 0) > 0);
  }

  /** Current level of an upgrade (weapon level, or stat level). */
  levelOf(u: UpgradeDef): number {
    if (u.kind === 'weapon') return this.weaponLevels.get(u.weaponId!) ?? 0;
    if (u.kind === 'passive') return this.statLevels[u.statId!] ?? 0;
    return 0;
  }
  isMaxed(u: UpgradeDef): boolean {
    return u.kind !== 'heal' && this.levelOf(u) >= u.max;
  }

  /** Apply N stacks (levels) of an upgrade, capped at its max. Returns the
   *  number of max-HP points gained, so the caller can heal by that delta. */
  apply(id: string, stacks: number): { maxHpGain: number } {
    // Evolution pick (id `evo_<baseWeaponId>`): retire the base weapon and grant
    // its evolved form at full power — the player's DPS-ceiling lift.
    if (id.startsWith('evo_')) {
      const baseId = id.slice(4);
      const base = WEAPONS[baseId];
      if (base?.evolvesTo && WEAPONS[base.evolvesTo]) {
        this.weaponLevels.delete(baseId);
        this.weaponLevels.set(base.evolvesTo, WEAPONS[base.evolvesTo].maxLevel);
      }
      return { maxHpGain: 0 };
    }
    const u = BY_ID.get(id);
    if (!u) return { maxHpGain: 0 };
    if (u.kind === 'weapon') {
      const cur = this.weaponLevels.get(u.weaponId!) ?? 0;
      this.weaponLevels.set(u.weaponId!, Math.min(cur + stacks, u.max));
      return { maxHpGain: 0 };
    }
    if (u.kind === 'passive') {
      const before = this.statLevels[u.statId!] ?? 0;
      const after = Math.min(before + stacks, u.max);
      this.statLevels[u.statId!] = after;
      const maxHpGain =
        u.statId === 'maxHp' ? (after - before) * PASSIVES.maxHp.perLevel : 0;
      return { maxHpGain };
    }
    return { maxHpGain: 0 };
  }

  /** Base weapon ids that can evolve RIGHT NOW: weapon maxed AND its required
   *  passive maxed AND the evolved form not already owned. No player-level gate —
   *  this is what the Gacha capsule queries (the capsule is itself the trigger). */
  eligibleEvolutions(): string[] {
    const out: string[] = [];
    for (const id of this.ownedWeaponIds()) {
      const def = WEAPONS[id];
      if (!def?.evolvesTo || !def.evolveRequires) continue;
      if (this.weaponLevel(id) < def.maxLevel) continue;
      if ((this.statLevels[def.evolveRequires] ?? 0) < PASSIVES[def.evolveRequires].max) continue;
      if (this.ownsWeapon(def.evolvesTo)) continue;
      out.push(id);
    }
    return out;
  }

  /** Synthetic `evo_<baseId>` upgrades for the level-up DRAFT (gated by player
   *  level). The capsule path uses `eligibleEvolutions()` directly, ungated. */
  private availableEvolutions(playerLevel: number): UpgradeDef[] {
    if (playerLevel < EVOLVE_MIN_LEVEL) return [];
    return this.eligibleEvolutions().map((id) => {
      const def = WEAPONS[id];
      const evo = WEAPONS[def.evolvesTo!];
      return {
        id: `evo_${id}`,
        name: `EVOLVE → ${evo.name}`,
        desc: `${def.name} reaches its final form`,
        kind: 'weapon',
        weaponId: def.evolvesTo,
        max: evo.maxLevel,
        vocab: evo.vocab,
      } as UpgradeDef;
    });
  }

  /** Offer `count` distinct upgrades; available evolutions take priority, then
   *  the normal pool (non-maxed, wired); pad with heal if needed. Ported-but-
   *  unwired passives (wired === false) never show — no dead cards. */
  offer(count: number, playerLevel: number): UpgradeDef[] {
    const evolutions = this.availableEvolutions(playerLevel);
    const pool = shuffle(UPGRADES.filter((u) => u.wired !== false && !this.isMaxed(u)));
    const picks = [...evolutions, ...pool].slice(0, count);
    while (picks.length < count) picks.push(HEAL_UPGRADE);
    return picks;
  }
}
