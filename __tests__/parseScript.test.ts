import { parseScript, TimelineEntry } from "../src/parseScript";

const DEMO_SCRIPT = `
[SCENE: park]
ALICE (wave): Hey! Over here, I saved us a spot.
BOB (walk-in, talk): Sorry I'm late, the traffic was terrible.
ALICE (talk): No worries at all, I just got here myself.
[SCENE: cafe]
BOB (idle): This place looks cozy.
ALICE (talk): I come here every weekend.
BOB (talk): We should make it a regular thing.
`.trim();

describe("parseScript", () => {
  let timeline: TimelineEntry[];

  beforeAll(() => {
    timeline = parseScript(DEMO_SCRIPT);
  });

  it("returns the correct number of entries", () => {
    expect(timeline).toHaveLength(6);
  });

  it("assigns the first scene correctly", () => {
    expect(timeline[0].scene).toBe("park");
    expect(timeline[1].scene).toBe("park");
    expect(timeline[2].scene).toBe("park");
  });

  it("switches scene after [SCENE: cafe]", () => {
    expect(timeline[3].scene).toBe("cafe");
    expect(timeline[4].scene).toBe("cafe");
    expect(timeline[5].scene).toBe("cafe");
  });

  it("lowercases character names", () => {
    expect(timeline[0].character).toBe("alice");
    expect(timeline[1].character).toBe("bob");
  });

  it("parses single action", () => {
    expect(timeline[0].actions).toEqual(["wave"]);
  });

  it("parses multiple actions", () => {
    expect(timeline[1].actions).toEqual(["walk-in", "talk"]);
  });

  it("captures dialogue text", () => {
    expect(timeline[0].dialogue).toBe("Hey! Over here, I saved us a spot.");
  });

  it("first entry starts at frame 0", () => {
    expect(timeline[0].startFrame).toBe(0);
  });

  it("entries are laid out sequentially (no gaps)", () => {
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].startFrame).toBe(
        timeline[i - 1].startFrame + timeline[i - 1].durationFrames,
      );
    }
  });

  it("duration is at least min duration (1.5s = 45 frames at 30fps)", () => {
    for (const entry of timeline) {
      expect(entry.durationFrames).toBeGreaterThanOrEqual(45);
    }
  });

  it("longer dialogue gets more frames than shorter dialogue", () => {
    // "Sorry I'm late, the traffic was terrible." (41 chars, 2 actions)
    // vs "This place looks cozy." (22 chars, 1 action)
    const bob1 = timeline[1]; // long line
    const bob2 = timeline[3]; // short line
    expect(bob1.durationFrames).toBeGreaterThan(bob2.durationFrames);
  });

  it("total duration equals sum of all durationFrames", () => {
    const total = timeline.reduce((acc, e) => acc + e.durationFrames, 0);
    const lastEntry = timeline[timeline.length - 1];
    expect(lastEntry.startFrame + lastEntry.durationFrames).toBe(total);
  });
});

describe("parseScript edge cases", () => {
  it("returns empty array for empty script", () => {
    expect(parseScript("")).toEqual([]);
  });

  it("ignores lines without action syntax", () => {
    const t = parseScript("[SCENE: test]\nThis is not a valid line.\nALICE (idle): Hello.");
    expect(t).toHaveLength(1);
    expect(t[0].dialogue).toBe("Hello.");
  });

  it("defaults to 'default' scene when no SCENE header", () => {
    const t = parseScript("ALICE (idle): Hello.");
    expect(t[0].scene).toBe("default");
  });
});
