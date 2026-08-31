import type { StageConfig } from "./field";

// Stage data, kept out of the engine so retuning after a playtest is an edit
// to numbers rather than to rules.
//
// The numbers are not guesses. Three bots were run against every candidate
// board to find the highest stamina each could still beat: "greedy" (wall
// whatever the runner is about to step into --- the move anyone finds in ten
// seconds), "barrier" (greedy, but prefer cells that lean on an edge or on
// ground already blocked), and a one-ply search that maximises the resulting
// route. Every stage after the first sets stamina ABOVE the greedy ceiling,
// so the ten-second move provably loses, and below the search ceiling, so the
// board is provably winnable. The measured ceilings are recorded per stage.
//
// A 9x9 open field was the first thing tried and it is the one board that
// does not work: greedy beat it up to stamina 39 against the searcher's 40.
// Open ground lets the runner be sidestepped forever, so there is no reason
// to think. Narrow boards and pillars are what create the gap.
//
// Nothing here explains itself to the player. The ramp is the teaching.

export const STAGES: readonly StageConfig[] = [
  // 1. Teach the tap. Deliberately under the greedy ceiling (11), so the
  //    first move anyone tries is the move that works.
  {
    cols: 5,
    rows: 7,
    exit: { x: 2, y: 6 },
    runners: [{ entry: { x: 2, y: 0 }, stamina: 9 }],
  },

  // 2. Same board, higher bar. Ceilings 11 / 13 / 18: blocking the cell
  //    directly ahead now falls exactly two short, so the stage the player
  //    just won teaches them why it wasn't enough.
  {
    cols: 5,
    rows: 7,
    exit: { x: 2, y: 6 },
    runners: [{ entry: { x: 2, y: 0 }, stamina: 13 }],
  },

  // 3. Pillars. Ceilings 9 / 11 / 19 --- the widest gap of any small board,
  //    because a wall anchored to standing terrain closes ground that the
  //    same wall in the open does not.
  {
    cols: 7,
    rows: 7,
    exit: { x: 3, y: 6 },
    pillars: [
      { x: 0, y: 3 },
      { x: 3, y: 3 },
      { x: 6, y: 3 },
    ],
    runners: [{ entry: { x: 3, y: 0 }, stamina: 11 }],
  },

  // 4. Two runners on one set of turns. Ceilings 10 / 12 / 22: greedy adds
  //    nothing at all here, because every wall it places helps against one
  //    runner and the other simply walks.
  {
    cols: 7,
    rows: 9,
    exit: { x: 3, y: 8 },
    pillars: [
      { x: 0, y: 4 },
      { x: 1, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
    ],
    runners: [
      { entry: { x: 0, y: 0 }, stamina: 13 },
      { entry: { x: 6, y: 0 }, stamina: 13, entersOn: 4 },
    ],
  },

  // 5. Twice the pace, so half the walls. Ceilings 19 / 17 / 25 --- note the
  //    inversion: the careful barrier bot does WORSE than the reactive one
  //    here, so the habit stages 2-4 built has to be dropped again.
  {
    cols: 5,
    rows: 7,
    exit: { x: 2, y: 6 },
    runners: [{ entry: { x: 2, y: 0 }, stamina: 21, speed: 2 }],
  },
];
