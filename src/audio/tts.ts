// Japanese audio. Prefers pre-generated VOICEVOX clips (mapped by a manifest
// shared with the Hanasou study app, copied into public/audio/), and falls back
// to device text-to-speech (Web Speech API) for any text without a clip — so the
// game always has a voice even before clips are dropped in. Nothing blocks on audio.

let jaVoice: SpeechSynthesisVoice | null = null;
let warmed = false;

// ── VOICEVOX clip manifest ──────────────────────────────────────────────────
// manifest.json maps a Japanese string → its clip file(s). We accept a few shapes
// so it stays compatible with however Hanasou's manifest is keyed:
//   "text": "file.wav"  |  "text": { normal, slow }  |  "text": { file }
type ClipEntry = string | { normal?: string; slow?: string; file?: string };
let manifest: Record<string, ClipEntry> | null = null;
let manifestLoaded = false;
let current: HTMLAudioElement | null = null;

const audioBase = `${import.meta.env.BASE_URL}audio/`;

/** Load the clip manifest once (fire-and-forget at boot). A missing/empty
 *  manifest is fine — every line then routes to Web Speech. */
export async function loadVoiceManifest(): Promise<void> {
  if (manifestLoaded) return;
  manifestLoaded = true;
  try {
    const res = await fetch(`${audioBase}manifest.json`);
    if (res.ok) manifest = (await res.json()) as Record<string, ClipEntry>;
  } catch {
    /* no manifest → Web Speech only */
  }
}

function clipFile(text: string, slow: boolean): string | null {
  const e = manifest?.[text];
  if (!e) return null;
  if (typeof e === 'string') return e;
  return (slow && e.slow) || e.normal || e.file || null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith('ja')) ?? null;
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

/**
 * Speak a Japanese string: play its VOICEVOX clip if the manifest has one,
 * otherwise fall back to device TTS. `slow` prefers the slow clip when present.
 * This is the entry point gameplay should call (word pickups, chip placement,
 * sentence assembly, prompts).
 */
export function speak(text: string, opts: { slow?: boolean } = {}): void {
  if (!text) return;
  const file = clipFile(text, !!opts.slow);
  if (file) {
    try {
      current?.pause();
      const a = new Audio(audioBase + file);
      current = a;
      // Autoplay/codec/missing-file issues → fall back to Web Speech, never throw.
      void a.play().catch(() => speakJa(text));
      return;
    } catch {
      /* fall through to Web Speech */
    }
  }
  speakJa(text);
}

/** Speak a Japanese string. Silently no-ops where speech is unavailable. */
export function speakJa(text: string): void {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  try {
    if (!jaVoice) jaVoice = pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.95;
    speechSynthesis.cancel(); // avoid overlap pile-up
    speechSynthesis.speak(u);
  } catch {
    /* speech is best-effort; never throw into gameplay */
  }
}
