import React from "react";
import { Composition, getInputProps } from "remotion";
import { AnimationVideo, VideoProps } from "./Video";
import { FPS } from "./parseScript";

// Props are injected at render time via --props (see scripts/render.mjs).
// In Remotion Studio without props, defaults to an empty timeline.
const inputProps = getInputProps() as Partial<VideoProps>;

const timeline = inputProps.timeline ?? [];
const availableBackgrounds = inputProps.availableBackgrounds ?? [];
const availableCharacters = inputProps.availableCharacters ?? [];
const characterMap = inputProps.characterMap ?? {};

const totalFrames =
  timeline.length > 0
    ? timeline.reduce(
        (acc, e) => Math.max(acc, e.startFrame + e.durationFrames),
        FPS * 5,
      )
    : FPS * 5;

const defaultProps: VideoProps = {
  timeline,
  availableBackgrounds,
  availableCharacters,
  characterMap,
};

export function RemotionRoot() {
  return (
    <Composition
      id="AnimationVideo"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={AnimationVideo as any}
      durationInFrames={totalFrames}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
    />
  );
}
