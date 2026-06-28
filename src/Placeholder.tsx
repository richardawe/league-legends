import React from "react";

interface BackgroundPlaceholderProps {
  scene: string;
}

export function BackgroundPlaceholder({ scene }: BackgroundPlaceholderProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(160deg, #1a2a4a 0%, #2d5a3d 100%)",
        display: "flex",
        alignItems: "flex-end",
        paddingBottom: 20,
        paddingLeft: 24,
      }}
    >
      <span
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: 18,
          fontFamily: "monospace",
        }}
      >
        [MISSING BACKGROUND: /public/backgrounds/{scene}.png]
      </span>
    </div>
  );
}

interface CharacterPlaceholderProps {
  character: string;
  actions: string[];
  left: number | string;
}

export function CharacterPlaceholder({
  character,
  actions,
  left,
}: CharacterPlaceholderProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 160,
        left,
        width: 180,
        height: 320,
        background: "rgba(255,100,100,0.15)",
        border: "2px dashed rgba(255,100,100,0.6)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 12,
        textAlign: "center",
      }}
    >
      <span style={{ color: "#ff9999", fontSize: 13, fontFamily: "monospace" }}>
        MISSING
      </span>
      <span
        style={{
          color: "#ffffff",
          fontSize: 16,
          fontFamily: "monospace",
          fontWeight: "bold",
        }}
      >
        {character}.riv
      </span>
      <span
        style={{
          color: "#ffcc88",
          fontSize: 11,
          fontFamily: "monospace",
        }}
      >
        [{actions.join(", ")}]
      </span>
    </div>
  );
}
