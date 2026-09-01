import type { StageConfig } from "./field";

// Stage data, kept out of the engine so retuning after a playtest is an edit
// to numbers rather than to rules.
//
// `#` wall, `.` open, `o` where a runner starts, `X` the way out.
//
// Every stage is built so a perfect placement of its blockers forces the
// runner's shortest surviving route to exactly `stamina + 1` steps: the
// tightest possible margin, one step short of the exit, rather than a route
// that merely clears stamina by a comfortable padding. Each map is its own
// shape --- none reuses another stage's maze --- and preexisting walls mix
// long contiguous segments with isolated single-cell pillars.

export const STAGES: readonly StageConfig[] = [
  // 1. Comb Ladder. Two teeth almost span the width, so the far-side gap is
  //    the only detour --- sealing the open lane with both blockers is the
  //    whole lesson.
  {
    map: [
      "o.......",
      ".######.",
      "........",
      ".######.",
      "........",
      ".......X",
    ],
    blocks: 2,
    stamina: 25,
  },

  // 2. Comb Gate. Three teeth with staggered gaps: closing the lane now
  //    takes real sequencing, since an early blocker in the wrong gap wastes
  //    the budget stage 1 didn't need to spend carefully.
  {
    map: [
      "o........",
      ".#######.",
      ".........",
      ".###.####",
      ".........",
      ".#####...",
      "........X",
    ],
    blocks: 3,
    stamina: 31,
  },

  // 3. Comb Vault. Four teeth, one of them just a single isolated pillar,
  //    over a taller board --- the longest walk in the set.
  {
    map: [
      "o.........",
      ".########.",
      "......#...",
      ".#####....",
      "..........",
      ".###.#####",
      "..........",
      ".######...",
      ".........X",
    ],
    blocks: 4,
    stamina: 38,
  },

  // 4. Twin Combs Offset. Two runners on one budget: a blocker that helps one
  //    exit does nothing for the other's, since the teeth sit on opposite
  //    sides of the board.
  {
    map: [
      "o.......",
      ".####...",
      "........",
      "...####.",
      "........",
      ".####...",
      ".......X",
    ],
    blocks: 3,
    stamina: 22,
  },

  // 5. Mirrored Halls. Two runners converging on one exit, with a single
  //    isolated pillar splitting the middle row between them.
  {
    map: [
      "o.....o",
      ".#####.",
      ".......",
      "...#...",
      ".......",
      ".#####.",
      "...X...",
    ],
    blocks: 3,
    stamina: 14,
  },

  // 6. Zigzag. Three short wall segments staggered corner to corner, so the
  //    natural route already switches back before a single blocker falls.
  {
    map: [
      "o........",
      ".###.....",
      ".........",
      "....###..",
      ".........",
      "......###",
      ".........",
      "........X",
    ],
    blocks: 3,
    stamina: 20,
  },

  // 7. Comb Roof. The same comb-and-lane idea as stage 1, rotated so the
  //    runner starts at the bottom and the exit sits along the top edge.
  {
    map: [
      "......X",
      ".#####.",
      ".......",
      ".#####.",
      ".......",
      "o......",
    ],
    blocks: 2,
    stamina: 22,
  },

  // 8. Twin Gate Hall. A perforated bar with an isolated pillar behind it and
  //    two runners either side --- both have to be caught with three
  //    blockers.
  {
    map: [
      "o.......o",
      "#.##.##.#",
      ".........",
      "....#....",
      ".........",
      ".........",
      "....X....",
    ],
    blocks: 3,
    stamina: 11,
  },

  // 9. Long Gauntlet. A tall corridor of three short staggered bars, giving
  //    four blockers a long walk to actually force.
  {
    map: [
      "o.....",
      "......",
      "#.##.#",
      "......",
      "......",
      ".##.##",
      "......",
      "......",
      "##.##.",
      "......",
      ".....X",
    ],
    blocks: 4,
    stamina: 24,
  },

  // 10. Twin Fortress. Two runners, one isolated pillar guarding the exit,
  //     and only two blockers to seal both of their lanes at once.
  {
    map: [
      "o.......o",
      ".#######.",
      ".........",
      "..#####..",
      ".........",
      "....#....",
      "....X....",
    ],
    blocks: 2,
    stamina: 11,
  },
];
