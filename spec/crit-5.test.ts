import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  canPlace,
  createStage,
  indexOf,
  legalPlacements,
  routeFor,
  takeTurn,
  type Cell,
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
// A wall may go on any open cell EXCEPT one that would leave a runner with no
// route to the exit at all. Everything else about Detour is a matter of taste
// and tuning; this one is load-bearing. Without it the player ends any stage
// by bricking up the exit, which makes every other decision pointless, and a
// bug in it produces a board where a runner can never arrive and never be
// spent --- a soft-lock that needs a specific arrangement to show up, so it is
// exactly the kind of thing that survives being checked by eye.

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

describe("Detour: a wall may never cut the exit off", () => {
  // A three-wide board walled at both shoulders, so the middle cell is the
  // single remaining way through.
  function pinched(): State {
    let state = createStage({
      cols: 3,
      rows: 3,
      exit: { x: 1, y: 2 },
      runners: [{ entry: { x: 1, y: 0 }, stamina: 6 }],
    });
    for (const shoulder of [{ x: 0, y: 1 }, { x: 2, y: 1 }]) {
      const walled = takeTurnWithoutMoving(state, shoulder);
      state = walled;
    }
    return state;
  }

  // Place a wall without letting the runner move, so the board under test is
  // the one the assertion describes.
  function takeTurnWithoutMoving(state: State, cell: Cell): State {
    expect(canPlace(state, cell), `expected ${JSON.stringify(cell)} to be placeable`).toBe(true);
    const terrain = state.terrain.slice();
    terrain[indexOf(state.cols, cell)] = "wall";
    return { ...state, terrain };
  }

  it("refuses the last cell holding the route open", () => {
    const state = pinched();
    expect(routeFor(state, state.runners[0]!.at)).not.toBeNull();
    expect(
      canPlace(state, { x: 1, y: 1 }),
      "walling the only gap left would strand the runner forever",
    ).toBe(false);
  });

  it("still allows a wall that changes nothing", () => {
    expect(canPlace(pinched(), { x: 0, y: 0 })).toBe(true);
  });

  it("refuses the exit itself", () => {
    const state = pinched();
    expect(canPlace(state, state.exit)).toBe(false);
  });

  for (const [index, config] of STAGES.entries()) {
    it(`stage ${index + 1} cannot be soft-locked by any run of legal taps`, () => {
      for (let seed = 0; seed < 40; seed++) {
        const random = seeded(seed * 7919 + index);
        let state = createStage(config);
        let turns = 0;

        while (state.status === "playing") {
          const legal = legalPlacements(state);
          expect(
            legal.length,
            `stage ${index + 1} left the player with no legal tap on turn ${state.turn}`,
          ).toBeGreaterThan(0);

          const next = takeTurn(state, legal[Math.floor(random() * legal.length)]!);
          expect(next, "a placement reported legal was then refused").not.toBeNull();
          state = next!;

          for (const runner of state.runners) {
            if (runner.fate !== null) continue;
            expect(
              routeFor(state, runner.at),
              `stage ${index + 1} stranded a runner at ${JSON.stringify(runner.at)}`,
            ).not.toBeNull();
          }

          turns++;
          expect(turns, `stage ${index + 1} did not end`).toBeLessThan(400);
        }

        expect(["won", "lost"]).toContain(state.status);
      }
    });
  }
});

describe("Detour: the rest of the mechanic", () => {
  const tiny = {
    cols: 3,
    rows: 3,
    exit: { x: 1, y: 2 },
    runners: [{ entry: { x: 1, y: 0 }, stamina: 5 }],
  } as const;

  it("spends exactly one stamina per cell crossed", () => {
    const state = takeTurn(createStage(tiny), { x: 0, y: 0 });
    expect(state).not.toBeNull();
    expect(state!.runners[0]!.stamina).toBe(4);
    expect(state!.runners[0]!.at).toEqual({ x: 1, y: 1 });
  });

  it("loses when the runner reaches the exit", () => {
    let state = createStage(tiny);
    state = takeTurn(state, { x: 0, y: 0 })!;
    state = takeTurn(state, { x: 2, y: 0 })!;
    expect(state.runners[0]!.fate).toBe("escaped");
    expect(state.status).toBe("lost");
  });

  it("wins when the runner is spent short of the exit", () => {
    const state = takeTurn(
      createStage({ ...tiny, runners: [{ entry: { x: 1, y: 0 }, stamina: 1 }] }),
      { x: 0, y: 0 },
    );
    expect(state!.runners[0]!.fate).toBe("spent");
    expect(state!.status).toBe("won");
  });

  it("will not build on ground the runner has already crossed", () => {
    const state = takeTurn(createStage(tiny), { x: 0, y: 0 })!;
    // The runner started here and has moved on; the trail stays unbuildable.
    expect(state.terrain[indexOf(state.cols, { x: 1, y: 0 })]).toBe("trampled");
    expect(canPlace(state, { x: 1, y: 0 })).toBe(false);
  });

  it("keeps a second runner off the board until its turn comes", () => {
    const config = {
      cols: 5,
      rows: 5,
      exit: { x: 2, y: 4 },
      runners: [
        { entry: { x: 0, y: 0 }, stamina: 9 },
        { entry: { x: 4, y: 0 }, stamina: 9, entersOn: 3 },
      ],
    };
    let state = createStage(config);
    state = takeTurn(state, { x: 2, y: 2 })!;
    expect(state.runners[1]!.at, "the late runner should not have moved yet").toEqual({
      x: 4,
      y: 0,
    });
    expect(state.runners[0]!.stamina).toBe(8);
  });
});
