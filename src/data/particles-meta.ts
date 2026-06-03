// Particle metadata (brief §1 & §4.3).
//
// The corpus only ever uses the particles below. Distractors in the minigame
// MUST be drawn from this real, seen inventory — never invent particles the
// learner hasn't encountered (guardrail §8.1).

// Role-markers: these attach a content word to the verb and ARE socketed.
export const ROLE_MARKERS = [
  'は',
  'が',
  'を',
  'に',
  'で',
  'と',
  'へ',
  'から',
  'まで',
  'の',
  'も',
] as const;

// Sentence-final / mood particles: rendered as a fixed, non-interactive tail.
// They are NOT socketed by the player (brief §4.4 step 4).
export const SENTENCE_FINAL = ['か', 'よ', 'ね', 'な', 'って'] as const;

export type RoleMarker = (typeof ROLE_MARKERS)[number];

const ROLE_MARKER_SET = new Set<string>(ROLE_MARKERS);
const SENTENCE_FINAL_SET = new Set<string>(SENTENCE_FINAL);

export function isRoleMarker(jp: string): boolean {
  return ROLE_MARKER_SET.has(jp);
}

export function isSentenceFinal(jp: string): boolean {
  return SENTENCE_FINAL_SET.has(jp);
}

// Classic confusions to prioritise as distractors (brief §4.4).
// Maps a correct particle → the wrong ones that are most pedagogically useful.
const CONFUSION_TABLE: Record<string, string[]> = {
  は: ['が', 'を'],
  が: ['は', 'を'],
  を: ['は', 'が'],
  に: ['で', 'へ'],
  で: ['に', 'を'],
  へ: ['に', 'まで'],
  から: ['まで', 'に'],
  まで: ['から', 'に'],
  の: ['は', 'が'],
  も: ['は', 'が'],
  と: ['に', 'も'],
};

/**
 * Build a shuffled set of particle options for a single socket: the correct
 * particle plus `distractorCount` plausible wrong ones (classic confusions
 * first, then any other seen role-markers). Difficulty tier controls count.
 */
export function buildParticleOptions(correct: string, distractorCount: number): string[] {
  const picks: string[] = [];
  const confusions = CONFUSION_TABLE[correct] ?? [];
  for (const c of confusions) {
    if (picks.length >= distractorCount) break;
    if (c !== correct && !picks.includes(c)) picks.push(c);
  }
  // Top up from the broader role-marker inventory if we still need more.
  for (const m of ROLE_MARKERS) {
    if (picks.length >= distractorCount) break;
    if (m !== correct && !picks.includes(m)) picks.push(m);
  }
  const options = [correct, ...picks.slice(0, distractorCount)];
  // Fisher–Yates shuffle so the correct answer isn't always first.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
