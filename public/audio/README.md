# Otaku Hunter — audio library (our own, VOICEVOX-generated)

This folder **is** the game's voice library. It's ours: generated from *our*
`src/data/lessons.js` by `tools/generate-audio.ts`, written here, and **committed**
so the deployed game (GitHub Pages) has voice with no runtime dependency. It does
not depend on any other app's audio.

- `manifest.json` — the lookup the game reads at runtime:
  `{ "clips": { "<japanese text>": { "n": "file.mp3", "s": "file_slow.mp3"? } } }`
  (`n` = normal speed, `s` = optional slow). Ships as `{ "clips": {} }` until you
  generate.
- `*.mp3` (or `*.wav` if ffmpeg isn't installed) — the clips themselves.

At runtime `src/audio/tts.ts` plays the matching clip for word pickups, chip
placement, particle selection, and full-sentence solves, and falls back to the
device Web Speech API for any line without a clip — so the game always has a voice,
even before this library is generated.

## Generate / regenerate (on your machine)

Audio can't be synthesized in the cloud sandbox — run this locally.

1. **Install + start the VOICEVOX engine** (free, open-source):
   <https://voicevox.hiroshiba.jp/>. It serves a local API at
   `http://localhost:50021`.
2. *(Optional, for `.mp3`)* install **ffmpeg** — without it the script saves `.wav`.
3. **Pick a voice** and note its id:
   ```bash
   npm run audio:speakers
   ```
4. **Generate** (incremental — only makes clips not already in the manifest):
   ```bash
   npm run audio                 # default speaker
   SPEAKER_ID=8 npm run audio    # a specific voice
   ```
5. **Commit** the new `*.mp3` + updated `manifest.json`.

Re-run `npm run audio` any time you add sentences to `lessons.js` — it only
generates the new strings. Tunables (speaker, slow speed, slow on/off) are env
vars / consts at the top of `tools/generate-audio.ts`.

## Credit (required)

VOICEVOX is LGPL and **each voice character has its own usage terms** — you must
credit the specific character used. Once you've chosen a `SPEAKER_ID`, put the
character name in `CREDITS.md` (the `## Audio` section has a `TBD` placeholder).
