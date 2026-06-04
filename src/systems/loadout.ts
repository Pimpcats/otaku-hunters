// Player loadout + the upgrade pool (brief §2 upgrades, VS-style). Tracks weapon
// levels and passive stat levels, derives concrete stats via balance.ts, and
// generates the 1-of-3 level-up choices. No Phaser here — pure state/logic.

import {
  PASSIVES,
  WEAPONS,
  deriveStats,
  type DerivedStats,
  type StatId,
} from '../data/balance';

export type UpgradeKind = 'weapon' | 'passive' | 'heal';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  kind: UpgradeKind;
  statId?: StatId;
  weaponId?: string;
  max: number;
}

// The pool. Themed flavour names; numbers all live in balance.ts.
export const UPGRADES: UpgradeDef[] = [
  { id: 'w_pocky', name: 'Pocky Shooter', desc: 'More damage, projectiles & pierce', kind: 'weapon', weaponId: 'pocky', max: WEAPONS.pocky.maxLevel },
  { id: 'w_aura', name: 'Otaku Aura', desc: 'A pulsing ring that hits all around you', kind: 'weapon', weaponId: 'aura', max: WEAPONS.aura.maxLevel },
  { id: 'p_might', name: 'Energy Drink', desc: '+10% damage', kind: 'passive', statId: 'might', max: PASSIVES.might.max },
  { id: 'p_haste', name: 'Turbo Controller', desc: '+8% attack speed', kind: 'passive', statId: 'haste', max: PASSIVES.haste.max },
  { id: 'p_amount', name: 'Spare Batteries', desc: '+1 projectile (all weapons)', kind: 'passive', statId: 'amount', max: PASSIVES.amount.max },
  { id: 'p_area', name: 'Big-Screen Mode', desc: '+12% attack size', kind: 'passive', statId: 'area', max: PASSIVES.area.max },
  { id: 'p_projSpeed', name: 'Overclock', desc: '+10% projectile speed', kind: 'passive', statId: 'projSpeed', max: PASSIVES.projSpeed.max },
  { id: 'p_moveSpeed', name: 'Hi-Top Sneakers', desc: '+8% move speed', kind: 'passive', statId: 'moveSpeed', max: PASSIVES.moveSpeed.max },
  { id: 'p_maxHp', name: 'Energy Bar', desc: '+25 max HP (and heal)', kind: 'passive', statId: 'maxHp', max: PASSIVES.maxHp.max },
  { id: 'p_regen', name: 'Healing Charm', desc: '+0.5 HP/sec', kind: 'passive', statId: 'regen', max: PASSIVES.regen.max },
  { id: 'p_magnet', name: "Collector's Magnet", desc: '+30% pickup range', kind: 'passive', statId: 'magnet', max: PASSIVES.magnet.max },
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
  // weapon id → level. Start with the Pocky Shooter.
  weaponLevels = new Map<string, number>([['pocky', 1]]);
  statLevels: Partial<Record<StatId, number>> = {};

  stats(): DerivedStats {
    return deriveStats(this.statLevels);
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

  /** Offer `count` distinct, non-maxed upgrades; pad with heal if needed. */
  offer(count: number): UpgradeDef[] {
    const pool = shuffle(UPGRADES.filter((u) => !this.isMaxed(u)));
    const picks = pool.slice(0, count);
    while (picks.length < count) picks.push(HEAL_UPGRADE);
    return picks;
  }
}
