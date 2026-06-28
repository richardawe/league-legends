import React, { useEffect, useRef, useState } from "react";
import canvasAdvanced from "@rive-app/canvas-advanced";
import { useCurrentFrame, useVideoConfig, useDelayRender, staticFile } from "remotion";

// ---------------------------------------------------------------------------
// Singleton WASM loader — one instance shared across all mounted characters.
// The WASM is served from /public/rive.wasm via Remotion's dev server.
// ---------------------------------------------------------------------------

let riveWasm: unknown = null;
let riveWasmLoadPromise: Promise<unknown> | null = null;

function getRive(): Promise<unknown> {
  if (riveWasm) return Promise.resolve(riveWasm);
  if (!riveWasmLoadPromise) {
    riveWasmLoadPromise = (canvasAdvanced as (opts: object) => Promise<unknown>)({
      locateFile: (_: string) => staticFile("rive.wasm"),
    }).then((r) => {
      riveWasm = r;
      return r;
    });
  }
  return riveWasmLoadPromise;
}

// ---------------------------------------------------------------------------

interface Props {
  rivePath: string;
  artboard?: string;
  stateMachine: string;
  actions: string[];
  startFrame: number;
}

interface RiveState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rive: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artboard: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  smInstance: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer: any;
}

function RiveCharacter({
  rivePath,
  artboard: artboardName,
  stateMachine: smName,
  actions,
  startFrame,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { delayRender, continueRender } = useDelayRender();
  const [loadHandle] = useState(() => delayRender(`Rive load: ${rivePath}`));
  const stateRef = useRef<RiveState | null>(null);
  const lastFrameRef = useRef(0);
  const actionsAppliedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Load WASM + .riv file on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rive = await getRive() as {
          load: (b: Uint8Array) => Promise<unknown>;
          makeRenderer: (c: HTMLCanvasElement) => unknown;
          StateMachineInstance: new (sm: unknown, ab: unknown) => unknown;
          Fit: { contain: unknown };
          Alignment: { center: unknown };
          resolveAnimationFrame: () => void;
        };

        const resp = await fetch(rivePath);
        const buf = await resp.arrayBuffer();
        const file = await rive.load(new Uint8Array(buf)) as {
          artboardByName: (n: string) => unknown;
          defaultArtboard: () => unknown;
        };

        if (cancelled) return;

        const ab = artboardName
          ? file.artboardByName(artboardName)
          : file.defaultArtboard();

        const smDef = (ab as { stateMachineByName: (n: string) => unknown }).stateMachineByName(smName);
        const smInstance = new rive.StateMachineInstance(smDef, ab);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const renderer = rive.makeRenderer(canvas);
        stateRef.current = { rive, artboard: ab, smInstance, renderer };
        setReady(true);
        continueRender(loadHandle);
      } catch (err) {
        if (!cancelled) {
          console.error("RiveCharacter load error:", err);
          continueRender(loadHandle); // unblock render even on failure
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance and draw on every Remotion frame.
  useEffect(() => {
    if (!ready || !stateRef.current) return;
    const { rive, artboard, smInstance, renderer } = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const diff = frame - lastFrameRef.current;
    lastFrameRef.current = frame;

    // Fire state machine inputs once, at startFrame.
    if (frame >= startFrame && !actionsAppliedRef.current) {
      actionsAppliedRef.current = true;
      const count: number = smInstance.inputCount();
      for (let i = 0; i < count; i++) {
        const inp = smInstance.input(i);
        if (actions.includes(inp.name as string)) {
          if (inp.type === rive.SMIInput?.trigger) {
            inp.asTrigger().fire();
          } else if (inp.type === rive.SMIInput?.bool) {
            inp.asBoolean().value = true;
          } else if (inp.type === rive.SMIInput?.number) {
            inp.asNumber().value = 1;
          }
        }
      }
    }

    // Advance state machine then artboard.
    smInstance.advance(diff / fps);
    artboard.advance(diff / fps);

    // Draw.
    renderer.clear();
    renderer.save();
    renderer.align(
      rive.Fit.contain,
      rive.Alignment.center,
      { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height },
      artboard.bounds,
    );
    artboard.draw(renderer);
    renderer.restore();
    rive.resolveAnimationFrame();
  }, [frame, ready, fps, actions, startFrame]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={380}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export default RiveCharacter;
