import React from "react";
import { useRive } from "@rive-app/react-canvas";
import { useCurrentFrame } from "remotion";

interface Props {
  rivePath: string;
  artboard?: string;
  stateMachine: string;
  actions: string[];
  startFrame: number;
}

function RiveCharacter({ rivePath, artboard, stateMachine, actions, startFrame }: Props) {
  const frame = useCurrentFrame();
  const { RiveComponent, rive } = useRive({
    src: rivePath,
    artboard,
    stateMachines: stateMachine,
    autoplay: true,
  });

  // Fire all named inputs at the exact start frame using the rive instance directly.
  // This avoids the hook-count problem of calling useStateMachineInput in a loop
  // and works with any number of inputs.
  React.useEffect(() => {
    if (frame !== startFrame || !rive) return;
    const smInputs = rive.stateMachineInputs(stateMachine);
    if (!smInputs) return;
    for (const actionName of actions) {
      const inp = smInputs.find((i) => i.name === actionName);
      if (!inp) continue;
      // Trigger inputs have a .fire() method; boolean inputs have .value.
      if (typeof (inp as unknown as { fire: () => void }).fire === "function") {
        (inp as unknown as { fire: () => void }).fire();
      } else {
        (inp as unknown as { value: boolean }).value = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  return <RiveComponent style={{ width: "100%", height: "100%" }} />;
}

export default RiveCharacter;
