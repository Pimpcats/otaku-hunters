// Device text-to-speech (Web Speech API) — the only audio source for the
// vertical slice. Pre-generated clips come later; nothing blocks on audio.

let jaVoice: SpeechSynthesisVoice | null = null;
let warmed = false;

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
