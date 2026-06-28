import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TimelineEntry } from "./parseScript";
import RiveCharacter from "./RiveCharacter";
import { BackgroundPlaceholder, CharacterPlaceholder } from "./Placeholder";

// ---------------------------------------------------------------------------
// Character manifest entry — mirrors public/characters/characters.json
// ---------------------------------------------------------------------------

export interface CharacterConfig {
  file: string;
  artboard?: string;
  stateMachine?: string;
}

// ---------------------------------------------------------------------------
// Per-character name colour (used in speech bubble header)
// ---------------------------------------------------------------------------

const CHAR_COLOR: Record<string, string> = {
  rabbit:  "#e65c00",
  alice:   "#6200ea",
  mentor:  "#00695c",
  alex:    "#1565c0",
  sam:     "#c62828",
  casey:   "#2e7d32",
  host:    "#4527a0",
};
function charColor(name: string): string {
  return CHAR_COLOR[name.toLowerCase()] ?? "#1a1a2e";
}

// ---------------------------------------------------------------------------
// Background layer
// ---------------------------------------------------------------------------

function BackgroundLayer({
  scene,
  backgroundExists,
}: {
  scene: string;
  backgroundExists: boolean;
}) {
  if (!backgroundExists) return <BackgroundPlaceholder scene={scene} />;
  return (
    <Img
      src={staticFile(`backgrounds/${scene}.png`)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Speech bubble (replaces the old bottom caption)
// ---------------------------------------------------------------------------

function SpeechBubble({
  character,
  dialogue,
  leftPercent,
}: {
  character: string;
  dialogue: string;
  leftPercent: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pop-in spring animation
  const progress = spring({ frame, fps, config: { damping: 14, stiffness: 220, mass: 0.8 } });
  const scale = interpolate(progress, [0, 1], [0.82, 1]);
  const opacity = interpolate(progress, [0, 0.25], [0, 1], { extrapolateRight: "clamp" });

  // Center bubble on the character (character left edge + half its 200px width)
  const charCenterX = (leftPercent / 100) * 1920 + 100;
  const bubbleWidth = 370;
  // Clamp so bubble stays within the composition
  const bubbleLeft = Math.max(16, Math.min(1920 - bubbleWidth - 16, charCenterX - bubbleWidth / 2));
  const tailOffset = Math.max(24, Math.min(bubbleWidth - 48, charCenterX - bubbleLeft - 16));

  const accent = charColor(character);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 548,
        left: bubbleLeft,
        width: bubbleWidth,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "bottom center",
        zIndex: 20,
      }}
    >
      {/* Bubble body */}
      <div
        style={{
          background: "#FFFEF9",
          borderRadius: 20,
          border: `3px solid #1E1B4B`,
          padding: "14px 18px 16px",
          boxShadow: "5px 7px 0 #1E1B4B",
          position: "relative",
        }}
      >
        {/* Character name strip */}
        <div
          style={{
            color: accent,
            fontFamily: "sans-serif",
            fontWeight: 900,
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 8,
            borderBottom: `2px solid ${accent}`,
            paddingBottom: 6,
          }}
        >
          {character}
        </div>
        {/* Dialogue text */}
        <div
          style={{
            color: "#1E1B4B",
            fontFamily: "sans-serif",
            fontSize: 19,
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          {dialogue}
        </div>

        {/* Tail — outer (border colour) */}
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: tailOffset,
            width: 0,
            height: 0,
            borderLeft: "16px solid transparent",
            borderRight: "16px solid transparent",
            borderTop: "30px solid #1E1B4B",
          }}
        />
        {/* Tail — inner (fill colour) */}
        <div
          style={{
            position: "absolute",
            bottom: -24,
            left: tailOffset + 4,
            width: 0,
            height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: "24px solid #FFFEF9",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-entry character slot
// ---------------------------------------------------------------------------

const DEFAULT_STATE_MACHINE = "State Machine 1";

function EntryLayer({
  entry,
  charIndex,
  characterConfig,
  characterExists,
}: {
  entry: TimelineEntry;
  charIndex: number;
  characterConfig: CharacterConfig | undefined;
  characterExists: boolean;
}) {
  const leftPercent = 15 + charIndex * 35;

  return (
    <>
      {/* Rive character OR placeholder */}
      {characterExists && characterConfig ? (
        <div
          style={{
            position: "absolute",
            bottom: 140,
            left: `${leftPercent}%`,
            width: 200,
            height: 380,
          }}
        >
          <RiveCharacter
            rivePath={staticFile(`characters/${characterConfig.file}`)}
            artboard={characterConfig.artboard}
            stateMachine={characterConfig.stateMachine ?? DEFAULT_STATE_MACHINE}
            actions={entry.actions}
            startFrame={0}
          />
        </div>
      ) : (
        <CharacterPlaceholder
          character={entry.character}
          actions={entry.actions}
          left={leftPercent * (1920 / 100)}
        />
      )}

      {/* Speech bubble */}
      <SpeechBubble
        character={entry.character}
        dialogue={entry.dialogue}
        leftPercent={leftPercent}
      />

      {/* Audio voiceover for this line */}
      {entry.audioFile && (
        <Audio src={staticFile(entry.audioFile)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Public: main composition component
// ---------------------------------------------------------------------------

export interface VideoProps {
  timeline: TimelineEntry[];
  availableBackgrounds: string[];
  availableCharacters: string[];
  characterMap: Record<string, CharacterConfig>;
}

export function AnimationVideo({
  timeline,
  availableBackgrounds,
  availableCharacters,
  characterMap,
}: VideoProps) {
  // Collapse consecutive same-scene lines into background segments.
  const sceneSegments = React.useMemo(() => {
    type Seg = { scene: string; from: number; to: number };
    const segs: Seg[] = [];
    for (const entry of timeline) {
      const end = entry.startFrame + entry.durationFrames;
      if (segs.length === 0 || segs[segs.length - 1].scene !== entry.scene) {
        segs.push({ scene: entry.scene, from: entry.startFrame, to: end });
      } else {
        segs[segs.length - 1].to = end;
      }
    }
    return segs;
  }, [timeline]);

  // First-appearance order of characters per scene (for horizontal positioning).
  const charIndexInScene = React.useMemo(() => {
    const order: Record<string, string[]> = {};
    for (const entry of timeline) {
      if (!order[entry.scene]) order[entry.scene] = [];
      if (!order[entry.scene].includes(entry.character)) {
        order[entry.scene].push(entry.character);
      }
    }
    return order;
  }, [timeline]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Background layers */}
      {sceneSegments.map((seg, i) => (
        <Sequence
          key={`bg-${i}`}
          from={seg.from}
          durationInFrames={seg.to - seg.from}
          layout="none"
        >
          <AbsoluteFill>
            <BackgroundLayer
              scene={seg.scene}
              backgroundExists={availableBackgrounds.includes(seg.scene)}
            />
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* Dialogue + character + speech bubble + audio layers */}
      {timeline.map((entry, i) => (
        <Sequence
          key={`line-${i}`}
          from={entry.startFrame}
          durationInFrames={entry.durationFrames}
          layout="none"
        >
          <AbsoluteFill>
            <EntryLayer
              entry={entry}
              charIndex={charIndexInScene[entry.scene]?.indexOf(entry.character) ?? 0}
              characterConfig={characterMap[entry.character]}
              characterExists={availableCharacters.includes(entry.character)}
            />
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
