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
  sentence: IndexedSentence;
  promptEn: string;
  tokens: PuzzleToken[]; // left→right display, including the one socket
  socketIndex: number; // index into tokens of the blank
  options: string[]; // particle choices (shuffled), includes the answer
  correct: string; // the correct particle jp
}

/** Words collected this run; we only need their jp surface forms for matching. */
export type CollectedPool = Set<string>;

interface SelectOpts {
  /** Soft cap on difficulty so early level-ups stay trivial (brief §4.3). */
  maxDifficulty: number;
  /** How many wrong particle options to offer (tier scaling). */
  distractors: number;
  /** Recently-served sids to avoid repeating (variety). */
  recent?: Set<string>;
}

function countCollected(s: IndexedSentence, pool: CollectedPool): number {
  return s.roleWords.reduce((n, w) => n + (pool.has(w.jp) ? 1 : 0), 0);
}

/** Weighted-random pick: favours sentences using more collected words and
 *  ones the SRS wants to resurface ("haunting"), so it's varied but not random
 *  noise. Returns null only for an empty list. */
function weightedPick(cands: IndexedSentence[], pool: CollectedPool): IndexedSentence | null {
  if (cands.length === 0) return null;
  const weights = cands.map((s) => (countCollected(s, pool) + 1) * hauntWeight(s.sid));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

/**
 * Sentence selection with run-only pool + fallbacks (brief §4.5), now
 * randomised for variety. Prefers sentences whose role words the player has
 * collected and that fit the difficulty budget, avoids recent repeats, and
 * never returns null while the stage has any eligible sentence (cold-start).
 */
export function selectSentence(
  stage: ResolvedStage,
  pool: CollectedPool,
  opts: SelectOpts,
): IndexedSentence | null {
  // Eligible = puzzle-safe (words rebuild jp) AND has at least one role-marker.
  const eligible = stage.sentences.filter(
    (s) => s.eligible && s.particles.some((p) => isRoleMarker(p)),
  );
  if (eligible.length === 0) return null;

  const withinTier = eligible.filter((s) => s.difficulty <= opts.maxDifficulty);
  const tierPool = withinTier.length > 0 ? withinTier : eligible;

  // Choose the candidate set by how much the player has collected:
  //  1) full match (every role word collected)  2) partial  3) cold-start (all).
  const full = tierPool.filter((s) => s.roleWords.every((w) => pool.has(w.jp)));
  const partial = tierPool.filter((s) => s.roleWords.some((w) => pool.has(w.jp)));
  let candidates = full.length > 0 ? full : partial.length > 0 ? partial : tierPool;

  // Avoid repeating the last few sentences, as long as something's left.
  const recent = opts.recent;
  if (recent && recent.size > 0) {
    const fresh = candidates.filter((s) => !recent.has(s.sid));
    if (fresh.length > 0) candidates = fresh;
  }

  return weightedPick(candidates, pool);
}

/**
 * Build a Tier-A puzzle from a sentence: tokenise words[], pick one role-marker
 * to blank, render the rest as fixed chips. Sentence-final particles after the
 * verb become a non-interactive tail (brief §4.4).
 */
export function buildTierA(sentence: IndexedSentence, distractors: number): Puzzle | null {
  const words = sentence.words;

  // Indices of socketable role-markers.
  const markerIdxs: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].pos === 'prt' && isRoleMarker(words[i].jp)) markerIdxs.push(i);
  }
  if (markerIdxs.length === 0) return null;

  // Blank one at random (variety across repeated plays).
  const blankIdx = markerIdxs[Math.floor(Math.random() * markerIdxs.length)];
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
    sentence,
    promptEn: sentence.en,
    tokens,
    socketIndex,
    options: buildParticleOptions(correct, distractors),
    correct,
  };
}

/** Map the player's interaction to the three-grade scale (brief §4.6). */
export function gradeFromAttempts(solvedFirstTry: boolean, gaveUp: boolean): Grade {
  if (gaveUp) return 'nope';
  return solvedFirstTry ? 'got_it' : 'kinda';
}
