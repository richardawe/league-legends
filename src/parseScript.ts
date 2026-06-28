export interface TimelineEntry {
  scene: string;
  character: string;
  actions: string[];
  dialogue: string;
  startFrame: number;
  durationFrames: number;
  audioFile?: string;
}

// --- Timing constants (tweak here only) ---
const FPS = 30;
const CHARS_PER_SEC = 12;
const MIN_DURATION_SEC = 1.5;
const ACTION_BEAT_SEC = 0.3; // extra beat per action beyond the first

// ---------------------------------------------------------------------------

function estimateDuration(dialogue: string, actions: string[]): number {
  const speakSec = Math.max(
    dialogue.length / CHARS_PER_SEC,
    MIN_DURATION_SEC,
  );
  const actionBeat = Math.max(0, actions.length - 1) * ACTION_BEAT_SEC;
  return speakSec + actionBeat;
}

const SCENE_RE = /^\[SCENE:\s*(.+?)\s*\]$/i;
const LINE_RE = /^([A-Z][A-Z0-9 _-]*?)\s*\(([^)]+)\)\s*:\s*(.*)$/i;

export function parseScript(text: string): TimelineEntry[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const timeline: TimelineEntry[] = [];
  let currentScene = "default";
  let cursor = 0; // current frame offset

  for (const line of lines) {
    const sceneMatch = SCENE_RE.exec(line);
    if (sceneMatch) {
      currentScene = sceneMatch[1].toLowerCase();
      continue;
    }

    const lineMatch = LINE_RE.exec(line);
    if (!lineMatch) continue;

    const character = lineMatch[1].trim().toLowerCase();
    const actions = lineMatch[2]
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    const dialogue = lineMatch[3].trim();

    const durationSec = estimateDuration(dialogue, actions);
    const durationFrames = Math.round(durationSec * FPS);

    timeline.push({
      scene: currentScene,
      character,
      actions,
      dialogue,
      startFrame: cursor,
      durationFrames,
    });

    cursor += durationFrames;
  }

  return timeline;
}

export { FPS };
