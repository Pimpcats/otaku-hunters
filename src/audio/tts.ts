// Japanese audio. Prefers pre-generated VOICEVOX clips (a manifest shared with
// the Hanasou study app, copied into public/audio/), and falls back to the device
// Web Speech API for any text without a clip. Audio is never a hard requirement —
// a missing manifest/clip degrades silently and never blocks gameplay.
//
// Manifest shape (public/audio/manifest.json):
//   { "clips": { "<jp text>": { "n": "file.mp3", "s": "file_slow.mp3"? } } }
//   n = normal-speed file; s = optional pre-generated slow file (relative to audio/).

interface ClipEntry {
  n: string; // normal-speed filename
  s?: string; // optional slow-speed filename
}

let clips: Record<string, ClipEntry> = {};
let manifestLoaded = false;
let current: HTMLAudioElement | null = null;

let jaVoice: SpeechSynthesisVoice | null = null;
let warmed = false;

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/`;

// Sentence punctuation stripped before matching manifest keys (keys are bare JP).
// NOTE: keeps the katakana long-vowel mark ー (it's part of words like ラーメン).
const PUNCT = /[。、，,．.！!？?「」『』（）()【】［］〔〕…‥・〜~\s]/g;
const normalize = (text: string): string => text.replace(PUNCT, '');

// ── manifest ────────────────────────────────────────────────────────────────
/** Fetch the clip manifest once (fire-and-forget at boot). A missing/empty
 *  manifest is fine — every line then routes to Web Speech. */
export async function loadVoiceManifest(): Promise<void> {
  if (manifestLoaded) return;
  manifestLoaded = true;
  try {
    const res = await fetch(`${AUDIO_BASE}manifest.json`);
    if (!res.ok) return;
    const data = (await res.json()) as { clips?: Record<string, ClipEntry> } | Record<string, ClipEntry>;
    // Accept the documented { clips: {...} } shape, or a bare map as a fallback.
    clips = ((data as { clips?: Record<string, ClipEntry> }).clips ?? (data as Record<string, ClipEntry>)) || {};
  } catch {
    /* no audio folder yet → Web Speech only */
  }
}

// ── playback ────────────────────────────────────────────────────────────────
/** Stop any clip or utterance currently playing. Call on scene transitions. */
export function stopAudio(): void {
  if (current) {
    current.pause();
    current = null;
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/**
 * Speak a Japanese string — the entry point gameplay should call.
 * Plays the matching VOICEVOX clip if the manifest has one, else falls back to
 * device TTS. `rate < 1` requests slow playback: uses the pre-generated slow clip
 * if present, otherwise plays the normal clip at the reduced playbackRate.
 */
export function speak(text: string, opts: { rate?: number } = {}): void {
  if (!text) return;
  const rate = opts.rate ?? 1;
  // Hanasou's manifest keys keep spaces + punctuation (e.g. "わたしは トムです。"),
  // and the game passes those exact strings, so match raw first; the punctuation-
  // stripped form is a fallback for any manifest that happens to be keyed bare.
  const clip = clips[text] ?? clips[normalize(text)];
  if (clip) {
    try {
      stopAudio();
      let file = clip.n;
      let playbackRate = 1;
      if (rate < 1) {
        if (clip.s) file = clip.s; // pre-generated slow clip, played at normal rate
        else playbackRate = rate; // no slow clip → slow the normal clip down
      }
      const a = new Audio(AUDIO_BASE + file);
      a.playbackRate = playbackRate;
      current = a;
      // Autoplay/codec/missing-file issues → fall back to Web Speech, never throw.
      void a.play().catch(() => speakTTS(text, 'ja-JP', rate));
      return;
    } catch {
      /* fall through to Web Speech */
    }
  }
  speakTTS(text, 'ja-JP', rate);
}

// ── Web Speech fallback ───────────────────────────────────────────────────────
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ja')) ?? null;
}

/** Call once after a user gesture so mobile browsers unlock speech. */
export function warmUpTTS(): void {
  if (warmed || typeof speechSynthesis === 'undefined') return;
  warmed = true;
  jaVoice = pickVoice();
  if (!jaVoice) {
    speechSynthesis.onvoiceschanged = () => {
      jaVoice = pickVoice();
    };
  }
}

/** Device text-to-speech fallback for any text without a pre-generated clip. */
export function speakTTS(text: string, lang = 'ja-JP', rate = 1): void {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  try {
    if (!jaVoice) jaVoice = pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    if (jaVoice) u.voice = jaVoice;
    u.rate = Math.max(0.1, rate);
    speechSynthesis.cancel(); // avoid overlap pile-up
    speechSynthesis.speak(u);
  } catch {
    /* speech is best-effort; never throw into gameplay */
  }
}
