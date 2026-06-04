// The particle-socket minigame's brain (brief §4). The LevelUpScene renders
// these structures; this module owns selection + grading only (no Phaser).
//
// Vertical slice = Tier-A (particle-only): role words are shown in correct
// order, ONE role-marker is blanked, the player picks it from seen distractors.

import type { IndexedSentence, Word } from '../data/types';
import type { ResolvedStage } from '../data/stages';
import { buildParticleOptions, isRoleMarker, isSentenceFinal } from '../data/particles-meta';
import { hauntWeight } from './srs';

export type Grade = 'got_it' | 'kinda' | 'nope';

export type TokenKind = 'word' | 'socket' | 'tail';

export interface PuzzleToken {
  kind: TokenKind;
  word: Word; // the underlying word (for 'socket' this is the correct particle)
  jp: string; // display text for word/tail; '' for an unfilled socket
}

export interface Puzzle {
  kind: 'particle';
  sentence: IndexedSentence;
  promptEn: string;
  tokens: PuzzleToken[]; // left→right display, including the one socket
  socketIndex: number; // index into tokens of the blank
  options: string[]; // particle choices (shuffled), includes the answer
  correct: string; // the correct particle jp
}

/** Word-order ("build the sentence") puzzle: arrange scrambled chips into the
 *  correct order. Tests structure, and works on ANY eligible sentence (incl.
 *  verb-less / particle-free ones), unlocking the rest of the content. */
export interface BuildPuzzle {
  kind: 'build';
  sentence: IndexedSentence;
  promptEn: string;
  order: Word[]; // the correct sequence (= words[])
  scrambled: Word[]; // the same words, shuffled, for the tray
}

export type AnyPuzzle = Puzzle | BuildPuzzle;

/** Words collected this run; we only need their jp surface forms for matching. */
export type CollectedPool = Set<string>;

export interface PickOpts {
  level: number;
  /** Soft cap on difficulty so early level-ups stay trivial (brief §4.3). */
  maxDifficulty: number;
  /** How many wrong particle options to offer (tier scaling). */
  distractors: number;
  /** Recently-served sids to avoid repeating (variety). */
  recent?: Set<string>;
  /** Recently-served answer particles, to break the は/を skew. */
  recentParticles?: string[];
}

type Mode = 'particle' | 'build';

function countCollected(s: IndexedSentence, pool: CollectedPool): number {
  return s.roleWords.reduce((n, w) => n + (pool.has(w.jp) ? 1 : 0), 0);
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Approx corpus frequency of each role-marker → rarer particles get tested
// more, so the answer isn't は/を ~80% of the time.
const PARTICLE_FREQ: Record<string, number> = {
  を: 47, は: 36, に: 21, が: 16, で: 11, の: 8, と: 8, まで: 5, も: 2, へ: 1, から: 1,
};
function particleScore(p: string, recent?: string[]): number {
  const rarity = 1 / (PARTICLE_FREQ[p] ?? 5);
  const fresh = recent && recent.includes(p) ? 0.15 : 1; // down-weight just-seen answers
  return rarity * fresh;
}
function bestParticleScore(s: IndexedSentence, recent?: string[]): number {
  let best = 0;
  for (const p of s.particles) if (isRoleMarker(p)) best = Math.max(best, particleScore(p, recent));
  return best || 0.01;
}

/** Candidate sentences for a mode, narrowed by difficulty, collection & recency. */
function candidatesFor(
  stage: ResolvedStage,
  pool: CollectedPool,
  opts: PickOpts,
  mode: Mode,
): IndexedSentence[] {
  const base = stage.sentences.filter((s) =>
    mode === 'particle'
      ? s.eligible && s.particles.some((p) => isRoleMarker(p))
      : s.eligible && s.words.length >= 3, // build works on ANY orderable sentence
  );
  if (base.length === 0) return [];

  const withinTier = base.filter((s) => s.difficulty <= opts.maxDifficulty);
  const tierPool = withinTier.length > 0 ? withinTier : base;

  // Collection tiers: full (every role word collected) → partial → cold-start.
  // Particle-free sentences have no role words, so they're vacuously "full".
  const full = tierPool.filter((s) => s.roleWords.every((w) => pool.has(w.jp)));
  const partial = tierPool.filter((s) => s.roleWords.some((w) => pool.has(w.jp)));
  let cands = full.length > 0 ? full : partial.length > 0 ? partial : tierPool;

  if (opts.recent && opts.recent.size > 0) {
    const fresh = cands.filter((s) => !opts.recent!.has(s.sid));
    if (fresh.length > 0) cands = fresh;
  }
  return cands;
}

/** Weighted-random pick: favours more-collected & SRS-"haunted" sentences, and
 *  (for particle mode) sentences offering a rarer/fresher particle answer. */
function pickWeighted(
  cands: IndexedSentence[],
  pool: CollectedPool,
  mode: Mode,
  recentParticles?: string[],
): IndexedSentence | null {
  if (cands.length === 0) return null;
  const weights = cands.map((s) => {
    let w = (countCollected(s, pool) + 1) * hauntWeight(s.sid);
    if (mode === 'particle') w *= bestParticleScore(s, recentParticles);
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

/** Back-compat particle-only selector (used by dev tools). */
export function selectSentence(
  stage: ResolvedStage,
  pool: CollectedPool,
  opts: { maxDifficulty: number; distractors: number; recent?: Set<string> },
): IndexedSentence | null {
  const cands = candidatesFor(stage, pool, { ...opts, level: 1 }, 'particle');
  return pickWeighted(cands, pool, 'particle');
}

/**
 * Unified level-up puzzle picker. Particles are an intermediate skill, so the
 * curriculum LEADS with word-order (build) and RAMPS particles in by level:
 * none for the first few levels (when you barely know the words), then a
 * growing share so particles become the mid/late-game focus. Selects a fitting,
 * varied, skew-corrected sentence; falls back to the other mode if one has no
 * candidates; null only if the stage has neither.
 */
export function pickPuzzle(stage: ResolvedStage, pool: CollectedPool, opts: PickOpts): AnyPuzzle | null {
  // 0% particles until ~level 4, then fade in toward a 60% cap (mid/late focus).
  const particleShare = clamp(0.07 * (opts.level - 3), 0, 0.6);
  const first: Mode = Math.random() < particleShare ? 'particle' : 'build';
  const order: Mode[] = first === 'particle' ? ['particle', 'build'] : ['build', 'particle'];

  for (const mode of order) {
    const cands = candidatesFor(stage, pool, opts, mode);
    const s = pickWeighted(cands, pool, mode, opts.recentParticles);
    if (!s) continue;
    const puzzle = mode === 'particle' ? buildTierA(s, opts.distractors, opts.recentParticles) : buildBuild(s);
    if (puzzle) return puzzle;
  }
  return null;
}

/**
 * Build a Tier-A puzzle from a sentence: tokenise words[], pick one role-marker
 * to blank, render the rest as fixed chips. Sentence-final particles after the
 * verb become a non-interactive tail (brief §4.4).
 */
export function buildTierA(
  sentence: IndexedSentence,
  distractors: number,
  recentParticles?: string[],
): Puzzle | null {
  const words = sentence.words;

  // Indices of socketable role-markers.
  const markerIdxs: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].pos === 'prt' && isRoleMarker(words[i].jp)) markerIdxs.push(i);
  }
  if (markerIdxs.length === 0) return null;

  // Blank one, weighted toward rarer / not-recently-seen particles (skew fix).
  const blankIdx = weightedIndex(
    markerIdxs,
    markerIdxs.map((i) => particleScore(words[i].jp, recentParticles)),
  );
  const verbIdx = sentence.verb ? words.lastIndexOf(sentence.verb) : words.length - 1;

  const tokens: PuzzleToken[] = [];
  let socketIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (i === blankIdx) {
      socketIndex = tokens.length;
      tokens.push({ kind: 'socket', word: w, jp: '' });
    } else if (w.pos === 'prt' && isSentenceFinal(w.jp) && i > verbIdx) {
      tokens.push({ kind: 'tail', word: w, jp: w.jp });
    } else {
      tokens.push({ kind: 'word', word: w, jp: w.jp });
    }
  }

  const correct = words[blankIdx].jp;
  return {
    kind: 'particle',
    sentence,
    promptEn: sentence.en,
    tokens,
    socketIndex,
    options: buildParticleOptions(correct, distractors),
    correct,
  };
}

/** Build a "build the sentence" puzzle: the correct order plus a shuffled tray. */
export function buildBuild(sentence: IndexedSentence): BuildPuzzle | null {
  const order = sentence.words.slice();
  if (order.length < 2) return null;
  let scrambled = shuffle(order.slice());
  // Avoid handing back an already-correct arrangement.
  for (let t = 0; t < 6 && scrambled.every((w, i) => w === order[i]); t++) {
    scrambled = shuffle(order.slice());
  }
  return { kind: 'build', sentence, promptEn: sentence.en, order, scrambled };
}

/** Index into `idxs` chosen weighted-randomly by `weights`. */
function weightedIndex(idxs: number[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return idxs[Math.floor(Math.random() * idxs.length)];
  let r = Math.random() * total;
  for (let i = 0; i < idxs.length; i++) {
    r -= weights[i];
    if (r <= 0) return idxs[i];
  }
  return idxs[idxs.length - 1];
}

/** Map a particle drill's attempts to the three-grade scale (brief §4.6). */
export function gradeFromAttempts(solvedFirstTry: boolean, gaveUp: boolean): Grade {
  if (gaveUp) return 'nope';
  return solvedFirstTry ? 'got_it' : 'kinda';
}

/** Map a build puzzle's mistakes to the three-grade scale. */
export function gradeFromBuild(mistakes: number, gaveUp: boolean): Grade {
  if (gaveUp) return 'nope';
  return mistakes === 0 ? 'got_it' : 'kinda';
}
