import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TimelineEntry } from "./parseScript";
import RiveCharacter from "./RiveCharacter";
import { CharacterPlaceholder } from "./Placeholder";

// ---------------------------------------------------------------------------
// Character manifest entry — mirrors public/characters/characters.json
// ---------------------------------------------------------------------------

export interface CharacterConfig {
  file: string;
  artboard?: string;
  stateMachine?: string;
}

// ---------------------------------------------------------------------------
// Duolingo-inspired color palette
// ---------------------------------------------------------------------------

const DUO_GREEN = "#58CC02";
const DUO_YELLOW = "#FFC800";
const DUO_BLUE = "#1CB0F6";
const DUO_RED = "#FF4B4B";
const DUO_ORANGE = "#FF9600";
const DUO_PURPLE = "#CE82FF";

const CHAR_DUO_COLOR: Record<string, string> = {
  rabbit:  DUO_ORANGE,
  alice:   DUO_PURPLE,
  mentor:  DUO_GREEN,
  alex:    DUO_BLUE,
  sam:     DUO_RED,
  casey:   "#2ECC71",
  host:    DUO_YELLOW,
};

function charColor(name: string): string {
  return CHAR_DUO_COLOR[name.toLowerCase()] ?? DUO_GREEN;
}

// ---------------------------------------------------------------------------
// Scene background — gradient per scene, no image dependency
// ---------------------------------------------------------------------------

const SCENE_GRADIENTS: Record<string, [string, string]> = {
  park:    ["#1A5C2E", "#2E7D32"],
  cafe:    ["#4A1840", "#7B1FA2"],
  office:  ["#0D2E54", "#1565C0"],
  default: ["#1F3A52", "#2979FF"],
};

function SceneBackground({ scene }: { scene: string }) {
  const [top, bottom] = SCENE_GRADIENTS[scene] ?? SCENE_GRADIENTS.default;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(170deg, ${top} 0%, ${bottom} 100%)`,
      }}
    >
      {/* Subtle dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.06,
          backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress HUD — top bar with owl, progress bar, XP badge
// ---------------------------------------------------------------------------

function ProgressHUD({ totalFrames }: { totalFrames: number }) {
  const frame = useCurrentFrame();
  const progress = Math.min(frame / Math.max(totalFrames, 1), 1);
  const xp = Math.floor(progress * 100);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 88,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        padding: "0 64px",
        gap: 32,
        zIndex: 100,
      }}
    >
      {/* Owl badge */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: DUO_GREEN,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          boxShadow: `0 4px 0 #3A8A00`,
          flexShrink: 0,
        }}
      >
        🦉
      </div>

      {/* Progress track */}
      <div
        style={{
          flex: 1,
          height: 22,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 11,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${DUO_GREEN} 0%, #89E219 100%)`,
            borderRadius: 11,
            boxShadow: `0 2px 8px rgba(88,204,2,0.5)`,
            transition: "width 33ms linear",
          }}
        />
      </div>

      {/* XP counter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: DUO_YELLOW,
          borderRadius: 24,
          padding: "8px 24px",
          boxShadow: "0 4px 0 #B38900",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#7A5C00",
            fontFamily: "sans-serif",
            letterSpacing: 1,
          }}
        >
          ⚡ {xp} XP
        </span>
      </div>

      {/* Hearts */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ fontSize: 26 }}>❤️</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkle burst on sequence start
// ---------------------------------------------------------------------------

const SPARKLE_POSITIONS = [
  { x: 18, y: 28 }, { x: 82, y: 22 }, { x: 50, y: 12 },
  { x: 12, y: 55 }, { x: 88, y: 50 }, { x: 35, y: 20 }, { x: 65, y: 18 },
];

function SparkleBurst() {
  const frame = useCurrentFrame();

  return (
    <>
      {SPARKLE_POSITIONS.map((pos, i) => {
        const delay = i * 2;
        const localF = Math.max(0, frame - delay);
        const opacity = interpolate(localF, [0, 3, 9, 18], [0, 1, 0.9, 0], { extrapolateRight: "clamp" });
        const scale = interpolate(localF, [0, 10], [0.4, 1.6], { extrapolateRight: "clamp" });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              opacity,
              transform: `scale(${scale})`,
              fontSize: 36,
              zIndex: 40,
              pointerEvents: "none",
            }}
          >
            {i % 2 === 0 ? "✨" : "⭐"}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dialogue card — bottom panel, Duolingo lesson card style
// ---------------------------------------------------------------------------

function DialogueCard({ character, dialogue }: { character: string; dialogue: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 18, stiffness: 280, mass: 0.6 } });
  const translateY = interpolate(progress, [0, 1], [80, 0]);
  const opacity = interpolate(progress, [0, 0.25], [0, 1], { extrapolateRight: "clamp" });

  const accent = charColor(character);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 240,
        background: "#FFFFFF",
        borderTop: "5px solid #E5E5E5",
        padding: "28px 80px 44px",
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 30,
      }}
    >
      {/* Character name badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: accent,
          borderRadius: 28,
          padding: "7px 22px 7px 10px",
          marginBottom: 18,
          boxShadow: `0 4px 0 rgba(0,0,0,0.18)`,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "white",
              fontFamily: "sans-serif",
              fontWeight: 900,
              fontSize: 18,
            }}
          >
            {character[0].toUpperCase()}
          </span>
        </div>
        <span
          style={{
            color: "white",
            fontFamily: "sans-serif",
            fontWeight: 800,
            fontSize: 19,
            textTransform: "capitalize",
            letterSpacing: 1,
          }}
        >
          {character}
        </span>
      </div>

      {/* Dialogue text */}
      <div
        style={{
          color: "#3C3C3C",
          fontFamily: "sans-serif",
          fontSize: 30,
          lineHeight: 1.45,
          fontWeight: 600,
        }}
      >
        {dialogue}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character display — large, centered, with bounce-in
// ---------------------------------------------------------------------------

const DEFAULT_STATE_MACHINE = "State Machine 1";

function CharacterDisplay({
  entry,
  characterConfig,
  characterExists,
}: {
  entry: TimelineEntry;
  characterConfig: CharacterConfig | undefined;
  characterExists: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 16, stiffness: 200, mass: 0.9 } });
  const scale = interpolate(progress, [0, 1], [0.82, 1]);
  const opacity = interpolate(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 240,
        transform: `translateX(-50%) scale(${scale})`,
        width: 420,
        height: 580,
        opacity,
        zIndex: 20,
      }}
    >
      {characterExists && characterConfig ? (
        <RiveCharacter
          rivePath={staticFile(`characters/${characterConfig.file}`)}
          artboard={characterConfig.artboard}
          stateMachine={characterConfig.stateMachine ?? DEFAULT_STATE_MACHINE}
          actions={entry.actions}
          startFrame={0}
          canvasWidth={420}
          canvasHeight={580}
        />
      ) : (
        <CharacterPlaceholder
          character={entry.character}
          actions={entry.actions}
          left={0}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene transition label
// ---------------------------------------------------------------------------

function SceneLabel({ scene }: { scene: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, 40, 55], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: "50%",
        transform: "translateX(-50%)",
        opacity,
        background: "rgba(0,0,0,0.5)",
        borderRadius: 40,
        padding: "10px 36px",
        zIndex: 50,
        backdropFilter: "blur(4px)",
      }}
    >
      <span
        style={{
          color: "white",
          fontFamily: "sans-serif",
          fontWeight: 700,
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: 3,
          opacity: 0.85,
        }}
      >
        📍 {scene}
      </span>
    </div>
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
  availableCharacters,
  characterMap,
}: VideoProps) {
  const totalFrames = React.useMemo(
    () => timeline.reduce((max, e) => Math.max(max, e.startFrame + e.durationFrames), 0),
    [timeline],
  );

  // Scene segments for background transitions
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

  return (
    <AbsoluteFill style={{ background: "#0D1B2A" }}>
      {/* Scene backgrounds */}
      {sceneSegments.map((seg, i) => (
        <Sequence
          key={`bg-${i}`}
          from={seg.from}
          durationInFrames={seg.to - seg.from}
          layout="none"
        >
          <AbsoluteFill>
            <SceneBackground scene={seg.scene} />
            {/* Show scene label only at the start of each scene */}
            {seg.from === timeline.find((e) => e.scene === seg.scene)?.startFrame && (
              <SceneLabel scene={seg.scene} />
            )}
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* Per-line layers */}
      {timeline.map((entry, i) => (
        <Sequence
          key={`line-${i}`}
          from={entry.startFrame}
          durationInFrames={entry.durationFrames}
          layout="none"
        >
          <AbsoluteFill>
            <SparkleBurst />
            <CharacterDisplay
              entry={entry}
              characterConfig={characterMap[entry.character]}
              characterExists={availableCharacters.includes(entry.character)}
            />
            <DialogueCard character={entry.character} dialogue={entry.dialogue} />
            {entry.audioFile && <Audio src={staticFile(entry.audioFile)} />}
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* Progress HUD always on top */}
      <ProgressHUD totalFrames={totalFrames} />
    </AbsoluteFill>
  );
}
