// Kana → romaji (Hepburn-ish) transliteration for beginner content.
//
// The first stage is written entirely in hiragana/katakana, but the per-word
// tokens inside sentences carry no romaji (only the vocab list and the whole
// sentence do). Beginners need the reading tied to every Japanese chip — on the
// level-up screen and on the words on the ground — so we derive it here.
//
// Scope: kana only (what the early game uses). Kanji would need a dictionary and
// is out of scope; an unknown glyph is passed through unchanged rather than
// throwing. Particles は / へ / を get their spoken readings (wa / e / o) when a
// caller tags the word as a particle (see `readingOf`).

import type { Word } from '../data/types';

// Yōon + common extended (katakana) combinations — checked before single kana.
const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', しぇ: 'she',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', じぇ: 'je',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
};

const MONO: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo',
};

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

/** Katakana → hiragana (so the maps above only need hiragana). ー is preserved. */
function toHiragana(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    // Katakana block ァ(0x30A1)..ヶ(0x30F6) shifts down 0x60 to hiragana.
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCodePoint(c - 0x60);
    else out += ch;
  }
  return out;
}

/** Transliterate a kana string to romaji. Non-kana glyphs pass through. */
export function toRomaji(input: string): string {
  const s = toHiragana(input);
  let out = '';
  let geminate = false; // pending small-tsu (っ) → double next consonant
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (ch === 'っ') { geminate = true; continue; }
    if (ch === 'ー') { // long-vowel mark: repeat the previous vowel
      const last = out[out.length - 1];
      if (VOWELS.has(last)) out += last;
      continue;
    }

    const pair = s.slice(i, i + 2);
    let r: string;
    if (DIGRAPHS[pair]) { r = DIGRAPHS[pair]; i++; }
    else if (MONO[ch]) r = MONO[ch];
    else { out += ch; geminate = false; continue; } // unknown (e.g. kanji)

    if (geminate) {
      r = r.startsWith('ch') ? 't' + r : r[0] + r; // っち → tchi, else double
      geminate = false;
    }
    out += r;
  }
  return out;
}

/** Reading for a word, honouring particle context (は→wa, へ→e). Prefers any
 *  romaji already supplied in the content data. */
export function readingOf(jp: string, pos?: string, romaji?: string): string {
  if (romaji) return romaji;
  if (pos === 'prt') {
    if (jp === 'は') return 'wa';
    if (jp === 'へ') return 'e';
  }
  return toRomaji(jp);
}

/** A copy of a word guaranteed to carry a `romaji` reading. */
export function withReading(w: Word): Word {
  if (w.romaji) return w;
  return { ...w, romaji: readingOf(w.jp, w.pos) };
}
