// @ts-nocheck
// tools/generate-audio.ts — VOICEVOX batch audio generator (LOCAL DEV TOOL).
//
// Reads src/data/lessons.js, generates a clip for every unique sentence and word
// via a LOCAL VOICEVOX engine, writes the files into public/audio/, and updates
// public/audio/manifest.json. Incremental: only generates text not already in the
// manifest, so re-run it after adding content and it does just the new lines.
//
// This is NOT a build or runtime dependency — it never runs in CI or the browser.
//
// Prereqs (on your machine): a running VOICEVOX engine (default localhost:50021,
// from https://voicevox.hiroshiba.jp/) and Node 18+. ffmpeg is optional (used to
// emit .mp3; without it the script saves .wav and notes so).
//
// Usage (npm scripts wrap these with tsx so no global ts-node is needed):
//   npm run audio                       # generate (incremental)
//   npm run audio:speakers              # browse voices + ids
//   SPEAKER_ID=8 npm run audio          # pick a voice
//   GENERATE_SLOW=false npm run audio   # skip slow versions
// Or directly: `npx tsx tools/generate-audio.ts` / `npx ts-node tools/generate-audio.ts`.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── config (tunable; env overrides) ───────────────────────────────────────────
const VOICEVOX_URL = process.env.VOICEVOX_URL ?? 'http://localhost:50021';
const SPEAKER_ID = Number(process.env.SPEAKER_ID ?? 3); // default Zundamon (normal); see --list-speakers
const SLOW_SPEED = Number(process.env.SLOW_SPEED ?? 0.7); // speedScale for slow versions
const GENERATE_SLOW = (process.env.GENERATE_SLOW ?? 'true') !== 'false';
const REQUEST_DELAY_MS = 100; // be gentle on the local engine

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── lessons → unique text strings ──────────────────────────────────────────────
async function loadLessons() {
  // lessons.js assigns window.LEVELS / window.LESSONS as a side effect.
  globalThis.window = globalThis;
  await import(new URL('../src/data/lessons.js', import.meta.url).href);
  const lessons = globalThis.LESSONS ?? globalThis.window?.LESSONS;
  if (!Array.isArray(lessons)) throw new Error('Could not read window.LESSONS from src/data/lessons.js');
  return lessons;
}

function collectTexts(lessons) {
  const set = new Set();
  for (const lesson of lessons) {
    for (const s of lesson.sentences ?? []) {
      if (s.jp) set.add(String(s.jp).trim()); // full sentence (solve reward)
      for (const w of s.words ?? []) if (w.jp) set.add(String(w.jp).trim()); // individual words (pickups/chips)
    }
  }
  return [...set].filter(Boolean);
}

// ── manifest ───────────────────────────────────────────────────────────────────
async function loadManifest() {
  try {
    const data = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
    return data.clips ? data : { clips: data ?? {} };
  } catch {
    return { clips: {} };
  }
}

const saveManifest = (m) => fs.writeFile(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n');

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
async function synthesize(text, speedScale) {
  const q = await fetch(`${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`, { method: 'POST' });
  if (!q.ok) throw new Error(`audio_query ${q.status}`);
  const query = await q.json();
  if (speedScale && speedScale !== 1) query.speedScale = speedScale;
  const s = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${SPEAKER_ID}`, {
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
  const n = String(idx).padStart(5, '0');
  return (ascii ? `${n}_${ascii}` : n).slice(0, 48);
}

/** Write WAV bytes as .mp3 (if ffmpeg) else .wav; returns the manifest filename. */
async function writeClip(wav, baseName, useMp3) {
  const wavPath = path.join(AUDIO_DIR, `${baseName}.wav`);
  if (useMp3) {
    const mp3Name = `${baseName}.mp3`;
    await fs.writeFile(wavPath, wav);
    const r = spawnSync('ffmpeg', ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '4', path.join(AUDIO_DIR, mp3Name)], { stdio: 'ignore' });
    await fs.rm(wavPath, { force: true });
    if (r.status === 0) return mp3Name;
  }
  await fs.writeFile(wavPath, wav); // mp3 unavailable or conversion failed
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

  // Engine reachable?
  try {
    const ping = await fetch(`${VOICEVOX_URL}/version`);
    if (!ping.ok) throw new Error(`version ${ping.status}`);
  } catch (e) {
    engineError(e?.message ?? e);
  }

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const manifest = await loadManifest();
  const texts = collectTexts(await loadLessons());
  const useMp3 = hasFfmpeg();
  if (!useMp3) console.warn('• ffmpeg not found — saving .wav (larger). Install ffmpeg for .mp3 output.');
  console.log(`• ${texts.length} unique strings · speaker ${SPEAKER_ID} · slow=${GENERATE_SLOW}\n`);

  let generated = 0;
  let existed = 0;
  let idx = Object.keys(manifest.clips).length;
  for (const text of texts) {
    if (manifest.clips[text]) {
      existed++;
      continue;
    }
    try {
      const base = slug(text, idx++);
      const entry = { n: await writeClip(await synthesize(text, 1), base, useMp3) };
      if (GENERATE_SLOW) {
        await sleep(REQUEST_DELAY_MS);
        entry.s = await writeClip(await synthesize(text, SLOW_SPEED), `${base}_slow`, useMp3);
      }
      manifest.clips[text] = entry;
      generated++;
      console.log(`  ✓ ${text}  →  ${entry.n}`);
      await saveManifest(manifest); // checkpoint after each so a crash never loses work
    } catch (e) {
      console.error(`  ✗ ${text}: ${e?.message ?? e}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  await saveManifest(manifest);
  console.log(`\nGenerated ${generated} new clips, ${existed} already existed, ${texts.length} total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
