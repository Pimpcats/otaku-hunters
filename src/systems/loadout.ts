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
  // VS passives that are ported as data but not yet wired into a gameplay system
  // are marked `wired: false` — they're kept out of the live level-up offer pool
  // so we never show a card that does nothing. Flip to true (or remove) once the
  // consuming system (armor→onPlayerHit, growth→XP, curse→spawner, …) exists.
  wired?: boolean;
}

// The pool. Themed flavour names; numbers all live in balance.ts (ported from
// the real VS data). Every one of these is still earned through the Japanese
// level-up drill — these are just the rewards, not a replacement for the lesson.
export const UPGRADES: UpgradeDef[] = [
  { id: 'w_pocky', name: 'Pocky Shooter', desc: 'More damage, projectiles & pierce', kind: 'weapon', weaponId: 'pocky', max: WEAPONS.pocky.maxLevel },
  { id: 'w_aura', name: 'Otaku Aura', desc: 'A pulsing ring that hits all around you', kind: 'weapon', weaponId: 'aura', max: WEAPONS.aura.maxLevel },
  { id: 'w_shuriken', name: 'Shuriken Storm', desc: 'A fast storm of short-range piercing stars', kind: 'weapon', weaponId: 'shuriken', max: WEAPONS.shuriken.maxLevel },
  { id: 'p_might', name: 'Energy Drink', desc: '+5% damage', kind: 'passive', statId: 'might', max: PASSIVES.might.max },
  { id: 'p_haste', name: 'Turbo Controller', desc: '+2.5% attack speed', kind: 'passive', statId: 'haste', max: PASSIVES.haste.max },
  { id: 'p_amount', name: 'Spare Batteries', desc: '+1 projectile (all weapons)', kind: 'passive', statId: 'amount', max: PASSIVES.amount.max },
  { id: 'p_area', name: 'Big-Screen Mode', desc: '+5% attack size', kind: 'passive', statId: 'area', max: PASSIVES.area.max },
  { id: 'p_projSpeed', name: 'Overclock', desc: '+10% projectile speed', kind: 'passive', statId: 'projSpeed', max: PASSIVES.projSpeed.max },
  { id: 'p_moveSpeed', name: 'Hi-Top Sneakers', desc: '+5% move speed', kind: 'passive', statId: 'moveSpeed', max: PASSIVES.moveSpeed.max },
  { id: 'p_maxHp', name: 'Energy Bar', desc: '+10 max HP (and heal)', kind: 'passive', statId: 'maxHp', max: PASSIVES.maxHp.max },
  { id: 'p_regen', name: 'Healing Charm', desc: '+0.1 HP/sec', kind: 'passive', statId: 'regen', max: PASSIVES.regen.max },
  { id: 'p_magnet', name: "Collector's Magnet", desc: '+25% pickup range', kind: 'passive', statId: 'magnet', max: PASSIVES.magnet.max },

  // ── Ported from VS, inert until wired (kept out of the offer pool). Names keep
  //    the Japanese-study theme so they slot straight in once their systems land.
  { id: 'p_armor', name: 'Kotatsu Blanket', desc: '−1 damage taken', kind: 'passive', statId: 'armor', max: PASSIVES.armor.max, wired: false },
  { id: 'p_growth', name: 'Study Streak', desc: '+3% XP gain', kind: 'passive', statId: 'growth', max: PASSIVES.growth.max, wired: false },
  { id: 'p_greed', name: 'Gachapon Luck', desc: '+10% gold gain', kind: 'passive', statId: 'greed', max: PASSIVES.greed.max, wired: false },
  { id: 'p_luck', name: 'Maneki-neko', desc: '+10% luck', kind: 'passive', statId: 'luck', max: PASSIVES.luck.max, wired: false },
  { id: 'p_curse', name: 'Cursed Manga', desc: '+10% enemy strength (more loot)', kind: 'passive', statId: 'curse', max: PASSIVES.curse.max, wired: false },
  { id: 'p_revival', name: 'Extra Life', desc: 'Revive once on death', kind: 'passive', statId: 'revival', max: PASSIVES.revival.max, wired: false },
];

export const HEAL_UPGRADE: UpgradeDef = {
  id: 'heal',
  name: 'First-Aid Snack',
  desc: 'Restore some HP',
  kind: 'heal',
  max: Infinity,
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

  /** Any weapon that is maxed AND whose required passive is maxed can evolve,
   *  once the player has reached EVOLVE_MIN_LEVEL. Surfaced as synthetic
   *  `evo_<baseId>` upgrades (not in the static pool). */
  private availableEvolutions(playerLevel: number): UpgradeDef[] {
    if (playerLevel < EVOLVE_MIN_LEVEL) return [];
    const out: UpgradeDef[] = [];
    for (const id of this.ownedWeaponIds()) {
      const def = WEAPONS[id];
      if (!def?.evolvesTo || !def.evolveRequires) continue;
      if (this.weaponLevel(id) < def.maxLevel) continue;
      // VS rule: weapon maxed AND its required passive maxed → a true late-game
      // capstone, not an early freebie.
      if ((this.statLevels[def.evolveRequires] ?? 0) < PASSIVES[def.evolveRequires].max) continue;
      if (this.ownsWeapon(def.evolvesTo)) continue;
      const evo = WEAPONS[def.evolvesTo];
      out.push({
        id: `evo_${id}`,
        name: `EVOLVE → ${evo.name}`,
        desc: `${def.name} reaches its final form`,
        kind: 'weapon',
        weaponId: def.evolvesTo,
        max: evo.maxLevel,
      });
    }
    return out;
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
