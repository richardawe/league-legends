# Script-to-Animation Pipeline (2D)

Turns a plain-text script into a rendered 30-second 2D animated MP4 using
**Remotion** for the video timeline and **Rive** for 2D character animation.

---

## Quick start

```bash
npm install
npm run render          # renders scripts/demo.txt → out/demo.mp4
npm run render -- cafe  # renders scripts/cafe.txt → out/cafe.mp4
```

Open Remotion Studio for live preview:

```bash
npm start
```

---

## Adding a character

1. Export a `.riv` file from Rive with **one state machine**.
2. Drop it into `/public/characters/<name>.riv` (all lowercase).
3. Reference it in a script by that name: `ALICE (wave): Hello.`
4. The actions in parentheses must match the **input names** in the state
   machine exactly. If an input doesn't exist in the file the engine will
   silently skip it (it won't crash, but the animation won't play).

Available state machine input types:
- **Trigger** — fires once (e.g. `wave`, `walk-in`)
- **Boolean** — set to `true` on the start frame (e.g. `talk`, `idle`)

---

## Adding a background

Drop a `1920×1080` PNG into `/public/backgrounds/<scene-name>.png`.

Reference it in a script with `[SCENE: scene-name]`.

---

## Script format

```
[SCENE: park]
ALICE (wave): Hey! Over here.
BOB (walk-in, talk): Sorry I'm late.
ALICE (talk): No worries.
[SCENE: cafe]
BOB (idle): ...
```

Rules:
- `[SCENE: x]` — sets background; persists until the next `[SCENE:]` line.
- `NAME (action1, action2): dialogue` — triggers actions at the start of this
  line and shows the dialogue as a caption.
- Character and scene names are case-insensitive (normalised to lowercase).
- Lines without the `NAME (action): dialogue` format are ignored.

---

## Timing

All timing constants live in one place: **`src/parseScript.ts`** (top of file).

| Constant | Default | Meaning |
|---|---|---|
| `CHARS_PER_SEC` | 12 | Reading speed used to estimate line duration |
| `MIN_DURATION_SEC` | 1.5 | Minimum time for any line |
| `ACTION_BEAT_SEC` | 0.3 | Extra beat added per action beyond the first |

---

## Placeholder mode

If a `.riv` file or background PNG is missing the pipeline **does not crash**.
Instead it renders:
- A gradient placeholder for the background, labelled with the missing filename.
- A dashed red box for the character, labelled with the missing `.riv` name and
  the actions that would have been triggered.

This lets you verify timing and layout before supplying real assets.

---

## Audio (TODO)

Audio is not yet wired. A commented slot is in `src/Video.tsx`:

```tsx
{/* TODO: Audio voiceover slot
<Audio src={staticFile("audio/voiceover.mp3")} /> */}
```

Drop a voiceover MP3 into `/public/audio/voiceover.mp3` and uncomment that line
to add narration.

---

## Project structure

```
scripts/
  demo.txt              ← sample script
  render.mjs            ← CLI render wrapper

src/
  parseScript.ts        ← parser + timing logic (tweak constants here)
  Video.tsx             ← Remotion composition
  RiveCharacter.tsx     ← Rive integration component
  Placeholder.tsx       ← placeholder boxes for missing assets
  Root.tsx              ← Remotion entry (loads script, wires composition)
  index.ts              ← re-exports RemotionRoot

public/
  characters/           ← .riv files go here
  backgrounds/          ← .png backgrounds go here

__tests__/
  parseScript.test.ts   ← parser unit tests

remotion.config.ts      ← Remotion settings
```
