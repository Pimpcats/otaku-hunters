// @ts-nocheck
// tools/generate-audio.ts — VOICEVOX batch audio generator (LOCAL DEV TOOL).
//
// Reads src/data/lessons.js and, for each CHARACTER VOICE (CharacterDef.voiceId),
// generates a clip for every unique sentence + word with that VOICEVOX speaker,
// writing into public/audio/<voiceId>/ with its own manifest.json. Incremental:
// only generates text not already in that voice's manifest.
//
// This is NOT a build/runtime dependency — it never runs in CI or the browser.
//
// Prereqs (your machine): a running VOICEVOX engine (default localhost:50021,
// https://voicevox.hiroshiba.jp/) and Node 18+. ffmpeg optional (→ .mp3 else .wav).
//
// Usage:
//   npm run audio                       # generate every character voice (incremental)
//   npm run audio:speakers              # browse voices + ids
//   SPEAKER_ID=29 npm run audio         # generate just one voice (into public/audio/29/)
//   GENERATE_SLOW=false npm run audio   # skip slow versions
// (If ts-node balks on ESM, `npx tsx tools/generate-audio.ts` also works.)

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../src/data/characters';

// ── config ────────────────────────────────────────────────────────────────────
const VOICEVOX_URL = process.env.VOICEVOX_URL ?? 'http://localhost:50021';
const SLOW_SPEED = Number(process.env.SLOW_SPEED ?? 0.7);
const GENERATE_SLOW = (process.env.GENERATE_SLOW ?? 'true') !== 'false';
const REQUEST_DELAY_MS = 100;
const ENV_SPEAKER = process.env.SPEAKER_ID != null ? Number(process.env.SPEAKER_ID) : null;

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── lessons → unique text strings ──────────────────────────────────────────────
async function loadLessons() {
  globalThis.window = globalThis; // lessons.js assigns window.LESSONS as a side effect
  await import(new URL('../src/data/lessons.js', import.meta.url).href);
  const lessons = globalThis.LESSONS ?? globalThis.window?.LESSONS;
  if (!Array.isArray(lessons)) throw new Error('Could not read window.LESSONS from src/data/lessons.js');
  return lessons;
}

function collectTexts(lessons) {
  const set = new Set();
  for (const lesson of lessons) {
    for (const s of lesson.sentences ?? []) {
      if (s.jp) set.add(String(s.jp).trim()); // full sentence
      for (const w of s.words ?? []) if (w.jp) set.add(String(w.jp).trim()); // individual words
    }
  }
  return [...set].filter(Boolean);
}

// ── manifest (per voice) ────────────────────────────────────────────────────────
async function loadManifest(manifestPath) {
  try {
    const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    return data.clips ? data : { clips: data ?? {} };
  } catch {
    return { clips: {} };
  }
}
const saveManifest = (m, manifestPath) => fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + '\n');

// ── VOICEVOX ────────────────────────────────────────────────────────────────────
async function listSpeakers() {
  const res = await fetch(`${VOICEVOX_URL}/speakers`);
  if (!res.ok) throw new Error(`/speakers responded ${res.status}`);
  for (const sp of await res.json()) {
    console.log(`\n${sp.name}`);
    for (const st of sp.styles) console.log(`  id ${st.id}\t${st.name}`);
  }
}

/** audio_query → (optional speed tweak) → synthesis → WAV bytes. */
async function synthesize(text, speedScale, speaker) {
  const q = await fetch(`${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`, { method: 'POST' });
  if (!q.ok) throw new Error(`audio_query ${q.status}`);
  const query = await q.json();
  if (speedScale && speedScale !== 1) query.speedScale = speedScale;
  const s = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis ${s.status}`);
  return Buffer.from(await s.arrayBuffer());
}

// ── files ────────────────────────────────────────────────────────────────────────
const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

function slug(text, idx) {
  let ascii = '';
  try {
    ascii = text.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  } catch {
    ascii = '';
  }
  return (ascii ? `${String(idx).padStart(5, '0')}_${ascii}` : String(idx).padStart(5, '0')).slice(0, 48);
}

/** Write WAV bytes as .mp3 (if ffmpeg) else .wav into outDir; returns the filename. */
async function writeClip(wav, baseName, useMp3, outDir) {
  const wavPath = path.join(outDir, `${baseName}.wav`);
  if (useMp3) {
    const mp3Name = `${baseName}.mp3`;
    await fs.writeFile(wavPath, wav);
    const r = spawnSync('ffmpeg', ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '4', path.join(outDir, mp3Name)], { stdio: 'ignore' });
    await fs.rm(wavPath, { force: true });
    if (r.status === 0) return mp3Name;
  }
  await fs.writeFile(wavPath, wav);
  return `${baseName}.wav`;
}

function engineError(e) {
  console.error(
    `\n✗ VOICEVOX engine not reachable at ${VOICEVOX_URL}.\n` +
      `  Start the VOICEVOX engine (https://voicevox.hiroshiba.jp/) and try again.` +
      (e ? `\n  (${e})` : ''),
  );
  process.exit(1);
}

/** Generate the full corpus for one voice into public/audio/<speaker>/. */
async function generateForVoice(speaker, texts, useMp3) {
  const outDir = path.join(AUDIO_DIR, String(speaker));
  const manifestPath = path.join(outDir, 'manifest.json');
  await fs.mkdir(outDir, { recursive: true });
  const manifest = await loadManifest(manifestPath);
  manifest.speaker = speaker;
  manifest.slowScale = SLOW_SPEED;
  let generated = 0;
  let existed = 0;
  let idx = Object.keys(manifest.clips).length;
  console.log(`\n▶ voice ${speaker} → public/audio/${speaker}/`);
  for (const text of texts) {
    if (manifest.clips[text]) {
      existed++;
      continue;
    }
    try {
      const base = slug(text, idx++);
      const entry = { n: await writeClip(await synthesize(text, 1, speaker), base, useMp3, outDir) };
      if (GENERATE_SLOW) {
        await sleep(REQUEST_DELAY_MS);
        entry.s = await writeClip(await synthesize(text, SLOW_SPEED, speaker), `${base}_slow`, useMp3, outDir);
      }
      manifest.clips[text] = entry;
      generated++;
      console.log(`  ✓ ${text}  →  ${entry.n}`);
      await saveManifest(manifest, manifestPath); // checkpoint
    } catch (e) {
      console.error(`  ✗ ${text}: ${e?.message ?? e}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  await saveManifest(manifest, manifestPath);
  console.log(`  voice ${speaker}: generated ${generated}, existed ${existed}, total ${texts.length}.`);
}

// ── main ──────────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--list-speakers')) {
    try {
      await listSpeakers();
    } catch (e) {
      engineError(e?.message ?? e);
    }
    return;
  }

  try {
    const ping = await fetch(`${VOICEVOX_URL}/version`);
    if (!ping.ok) throw new Error(`version ${ping.status}`);
  } catch (e) {
    engineError(e?.message ?? e);
  }

  // Voices: the SPEAKER_ID env override, else every distinct character voiceId.
  const voices =
    ENV_SPEAKER != null
      ? [ENV_SPEAKER]
      : [...new Set(CHARACTERS.map((c) => c.voiceId).filter((v) => v != null))];
  if (voices.length === 0) {
    console.error('No character voiceIds found (set SPEAKER_ID=… to generate a specific voice).');
    process.exit(1);
  }

  const texts = collectTexts(await loadLessons());
  const useMp3 = hasFfmpeg();
  if (!useMp3) console.warn('• ffmpeg not found — saving .wav (larger). Install ffmpeg for .mp3 output.');
  console.log(`• ${texts.length} unique strings · voices [${voices.join(', ')}] · slow=${GENERATE_SLOW}`);

  for (const speaker of voices) await generateForVoice(speaker, texts, useMp3);
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
