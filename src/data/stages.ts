// Stages = curriculum, config-driven (brief §5). Adding content = adding a
// config object, never touching core code.

import type { IndexedSentence, Word } from './types';
import { buildWordPool, getContentIndex } from './contentIndex';

export interface StageConfig {
  id: string;
  name: string;
  content: { levelIds: string[]; tiers?: string[] };
  tileset: string; // palette key (placeholder art)
  enemyTable: string[]; // enemy archetype keys (brief §6)
  boss: string;
  unlock: { requires: string | null };
}

export const STAGES: StageConfig[] = [
  {
    id: 'arcade',
    name: 'The Arcade',
    content: { levelIds: ['L1'], tiers: ['Beginner', 'Intermediate'] },
    tileset: 'arcade',
    enemyTable: ['RushFan', 'MerchMule'],
    boss: 'ultimate_collector',
    unlock: { requires: null },
  },
];

export interface ResolvedStage {
  config: StageConfig;
  sentences: IndexedSentence[];
  wordPool: Word[];
}

/**
 * Resolve a stage's content filter (levelIds + tiers) → themes → sentences,
 * then derive its word pool. Eligible (puzzle-safe) sentences come first but
 * ineligible ones still contribute their words to the pickup pool (brief §4.4).
 */
export function resolveStage(config: StageConfig): ResolvedStage {
  const { levels, sentences } = getContentIndex();
  const level = levels.find((l) => config.content.levelIds.includes(l.id));

  // Collect the set of themes this stage draws from.
  const themes = new Set<string>();
  if (level) {
    for (const tier of level.tiers) {
      if (!config.content.tiers || config.content.tiers.includes(tier.name)) {
        for (const t of tier.themes) themes.add(t);
      }
    }
  }

  const stageSentences = sentences.filter(
    (s) => config.content.levelIds.includes(s.levelId) && themes.has(s.section),
  );

  return {
    config,
    sentences: stageSentences,
    wordPool: buildWordPool(stageSentences),
  };
}

export function getStage(id: string): ResolvedStage {
  const config = STAGES.find((s) => s.id === id) ?? STAGES[0];
  return resolveStage(config);
}
