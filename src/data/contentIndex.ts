// Builds the game-ready content index from lessons.js (brief §1).
//
// Guardrail §8.4 / §8.7: content is CONSUMED, never authored here, and a single
// malformed entry must never break the rest. Every derivation degrades
// gracefully (brief §4.4): verb-less sentences, words[] that don't rebuild jp,
// etc. are flagged, not fatal.

import './lessons.js'; // side-effect: populates window.LEVELS / window.LESSONS
import type { IndexedSentence, Lesson, Level, Word } from './types';
import { isRoleMarker } from './particles-meta';
import { readingOf } from '../systems/romaji';

const CONTENT_POS = new Set<Word['pos']>(['n', 'adj', 'adv']);
const VERB_POS = new Set<Word['pos']>(['v', 'cop', 'aux']);

// Strip whitespace + sentence punctuation (which jp carries but the tokenised
// words[] omit) before comparing, while KEEPING ー — it's a real part of words
// like コーヒー. Anything left over that doesn't match means a word is genuinely
// missing (e.g. because#4), which correctly flags the sentence ineligible.
const PUNCT = /[\s。、，．・！？!?「」『』（）()｜…〜～：；:;]/g;
const normalize = (s: string): string => s.replace(PUNCT, '');

/** Resolve which (levelId, tierName) a lesson section belongs to. */
function buildThemeMap(levels: Level[]): Map<string, { levelId: string; tierName: string }> {
  const map = new Map<string, { levelId: string; tierName: string }>();
  for (const level of levels) {
    for (const tier of level.tiers) {
      for (const theme of tier.themes) {
        if (!map.has(theme)) map.set(theme, { levelId: level.id, tierName: tier.name });
      }
    }
  }
  return map;
}

/** Find the sentence's anchor: last verb/cop/aux → last adj → last content word. */
function findVerbAnchor(words: Word[]): Word | null {
  for (let i = words.length - 1; i >= 0; i--) {
    if (VERB_POS.has(words[i].pos)) return words[i];
  }
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].pos === 'adj') return words[i];
  }
  for (let i = words.length - 1; i >= 0; i--) {
    if (CONTENT_POS.has(words[i].pos)) return words[i];
  }
  return null;
}

function deriveSentence(
  lesson: Lesson,
  index: number,
  themeMap: Map<string, { levelId: string; tierName: string }>,
  romajiHints: Map<string, string>,
): IndexedSentence {
  const raw = lesson.sentences[index];
  // Sentence tokens ship without per-word romaji; derive a reading for each so
  // every Japanese chip downstream (level-up chips, ground tokens) can show it.
  // Prefer an authored vocab reading (catches irregulars like こんにちは=konnichiwa).
  const words = (raw.words ?? []).map((w) =>
    w.romaji ? w : { ...w, romaji: romajiHints.get(w.jp) ?? readingOf(w.jp, w.pos) },
  );
  const resolved = themeMap.get(lesson.section);

  // Eligibility: does words[] concatenate back to jp? (catches because#4 etc.)
  const rebuilt = normalize(words.map((w) => w.jp).join(''));
  const eligible = words.length > 0 && rebuilt === normalize(raw.jp);

  // Role-markers actually used, in order, and the content words they bind.
  const particles: string[] = [];
  const roleWords: Word[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.pos === 'prt' && isRoleMarker(w.jp)) {
      particles.push(w.jp);
      // the immediately preceding content word is the bound role word
      for (let j = i - 1; j >= 0; j--) {
        if (CONTENT_POS.has(words[j].pos)) {
          roleWords.push(words[j]);
          break;
        }
      }
    }
  }

  const verb = findVerbAnchor(words);
  const difficulty = particles.length * 2 + Math.ceil(words.length / 2);

  return {
    sid: `${lesson.id}#${index}`,
    lessonId: lesson.id,
    section: lesson.section,
    levelId: resolved?.levelId ?? '?',
    tierName: resolved?.tierName ?? '?',
    en: raw.en,
    jp: raw.jp,
    romaji: raw.romaji,
    hint: raw.hint,
    words,
    roleWords,
    particles,
    verb,
    difficulty,
    eligible,
  };
}

let cached: ContentIndex | null = null;

export interface ContentIndex {
  levels: Level[];
  lessons: Lesson[];
  sentences: IndexedSentence[];
  /** sentences keyed by sid */
  bySid: Map<string, IndexedSentence>;
}

/** Build (once) and return the full content index. */
export function getContentIndex(): ContentIndex {
  if (cached) return cached;

  const levels: Level[] = window.LEVELS ?? [];
  const lessons: Lesson[] = window.LESSONS ?? [];
  const themeMap = buildThemeMap(levels);
  // jp → authored romaji, harvested from every lesson's vocab, to seed readings
  // for the romaji-less sentence tokens (and override irregular kana).
  const romajiHints = new Map<string, string>();
  for (const lesson of lessons) {
    for (const w of lesson.vocab ?? []) {
      if (w.romaji && !romajiHints.has(w.jp)) romajiHints.set(w.jp, w.romaji);
    }
  }

  const sentences: IndexedSentence[] = [];
  for (const lesson of lessons) {
    if (!Array.isArray(lesson.sentences)) continue;
    for (let i = 0; i < lesson.sentences.length; i++) {
      try {
        sentences.push(deriveSentence(lesson, i, themeMap, romajiHints));
      } catch (err) {
        // One bad entry never blocks the rest (guardrail §8.7).
        console.warn(`[contentIndex] skipped ${lesson.id}#${i}:`, err);
      }
    }
  }

  const bySid = new Map(sentences.map((s) => [s.sid, s]));
  cached = { levels, lessons, sentences, bySid };
  return cached;
}

/** Unique words across a set of sentences = a stage's pickup spawn table. */
export function buildWordPool(sentences: IndexedSentence[]): Word[] {
  const seen = new Map<string, Word>();
  for (const s of sentences) {
    for (const w of s.words) {
      const key = `${w.jp}|${w.en}|${w.pos}`;
      if (!seen.has(key)) seen.set(key, w);
    }
  }
  return [...seen.values()];
}
