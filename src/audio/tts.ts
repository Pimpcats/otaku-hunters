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
type ClipMap = Record<string, ClipEntry>;

// Each character can have its own VOICEVOX voice: a clip set under
// public/audio/<voiceId>/. The shared top-level set (public/audio/) is the
// fallback for any character/line without a per-voice clip; Web Speech backs that.
let defaultClips: ClipMap = {};
const voiceClips = new Map<number, ClipMap>(); // voiceId → its clip set
const loadedVoices = new Set<number>();
let activeVoiceId: number | null = null;
let manifestLoaded = false;
let current: HTMLAudioElement | null = null;

let jaVoice: SpeechSynthesisVoice | null = null;
let warmed = false;

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/`;
const voiceBase = (id: number): string => `${AUDIO_BASE}${id}/`;

// Sentence punctuation stripped before matching manifest keys (keys are bare JP).
// NOTE: keeps the katakana long-vowel mark ー (it's part of words like ラーメン).
const PUNCT = /[。、，,．.！!？?「」『』（）()【】［］〔〕…‥・〜~\s]/g;
const normalize = (text: string): string => text.replace(PUNCT, '');

const clipsFrom = (data: unknown): ClipMap => {
  const d = data as { clips?: ClipMap } | ClipMap | null;
  return ((d as { clips?: ClipMap } | null)?.clips ?? (d as ClipMap)) || {};
};

// ── manifests ─────────────────────────────────────────────────────────────────
/** Fetch the shared top-level clip manifest once (fire-and-forget at boot). */
export async function loadVoiceManifest(): Promise<void> {
  if (manifestLoaded) return;
  manifestLoaded = true;
  try {
    const res = await fetch(`${AUDIO_BASE}manifest.json`);
    if (res.ok) defaultClips = clipsFrom(await res.json());
  } catch {
    /* no audio folder yet → shared set empty → Web Speech */
  }
}

/** Load a character's per-voice clip set (public/audio/<voiceId>/manifest.json).
 *  Idempotent + safe — a missing set just means that voice uses the shared set. */
export async function loadVoiceFor(voiceId: number): Promise<void> {
  if (loadedVoices.has(voiceId)) return;
  loadedVoices.add(voiceId);
  try {
    const res = await fetch(`${voiceBase(voiceId)}manifest.json`);
    if (res.ok) voiceClips.set(voiceId, clipsFrom(await res.json()));
  } catch {
    /* this voice falls back to the shared set */
  }
}

/** Choose which character voice speak() prefers (set when a run starts). */
export function setActiveVoice(voiceId: number | null): void {
  activeVoiceId = voiceId;
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

/** Pick the file + playbackRate for an entry at the requested rate. */
function pickFile(e: ClipEntry, rate: number): { file: string; playbackRate: number } {
  if (rate < 1) {
    if (e.s) return { file: e.s, playbackRate: 1 }; // pre-generated slow clip
    return { file: e.n, playbackRate: rate }; // none → slow the normal clip down
  }
  return { file: e.n, playbackRate: 1 };
}

/**
 * Speak a Japanese string — the entry point gameplay should call. Prefers the
 * active character's VOICEVOX voice, then the shared clip set, then device TTS.
 * `rate < 1` requests slow playback. Manifest keys keep spaces+punctuation, so we
 * match the raw string first, then the stripped form.
 */
export function speak(text: string, opts: { rate?: number } = {}): void {
  if (!text) return;
  const rate = opts.rate ?? 1;
  const sets: { map: ClipMap; base: string }[] = [];
  if (activeVoiceId !== null && voiceClips.has(activeVoiceId)) {
    sets.push({ map: voiceClips.get(activeVoiceId)!, base: voiceBase(activeVoiceId) });
  }
  sets.push({ map: defaultClips, base: AUDIO_BASE });

  for (const { map, base } of sets) {
    const e = map[text] ?? map[normalize(text)];
    if (!e) continue;
    try {
      stopAudio();
      const { file, playbackRate } = pickFile(e, rate);
      const a = new Audio(base + file);
      a.playbackRate = playbackRate;
      current = a;
      // Autoplay/codec/missing-file issues → fall back to Web Speech, never throw.
      void a.play().catch(() => speakTTS(text, 'ja-JP', rate));
      return;
    } catch {
      /* try the next set, then Web Speech */
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
