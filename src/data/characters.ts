// Playable characters (VS-style roster). Each is distinct in starting WEAPON,
// base HP, base move speed, and a small starting passive that states its
// identity. Names are Japanese vocabulary (with the meaning in the blurb) so the
// roster itself reinforces the learning theme — this is a Japanese game first.

import type { StatId } from './balance';
import type { CreatureSpec } from '../ui/textures';

export interface CharacterDef {
  id: string;
  name: string; // Japanese word (roster doubles as vocab)
  blurb: string; // includes reading + meaning + playstyle
  themeColor: number; // UI accent + sprite tint hint
  texture: string; // base texture key (per-facing art generated at boot)
  startWeapon: string; // weapon id from WEAPONS
  baseMaxHp: number;
  baseMoveSpeed: number; // px/s
  startStats: Partial<Record<StatId, number>>; // starting passive levels
  art: CreatureSpec; // placeholder-sprite recipe
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'kohai',
    name: '後輩 Kōhai',
    blurb: 'kōhai · "junior"\nBalanced all-rounder. Reliable Pocky Shooter.',
    themeColor: 0x6ad7ff,
    texture: 'char_kohai',
    startWeapon: 'pocky',
    baseMaxHp: 100,
    baseMoveSpeed: 220,
    startStats: {},
    art: { size: 24, body: 0x6ad7ff, accent: 0xffffff, shape: 'round', accessory: 'headband' },
  },
  {
    id: 'sensei',
    name: '先生 Sensei',
    blurb: 'sensei · "teacher"\nSturdy & slow. Otaku Aura hits all around you.',
    themeColor: 0x7CFF9E,
    texture: 'char_sensei',
    startWeapon: 'aura',
    baseMaxHp: 140,
    baseMoveSpeed: 184,
    startStats: { regen: 1 },
    art: { size: 26, body: 0x7CFF9E, accent: 0xffe08a, shape: 'round', accessory: 'glasses' },
  },
  {
    id: 'ronin',
    name: '浪人 Rōnin',
    blurb: 'rōnin · "wanderer"\nFragile but fast & deadly. Shuriken Storm.',
    themeColor: 0xff7ae0,
    texture: 'char_ronin',
    startWeapon: 'shuriken',
    baseMaxHp: 72,
    baseMoveSpeed: 268,
    startStats: { might: 1 },
    art: { size: 22, body: 0xff7ae0, accent: 0x2a2f55, shape: 'round', ears: 'cat', accessory: 'mask' },
  },
];

export const getCharacter = (id?: string): CharacterDef =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
