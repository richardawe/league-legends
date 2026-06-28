import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { TimelineEntry, FPS } from "./parseScript";
import RiveCharacter from "./RiveCharacter";
import { BackgroundPlaceholder, CharacterPlaceholder } from "./Placeholder";

// ---------------------------------------------------------------------------
// Runtime asset checks.
// In a local Remotion project, staticFile() resolves from /public.
// We can't do async fs checks inside JSX, so we mark assets as missing via
// a prop. The caller (Root.tsx) resolves existence before rendering.
// ---------------------------------------------------------------------------

interface SceneLayerProps {
  scene: string;
  backgroundExists: boolean;
}

function BackgroundLayer({ scene, backgroundExists }: SceneLayerProps) {
  if (!backgroundExists) {
    return <BackgroundPlaceholder scene={scene} />;
  }
  return (
    <Img
      src={staticFile(`backgrounds/${scene}.png`)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

interface CaptionProps {
  character: string;
  dialogue: string;
}

function Caption({ character, dialogue }: CaptionProps) {
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
      <span
        style={{
          color: "#ffffff",
          fontSize: 22,
          fontFamily: "sans-serif",
          lineHeight: 1.4,
        }}
      >
        {dialogue}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-entry character slot.
// Characters are placed side-by-side based on their index in the scene.
// ---------------------------------------------------------------------------

const CHAR_STATE_MACHINE = "State Machine 1";

interface EntryLayerProps {
  entry: TimelineEntry;
  charIndex: number;
  characterExists: boolean;
}

function EntryLayer({ entry, charIndex, characterExists }: EntryLayerProps) {
  const leftPercent = 15 + charIndex * 35;

  return (
    <>
      {characterExists ? (
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
            rivePath={staticFile(`characters/${entry.character}.riv`)}
            stateMachine={CHAR_STATE_MACHINE}
            actions={entry.actions}
            startFrame={0} // 0 because we're already inside a <Sequence>
          />
        </div>
      ) : (
        <CharacterPlaceholder
          character={entry.character}
          actions={entry.actions}
          left={`${leftPercent}%` as unknown as number}
        />
      )}
      <Caption character={entry.character} dialogue={entry.dialogue} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Public: main composition component.
// ---------------------------------------------------------------------------

export interface VideoProps {
  timeline: TimelineEntry[];
  // Sets of asset names known to exist at render time.
  availableBackgrounds: string[];
  availableCharacters: string[];
}

export function AnimationVideo({
  timeline,
  availableBackgrounds,
  availableCharacters,
}: VideoProps) {
  // Build a running scene background that persists across dialogue lines.
  // Group lines by scene for background layering.
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

  // Track which characters appear per scene for positioning.
  const charIndexInScene = React.useMemo(() => {
    const sceneCharOrder: Record<string, string[]> = {};
    for (const entry of timeline) {
      if (!sceneCharOrder[entry.scene]) sceneCharOrder[entry.scene] = [];
      if (!sceneCharOrder[entry.scene].includes(entry.character)) {
        sceneCharOrder[entry.scene].push(entry.character);
      }
    }
    return sceneCharOrder;
  }, [timeline]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Background layers — one Sequence per scene */}
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
              charIndex={
                charIndexInScene[entry.scene]?.indexOf(entry.character) ?? 0
              }
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
