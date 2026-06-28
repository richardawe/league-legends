import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
} from "remotion";
import { TimelineEntry, FPS } from "./parseScript";
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
// Caption overlay
// ---------------------------------------------------------------------------

function Caption({ character, dialogue }: { character: string; dialogue: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: "10%",
        width: "80%",
        background: "rgba(0,0,0,0.72)",
        borderRadius: 10,
        padding: "14px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          color: "#ffdd88",
          fontSize: 18,
          fontFamily: "sans-serif",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {character}
      </span>
      <span style={{ color: "#ffffff", fontSize: 22, fontFamily: "sans-serif", lineHeight: 1.4 }}>
        {dialogue}
      </span>
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
            startFrame={0} // 0 = relative to this <Sequence>
          />
        </div>
      ) : (
        <CharacterPlaceholder
          character={entry.character}
          actions={entry.actions}
          left={leftPercent * (1920 / 100)}
        />
      )}
      <Caption character={entry.character} dialogue={entry.dialogue} />
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
  // Collapse consecutive lines in the same scene into background segments.
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

  // Track first-appearance order of characters per scene for positioning.
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

      {/* Dialogue + character layers */}
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

      {/* TODO: Audio voiceover slot
      <Audio src={staticFile("audio/voiceover.mp3")} /> */}
    </AbsoluteFill>
  );
}
