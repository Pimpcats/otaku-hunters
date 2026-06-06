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
  scrambled: Word[]; // the tray: the order's words shuffled (+ Tier-B particle decoys)
  // 'C' = full assembly (order the exact words). 'B' = place + particle: the tray
  // also holds decoy role-markers, so you must choose the right particle while
  // ordering. Same UI + grading; a decoy tap just counts as a mistake.
  tier: 'B' | 'C';
}

export type AnyPuzzle = Puzzle | BuildPuzzle | TranslatePuzzle;

/** Vocabulary recall: show a word in one language, pick its meaning in the
 *  other. The most beginner-friendly mode and the early-game foundation. */
export interface TranslatePuzzle {
  kind: 'translate';
  word: Word;
  direction: 'jp2en' | 'en2jp';
  prompt: string; // the shown side
  speak: string; // the jp to voice on solve
  options: string[]; // answer-side choices (shuffled)
  correct: string; // correct answer-side string
}

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

type Mode = 'particle' | 'build' | 'translate';

// Content-word POS worth quizzing as vocabulary (skip particles/copula/aux).
const VOCAB_POS = new Set<string>(['n', 'v', 'adj', 'adv', 'expr']);

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

/** Decide a weighted, fallback-ordered list of modes for this level. The
 *  curriculum mirrors how you actually learn: VOCAB (translate) → WORD ORDER
 *  (build) → PARTICLES (the intermediate "glue"), each fading in/out by level. */
function modeOrder(level: number): Mode[] {
  const particle = clamp(0.07 * (level - 3), 0, 0.6); // 0 until ~L4 → 60% cap
  const remainder = 1 - particle;
  const translateRaw = clamp(0.75 - 0.07 * level, 0.1, 0.75); // vocab dominant early
  const translate = remainder * translateRaw;
  const build = remainder * (1 - translateRaw);

  const weighted: [Mode, number][] = [
    ['translate', translate],
    ['build', build],
    ['particle', particle],
  ];
  const total = translate + build + particle || 1;
  let r = Math.random() * total;
  let primary: Mode = 'build';
  for (const [m, w] of weighted) {
    r -= w;
    if (r <= 0) {
      primary = m;
      break;
    }
  }
  // primary first, then the rest by weight (build is the safest fallback)
  const rest = weighted.filter(([m]) => m !== primary).sort((a, b) => b[1] - a[1]).map(([m]) => m);
  return [primary, ...rest];
}

/** Chance a 'build' puzzle is upgraded to Tier B (place + particle) — 0 until
 *  ~L5, ramping with level so the harder hybrid fades in as the player advances. */
function tierBChance(level: number): number {
  return clamp(0.12 * (level - 4), 0, 0.6);
}

function buildForMode(mode: Mode, stage: ResolvedStage, pool: CollectedPool, opts: PickOpts): AnyPuzzle | null {
  if (mode === 'translate') return buildTranslate(stage, pool);
  const cands = candidatesFor(stage, pool, opts, mode);
  const s = pickWeighted(cands, pool, mode, opts.recentParticles);
  if (!s) return null;
  if (mode === 'particle') return buildTierA(s, opts.distractors, opts.recentParticles);
  // 'build': Tier C (plain assembly) or, increasingly with level, Tier B (+particle decoys).
  const decoys = Math.random() < tierBChance(opts.level) ? (opts.level > 8 ? 2 : 1) : 0;
  return buildBuild(s, decoys);
}

/**
 * Unified level-up puzzle picker. Chooses a MODE by the level-based curriculum
 * (vocab → word-order → particles), then builds a fitting, varied,
 * skew-corrected puzzle. Falls back through the other modes if one has no
 * candidates; null only if none do.
 */
export function pickPuzzle(stage: ResolvedStage, pool: CollectedPool, opts: PickOpts): AnyPuzzle | null {
  for (const mode of modeOrder(opts.level)) {
    const puzzle = buildForMode(mode, stage, pool, opts);
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

/**
 * Build a "build the sentence" puzzle: the correct order plus a shuffled tray.
 * `decoyParticles` > 0 upgrades it to Tier B (place + particle) — decoy role-markers
 * (ones NOT in this sentence) are added to the tray, so the player must pick the
 * right particle while ordering. Only applied when the sentence actually uses a
 * role-marker; otherwise it stays Tier C (plain assembly).
 */
export function buildBuild(sentence: IndexedSentence, decoyParticles = 0): BuildPuzzle | null {
  const order = sentence.words.slice();
  if (order.length < 2) return null;

  const hasMarker = order.some((w) => w.pos === 'prt' && isRoleMarker(w.jp));
  const used = new Set(order.map((w) => w.jp));
  const decoys: Word[] =
    decoyParticles > 0 && hasMarker
      ? shuffle(Object.keys(PARTICLE_FREQ).filter((p) => isRoleMarker(p) && !used.has(p)))
          .slice(0, decoyParticles)
          .map((jp) => ({ jp, en: '(particle)', pos: 'prt' } as Word))
      : [];

  const tray = [...order, ...decoys];
  let scrambled = shuffle(tray.slice());
  // Avoid handing back the order already in place at the front of the tray.
  for (let t = 0; t < 6 && scrambled.slice(0, order.length).every((w, i) => w === order[i]); t++) {
    scrambled = shuffle(tray.slice());
  }
  return { kind: 'build', sentence, promptEn: sentence.en, order, scrambled, tier: decoys.length ? 'B' : 'C' };
}

/** Build a vocabulary-recall puzzle from the stage word pool. Picks a content
 *  word (favouring collected ones), a translation direction, and same-POS
 *  distractors so the choices are plausible. */
export function buildTranslate(
  stage: ResolvedStage,
  pool: CollectedPool,
): TranslatePuzzle | null {
  const all = stage.wordPool.filter((w) => VOCAB_POS.has(w.pos) && w.en && w.jp);
  if (all.length < 2) return null;

  // Prefer testing words the player has actually collected.
  const collected = all.filter((w) => pool.has(w.jp));
  const src = collected.length >= 2 && Math.random() < 0.85 ? collected : all;
  const word = src[Math.floor(Math.random() * src.length)];

  const direction: TranslatePuzzle['direction'] = Math.random() < 0.5 ? 'jp2en' : 'en2jp';
  const displayOf = (w: Word) => (direction === 'jp2en' ? w.en : w.jp);
  const correctDisplay = displayOf(word);

  // Distractors: same POS first (more plausible), else any other vocab word.
  const samePos = all.filter((w) => w.pos === word.pos && w.jp !== word.jp && w.en !== word.en);
  const distractorPool = samePos.length >= 3 ? samePos : all.filter((w) => w.jp !== word.jp && w.en !== word.en);

  const seen = new Set<string>([correctDisplay]);
  const distractors: string[] = [];
  for (const w of shuffle(distractorPool.slice())) {
    const d = displayOf(w);
    if (!seen.has(d)) {
      seen.add(d);
      distractors.push(d);
    }
    if (distractors.length >= 3) break;
  }
  if (distractors.length === 0) return null;

  return {
    kind: 'translate',
    word,
    direction,
    prompt: direction === 'jp2en' ? word.jp : word.en,
    speak: word.jp,
    options: shuffle([correctDisplay, ...distractors]),
    correct: correctDisplay,
  };
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
