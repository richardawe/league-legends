#!/usr/bin/env node
/**
 * Render a script to MP4.
 *
 * Usage:
 *   npm run render              # renders scripts/demo.txt -> out/demo.mp4
 *   npm run render -- myScript  # renders scripts/myScript.txt -> out/myScript.mp4
 *
 * Set REMOTION_CHROME_PATH env var to override the Chromium binary path.
 */

import { execSync, execFileSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import path from "path";
import { createRequire } from "module";

// ---------------------------------------------------------------------------
// Load the pre-compiled parser (built by `npm run build:parser` via tsc).
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);

let parseScript;
let FPS = 30;
try {
  ({ parseScript, FPS } = require("../dist/parseScript.js"));
} catch {
  console.error(
    "Could not load dist/parseScript.js.\n" +
      "Run `npm run build:parser` (or `npm run render` which does it automatically).",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------

const scriptName = process.argv[2] ?? "demo";
const scriptFile = `scripts/${scriptName}.txt`;
const outDir = path.resolve("out");
const outFile = path.join(outDir, `${scriptName}.mp4`);
const propsFile = path.join(outDir, `${scriptName}.props.json`);

if (!existsSync(scriptFile)) {
  console.error(`\nError: ${scriptFile} not found.\n`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// Parse the script.
const scriptText = readFileSync(scriptFile, "utf-8");
const timeline = parseScript(scriptText);

// ---------------------------------------------------------------------------
// Load the character manifest (characters.json → artboard + stateMachine map)
// ---------------------------------------------------------------------------

const charManifestPath = path.resolve("public/characters/characters.json");
let characterMap = {};
if (existsSync(charManifestPath)) {
  try {
    characterMap = JSON.parse(readFileSync(charManifestPath, "utf-8"));
  } catch (e) {
    console.warn("[WARN] Could not parse public/characters/characters.json:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Discover available assets
// ---------------------------------------------------------------------------

function listAssets(subdir, ext) {
  const dir = path.resolve("public", subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => f.slice(0, -ext.length));
}

const availableRivFiles = listAssets("characters", ".riv");
const availableBackgrounds = listAssets("backgrounds", ".png");

// A character is "available" if it's in the manifest AND its mapped .riv file exists.
const availableCharacters = Object.entries(characterMap)
  .filter(([, cfg]) => availableRivFiles.includes(cfg.file.replace(/\.riv$/, "")))
  .map(([name]) => name);

// ---------------------------------------------------------------------------
// Warn about missing assets
// ---------------------------------------------------------------------------

const neededBackgrounds = [...new Set(timeline.map((e) => e.scene))];
const neededCharacters = [...new Set(timeline.map((e) => e.character))];

const missingBg = neededBackgrounds.filter((b) => !availableBackgrounds.includes(b));
const missingChar = neededCharacters.filter((c) => !availableCharacters.includes(c));

if (missingBg.length > 0) {
  console.warn(`\n[WARN] Missing backgrounds (will use placeholder):`);
  missingBg.forEach((b) => console.warn(`  public/backgrounds/${b}.png`));
}
if (missingChar.length > 0) {
  console.warn(`\n[WARN] Missing characters (will use placeholder):`);
  missingChar.forEach((c) => {
    const inManifest = characterMap[c];
    if (!inManifest) {
      console.warn(`  "${c}" not found in public/characters/characters.json`);
    } else {
      console.warn(
        `  "${c}" mapped to ${inManifest.file} but file not found in public/characters/`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Audio generation (espeak-ng offline TTS)
// ---------------------------------------------------------------------------

// Per-character voice assignments — espeak-ng voice variants.
const VOICE_MAP = {
  rabbit:  "en+m4",
  alice:   "en+f3",
  mentor:  "en+m3",
  alex:    "en+m2",
  sam:     "en+f4",
  casey:   "en+f2",
  host:    "en+m5",
};
const DEFAULT_VOICE = "en+m3";
const ESPEAK_SPEED  = "150"; // words per minute (slightly slower than 175 default)
const ESPEAK_PITCH  = "50";  // 0-99
const ESPEAK_GAP    = "8";   // word gap in 10 ms units
// Extra frames added after audio ends so the character doesn't vanish mid-word.
const END_PADDING_FRAMES = 12;

/** Parse WAV header to get precise duration (espeak-ng always writes standard 44-byte PCM headers). */
function getWavDurationSec(filePath) {
  const buf = readFileSync(filePath);
  // Search for the "data" sub-chunk marker (usually at byte 36 for espeak-ng output).
  for (let i = 12; i < Math.min(buf.length - 8, 512); i++) {
    if (
      buf[i]     === 0x64 && // d
      buf[i + 1] === 0x61 && // a
      buf[i + 2] === 0x74 && // t
      buf[i + 3] === 0x61    // a
    ) {
      const dataSize    = buf.readUInt32LE(i + 4);
      const sampleRate  = buf.readUInt32LE(24);
      const numChannels = buf.readUInt16LE(22);
      const bitsPerSamp = buf.readUInt16LE(34);
      return dataSize / (sampleRate * numChannels * (bitsPerSamp / 8));
    }
  }
  return 2; // fallback: 2 seconds
}

const espeakAvailable = (() => {
  try { execFileSync("espeak-ng", ["--version"], { stdio: "pipe" }); return true; }
  catch { return false; }
})();

if (!espeakAvailable) {
  console.warn("\n[WARN] espeak-ng not found — audio will be skipped.");
}

const audioPublicDir = path.resolve("public/audio");
if (espeakAvailable) mkdirSync(audioPublicDir, { recursive: true });

// Generate audio per line and rebuild timeline with exact frame counts.
let cursor = 0;
const timedTimeline = timeline.map((entry, i) => {
  if (!espeakAvailable) {
    const startFrame = cursor;
    cursor += entry.durationFrames;
    return { ...entry, startFrame };
  }

  const audioFileName  = `audio/line_${i}.wav`;
  const audioFilePath  = path.join(audioPublicDir, `line_${i}.wav`);
  const voice = VOICE_MAP[entry.character] ?? DEFAULT_VOICE;

  try {
    execFileSync("espeak-ng", [
      "-v", voice,
      "-s", ESPEAK_SPEED,
      "-p", ESPEAK_PITCH,
      "-g", ESPEAK_GAP,
      "-w", audioFilePath,
      entry.dialogue,
    ], { stdio: "pipe" });

    const durationSec    = getWavDurationSec(audioFilePath);
    const durationFrames = Math.ceil(durationSec * FPS) + END_PADDING_FRAMES;
    const startFrame     = cursor;
    cursor += durationFrames;
    return { ...entry, startFrame, durationFrames, audioFile: audioFileName };
  } catch (err) {
    console.warn(`[WARN] Audio generation failed for line ${i}:`, err.message);
    const startFrame = cursor;
    cursor += entry.durationFrames;
    return { ...entry, startFrame };
  }
});

// ---------------------------------------------------------------------------
// Write props JSON for Remotion and kick off the render
// ---------------------------------------------------------------------------

const props = {
  timeline: timedTimeline,
  availableBackgrounds,
  availableCharacters,
  characterMap,
};
writeFileSync(propsFile, JSON.stringify(props, null, 2));

const CHROMIUM_PATH =
  process.env.REMOTION_CHROME_PATH ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

const useChrome = existsSync(CHROMIUM_PATH);

const totalFrames = timedTimeline.reduce(
  (max, e) => Math.max(max, e.startFrame + e.durationFrames),
  0,
);

const cmd = [
  "npx remotion render",
  "src/index.ts",
  "AnimationVideo",
  `"${outFile}"`,
  "--codec=h264",
  `--props="${propsFile}"`,
  useChrome ? `--browser-executable="${CHROMIUM_PATH}"` : "",
]
  .filter(Boolean)
  .join(" ");

console.log(`\nRendering ${scriptFile} -> ${outFile}`);
console.log(`Timeline: ${timedTimeline.length} entries, ~${(totalFrames / FPS).toFixed(1)}s`);
console.log(
  `Characters: ${availableCharacters.length} available` +
    (availableCharacters.length ? ` (${availableCharacters.join(", ")})` : ""),
);
console.log(
  `Backgrounds: ${availableBackgrounds.length} available` +
    (availableBackgrounds.length ? ` (${availableBackgrounds.join(", ")})` : ""),
);
console.log(`Audio: ${espeakAvailable ? "espeak-ng TTS enabled" : "skipped (espeak-ng not found)"}`);
if (!useChrome) {
  console.log(
    `[NOTE] Pre-installed Chromium not found at ${CHROMIUM_PATH}; Remotion will download Chrome.`,
  );
}
console.log(`\n$ ${cmd}\n`);

execSync(cmd, { stdio: "inherit" });

console.log(`\nDone! Output: ${outFile}\n`);
