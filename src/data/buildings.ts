// Building catalogue for the street scene + the in-game placement editor.
//
// Storefronts are 627×627 source art; exteriors are 1254×1254 (2× the storefronts), so the
// editor/scene use scale 0.4 for storefronts and 0.2 for exteriors → matching on-screen height.

export const STOREFRONTS = ['anime_shop', 'game_center', 'karaoke', 'konbini'] as const;
export const EXTERIORS = [
  'utility_wall',
  'alley_gap',
  'poster_wall',
  'service_shutter',
  'apartment_wall',
  'izakaya',
  'hotel',
  'pharmacy',
] as const;
export const ALL_BUILDINGS: string[] = [...STOREFRONTS, ...EXTERIORS];

/** Default scale by type: 0.4 storefront / 0.2 exterior (uniform on-screen height). */
export function buildingScale(key: string): number {
  return (EXTERIORS as readonly string[]).includes(key) ? 0.2 : 0.4;
}
