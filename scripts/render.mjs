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

import { execSync } from "child_process";
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
try {
  ({ parseScript } = require("../dist/parseScript.js"));
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
// Write props JSON for Remotion and kick off the render
// ---------------------------------------------------------------------------

const props = {
  timeline,
  availableBackgrounds,
  availableCharacters,
  characterMap,
};
writeFileSync(propsFile, JSON.stringify(props, null, 2));

const CHROMIUM_PATH =
  process.env.REMOTION_CHROME_PATH ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

const useChrome = existsSync(CHROMIUM_PATH);

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
console.log(`Timeline: ${timeline.length} entries`);
console.log(
  `Characters: ${availableCharacters.length} available` +
    (availableCharacters.length ? ` (${availableCharacters.join(", ")})` : ""),
);
console.log(
  `Backgrounds: ${availableBackgrounds.length} available` +
    (availableBackgrounds.length ? ` (${availableBackgrounds.join(", ")})` : ""),
);
if (!useChrome) {
  console.log(
    `[NOTE] Pre-installed Chromium not found at ${CHROMIUM_PATH}; Remotion will download Chrome.`,
  );
}
console.log(`\n$ ${cmd}\n`);

execSync(cmd, { stdio: "inherit" });

console.log(`\nDone! Output: ${outFile}\n`);
