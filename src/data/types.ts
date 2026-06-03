// Shared content types. These mirror the exact shapes in lessons.js (brief §1).

export type Pos =
  | 'n'
  | 'v'
  | 'adj'
  | 'adv'
  | 'prt'
  | 'cop'
  | 'expr'
  | 'aux'
  | 'conj';

export interface Word {
  jp: string;
  en: string;
  pos: Pos;
  romaji?: string;
}

export interface RawSentence {
  en: string;
  jp: string;
  romaji: string;
  hint?: string;
  words: Word[];
}

export interface Lesson {
  id: string;
  section: string; // matches a theme string in LEVELS
  title: string;
  grammar: string;
  grammarNote?: string;
  vocab: Word[];
  sentences: RawSentence[];
}

export interface Tier {
  name: string;
  blurb: string;
  themes: string[];
}

export interface Level {
  id: string;
  name: string;
  title: string;
  blurb: string;
  tiers: Tier[];
}

// A flat, game-ready sentence record (brief §1 "Content index").
export interface IndexedSentence {
  sid: string; // `${lessonId}#${sentenceIndex}`
  lessonId: string;
  section: string;
  levelId: string;
  tierName: string;
  en: string;
  jp: string;
  romaji: string;
  hint?: string;
  words: Word[];
  // derived:
  roleWords: Word[]; // content words that get socketed
  particles: string[]; // ordered role-markers used, e.g. ["は","を"]
  verb: Word | null; // the v/cop/aux (or fallback) anchor
  difficulty: number; // # role-markers + length heuristic
  eligible: boolean; // false if words[] doesn't rebuild jp (skip as puzzle target)
}

declare global {
  interface Window {
    LEVELS: Level[];
    LESSONS: Lesson[];
  }
}
