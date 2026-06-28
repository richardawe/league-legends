import React from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import { useCurrentFrame } from "remotion";

interface Props {
  rivePath: string;
  stateMachine: string;
  actions: string[];
  startFrame: number;
}

// Inner component mounts once per character appearance.
// It fires all named trigger inputs at startFrame.
function RiveInstance({
  rivePath,
  stateMachine,
  actions,
  startFrame,
}: Props) {
  const frame = useCurrentFrame();
  const { RiveComponent, rive } = useRive({
    src: rivePath,
    stateMachines: stateMachine,
    autoplay: true,
  });

  // We grab each action input individually.
  // useStateMachineInput must be called unconditionally, so we call it for
  // a fixed-length placeholder list and map by index.
  const i0 = useStateMachineInput(rive, stateMachine, actions[0] ?? "");
  const i1 = useStateMachineInput(rive, stateMachine, actions[1] ?? "");
  const i2 = useStateMachineInput(rive, stateMachine, actions[2] ?? "");
  const inputs = [i0, i1, i2].slice(0, actions.length);

  // Fire triggers on the exact start frame.
  React.useEffect(() => {
    if (frame !== startFrame) return;
    inputs.forEach((inp) => {
      if (!inp) return;
      // Boolean inputs: set true. Trigger inputs: fire().
      if (typeof (inp as any).fire === "function") {
        (inp as any).fire();
      } else {
        inp.value = true;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  return <RiveComponent style={{ width: "100%", height: "100%" }} />;
}

export default RiveInstance;
