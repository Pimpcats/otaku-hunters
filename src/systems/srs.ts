// Spaced-repetition store (brief §7). localStorage-backed, keyed per sid, with
// an SM-2-flavoured record so the data is portable to/from Hanasou. In the
// slice this records grades and exposes a "haunting" weight; the spawn-director
// reskin (brief §7) builds on it later.

import type { Grade } from './puzzle';

export interface SrsRecord {
  reps: number;
  ease: number; // 1.3 .. 2.5+
  interval: number; // in "runs" for now
  due: number; // run counter when it should resurface
  lapses: number;
}

interface SrsStore {
  runCounter: number;
  records: Record<string, SrsRecord>;
}

const KEY = 'otaku-hunter.srs.v1';

function load(): SrsStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SrsStore;
  } catch {
    /* ignore corrupt storage */
  }
  return { runCounter: 0, records: {} };
}

function save(store: SrsStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage may be unavailable (private mode); never throw */
  }
}

const GRADE_Q: Record<Grade, number> = { got_it: 5, kinda: 3, nope: 1 };

/** Update the SM-2 record for a sentence after a level-up solve. */
export function recordGrade(sid: string, grade: Grade): void {
  const store = load();
  const r: SrsRecord = store.records[sid] ?? {
    reps: 0,
    ease: 2.5,
    interval: 0,
    due: store.runCounter,
    lapses: 0,
  };
  const q = GRADE_Q[grade];
  if (q < 3) {
    r.reps = 0;
    r.interval = 1;
    r.lapses += 1;
  } else {
    r.reps += 1;
    r.interval = r.reps === 1 ? 1 : Math.ceil(r.interval * r.ease);
    r.ease = Math.max(1.3, r.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
  r.due = store.runCounter + r.interval;
  store.records[sid] = r;
  save(store);
}

/**
 * Haunting weight for spawn/selection bias (brief §7). Sentences graded
 * nope/kinda and now "due" weigh heavier so they resurface.
 */
export function hauntWeight(sid: string): number {
  const store = load();
  const r = store.records[sid];
  if (!r) return 1;
  const overdue = store.runCounter >= r.due;
  const lapseBoost = 1 + r.lapses * 0.5;
  return overdue ? lapseBoost * 1.5 : lapseBoost;
}

/** Advance the run counter (call at run start). */
export function beginRun(): void {
  const store = load();
  store.runCounter += 1;
  save(store);
}
