import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  canPlace,
  createStage,
  legalPlacements,
  placeBlock,
  removeBlock,
  routeFor,
  shortestRun,
  solve,
  step,
  type State,
} from "../src/game/field";
import { STAGES } from "../src/game/stages";

// This week's brief: a small game with no tutorial anywhere, on screen or off
// --- the opening screen has to make the first move obvious on its own. The
// published spec (comp.anu.edu.au/.../crits/05-game/) has lines no test can
// hold --- "a stranger can pick it up and reach an ending inside five
// minutes", "obvious in ten seconds, still interesting at five" --- those are
// judged live at the crit, played cold. This file covers only what a machine
// can see in the built site: the ABSENCE of an explicit tutorial. "One rule
// has a focused automated test" is a real spec line too, but it names a test
// on your specific mechanic once you've chosen one, not something this file
// can write for you --- add it here alongside these once the game exists.
//
// The game exists now: "Detour", in src/game/. Its one rule worth holding is
// at the bottom of this file.

const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files().map((path) => relative(DIST, path).split(sep).join("/"));
const pages = shipped
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

// Wording, not just markup: a page can be tutorial-free in structure and still
// spell out the rules in a paragraph. Catches the common shapes of "telling
// instead of teaching" --- it can't catch every phrasing, so it's a floor, not
// a substitute for actually playing the thing cold.
const INSTRUCTIONAL_PATTERN = /how to play|instructions|tutorial|click here to start|use the arrow keys/i;

describe("crit 5: a game", () => {
  it("ships no separate instructions/tutorial/how-to-play page", () => {
    const instructionalPage = shipped.find((name) =>
      /instructions|tutorial|how-?to-?play|help/i.test(name),
    );
    expect(
      instructionalPage,
      `${instructionalPage} reads like a rules page --- the brief wants the opening screen to teach the first move on its own`,
    ).toBeUndefined();
  });

  for (const { name, doc } of pages) {
    it(`${name} has no on-screen instructions modal or panel`, () => {
      const instructionalElement = doc.querySelector(
        '[id*="instructions" i], [class*="instructions" i], [id*="tutorial" i], [class*="tutorial" i], [id*="how-to-play" i], [class*="how-to-play" i]',
      );
      expect(
        instructionalElement,
        `an element (${instructionalElement?.outerHTML.slice(0, 80)}) names itself as instructions --- the opening screen has to make the first move obvious without one`,
      ).toBeNull();
    });

    it(`${name} has no body text that reads as explicit rules`, () => {
      const bodyText = doc.body.textContent ?? "";
      const match = INSTRUCTIONAL_PATTERN.exec(bodyText);
      expect(
        match?.[0],
        `found "${match?.[0]}" in the page text --- that's telling the player, not letting them find out`,
      ).toBeUndefined();
    });
  }
});

// --- the game's own rule -------------------------------------------------
//
// "One rule has a focused automated test." This is that rule.
//
// A blocker may go on any open cell EXCEPT one that would leave a runner with
// no route to the exit at all. Everything else about Detour is a matter of
// taste and tuning; this one is load-bearing. Without it the player ends any
// stage by bricking up the way out, which makes every other decision
// pointless, and a bug in it produces a maze a runner can never leave and
// never be spent in --- a soft-lock that needs a specific arrangement to show
// up, so it is exactly the kind of thing that survives being checked by eye.

describe("Detour: a blocker may never cut the exit off", () => {
  // A corridor one cell wide: every cell in it is the only way through.
  const corridor = {
    map: ["o.#", ".#.", "..X"],
    blocks: 3,
    stamina: 9,
  };

  it("refuses a cell that is the last way through", () => {
    const state = createStage(corridor);
    expect(routeFor(state, state.runners[0]!.at)).not.toBeNull();
    expect(
      canPlace(state, { x: 0, y: 1 }),
      "walling the only corridor left would strand the runner forever",
    ).toBe(false);
    expect(placeBlock(state, { x: 0, y: 1 })).toBeNull();
  });

  it("refuses the exit, the maze's own walls, and a runner's start", () => {
    const state = createStage(corridor);
    expect(canPlace(state, state.exit), "the way out").toBe(false);
    expect(canPlace(state, { x: 2, y: 0 }), "a maze wall").toBe(false);
    expect(canPlace(state, { x: 0, y: 0 }), "a runner's start").toBe(false);
  });

  it("allows a blocker that still leaves a route", () => {
    const state = createStage({ map: ["o..", "...", "..X"], blocks: 2, stamina: 9 });
    expect(canPlace(state, { x: 1, y: 1 })).toBe(true);
    expect(placeBlock(state, { x: 1, y: 1 })).not.toBeNull();
  });

  for (const [index, config] of STAGES.entries()) {
    it(`stage ${index + 1} cannot be soft-locked by any run of legal taps`, () => {
      for (let seed = 0; seed < 30; seed++) {
        const random = seeded(seed * 7919 + index);
        let state: State = createStage(config);

        while (state.phase === "setup") {
          const legal = legalPlacements(state);
          expect(
            legal.length,
            `stage ${index + 1} left the player with no legal placement`,
          ).toBeGreaterThan(0);
          state = placeBlock(state, legal[Math.floor(random() * legal.length)]!)!;
          for (const runner of state.runners) {
            expect(
              routeFor(state, runner.at),
              `stage ${index + 1} stranded a runner at ${JSON.stringify(runner.at)}`,
            ).not.toBeNull();
          }
        }

        let ticks = 0;
        while (state.phase === "running") {
          state = step(state);
          expect(++ticks, `stage ${index + 1} did not end`).toBeLessThan(400);
        }
        expect(["won", "lost"]).toContain(state.phase);
      }
    });
  }
});

// --- the stages themselves -----------------------------------------------
//
// The run takes no input, so a stage is decided entirely by whether the
// blockers on offer can push every route past its stamina. That makes two
// things checkable that would otherwise only be opinions: that no stage is
// impossible, and that no stage wins itself.

describe("Detour: every stage is fair", () => {
  for (const [index, config] of STAGES.entries()) {
    it(`stage ${index + 1} can be solved with the ${config.blocks} blockers it gives you`, () => {
      const picks = solve(createStage(config));
      expect(picks, `no placement of ${config.blocks} blockers beats stage ${index + 1}`).not.toBeNull();

      // ...and the solution the search found really does win when played.
      let state: State = createStage(config);
      for (const cell of picks!) state = placeBlock(state, cell)!;
      while (state.phase === "running") state = step(state);
      expect(state.phase).toBe("won");
    });

    it(`stage ${index + 1} is lost by doing nothing useful`, () => {
      const state = createStage(config);
      expect(
        shortestRun(state),
        `stage ${index + 1} is already won before the player touches it`,
      ).toBeLessThanOrEqual(config.stamina);
    });
  }
});

describe("Detour: setup and the run", () => {
  const tiny = { map: ["o..", "...", "..X"], blocks: 2, stamina: 9 } as const;

  it("starts the run only once the last blocker is down", () => {
    let state: State = createStage(tiny);
    expect(state.phase).toBe("setup");
    state = placeBlock(state, { x: 1, y: 1 })!;
    expect(state.phase, "one blocker left, so still placing").toBe("setup");
    state = placeBlock(state, { x: 0, y: 1 })!;
    expect(state.phase, "budget spent, so the run begins").toBe("running");
  });

  it("gives a blocker back when you pick it up, and not after the run starts", () => {
    let state: State = createStage(tiny);
    state = placeBlock(state, { x: 1, y: 1 })!;
    expect(state.blocksLeft).toBe(1);
    state = removeBlock(state, { x: 1, y: 1 })!;
    expect(state.blocksLeft).toBe(2);
    expect(state.terrain[indexOfCell(state, 1, 1)]).toBe("open");

    state = placeBlock(placeBlock(state, { x: 1, y: 1 })!, { x: 0, y: 1 })!;
    expect(state.phase).toBe("running");
    expect(removeBlock(state, { x: 1, y: 1 }), "no take-backs mid-run").toBeNull();
  });

  it("spends exactly one stamina per cell crossed", () => {
    let state: State = createStage({ ...tiny, blocks: 1 });
    state = placeBlock(state, { x: 1, y: 1 })!;
    const before = state.runners[0]!.stamina;
    state = step(state);
    expect(state.runners[0]!.stamina).toBe(before - 1);
  });

  it("is lost when a runner reaches the exit and won when one is drained", () => {
    let escape: State = createStage({ map: ["o", ".", "X"], blocks: 1, stamina: 9 });
    // Nowhere legal to build in a one-wide corridor, so force the run.
    escape = { ...escape, blocksLeft: 0, phase: "running" };
    while (escape.phase === "running") escape = step(escape);
    expect(escape.phase).toBe("lost");
    expect(escape.runners[0]!.fate).toBe("escaped");

    let drain: State = createStage({ map: ["o", ".", "X"], blocks: 1, stamina: 1 });
    drain = { ...drain, blocksLeft: 0, phase: "running" };
    while (drain.phase === "running") drain = step(drain);
    expect(drain.phase).toBe("won");
    expect(drain.runners[0]!.fate).toBe("spent");
  });
});

function indexOfCell(state: State, x: number, y: number): number {
  return y * state.cols + x;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
