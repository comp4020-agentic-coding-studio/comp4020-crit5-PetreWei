import type { StageConfig } from "./field";

// Stage data, kept out of the engine so retuning after a playtest is an edit
// to numbers rather than to rules.
//
// `#` wall, `.` open, `o` where a runner starts, `X` the way out.
//
// Because the run takes no input, a stage is decided entirely by one
// question: can you make every runner's shortest route longer than its
// stamina with the blockers you are given? That makes difficulty exactly
// measurable, so these numbers are counted rather than guessed. For each
// maze every possible placement of k blockers was enumerated and scored, and
// stamina was then chosen to land the share of winning placements on a ramp:
//
//   stage 1  21.8% of placements win     stage 4   3.4%
//   stage 2  14.6%                       stage 5   1.0%
//   stage 3   6.3%
//
// Every stage also has a shortest route no longer than its stamina, so doing
// nothing always loses --- there is no stage you can win by not thinking.

export const STAGES: readonly StageConfig[] = [
  // 1. Two blockers and a lot of forgiveness. Its only job is to make
  //    tap-to-block, and the fact that the run starts when the last one goes
  //    down, obvious.
  {
    map: [
      "...o...",
      ".##.##.",
      ".......",
      "##...##",
      ".......",
      ".##.##.",
      "...X...",
    ],
    blocks: 2,
    stamina: 8,
  },

  // 2. A comb. The route already switchbacks, so the two blockers have to
  //    close the right returns rather than just any two gaps.
  {
    map: [
      "...o...",
      ".#####.",
      ".......",
      ".#####.",
      ".......",
      ".#####.",
      "...X...",
    ],
    blocks: 2,
    stamina: 12,
  },

  // 3. Two runners, one budget. A blocker that lengthens one route often
  //    does nothing for the other, and both have to be caught.
  {
    map: [
      "o.....o",
      ".#.#.#.",
      ".......",
      "#.###.#",
      ".......",
      ".#.#.#.",
      "...X...",
    ],
    blocks: 5,
    stamina: 11,
  },

  // 4. The first maze again, with twice the blockers and a much longer walk
  //    demanded --- the board you learned on, now asking for real work.
  {
    map: [
      "...o...",
      ".##.##.",
      ".......",
      "##...##",
      ".......",
      ".##.##.",
      "...X...",
    ],
    blocks: 4,
    stamina: 12,
  },

  // 5. The comb again, three blockers, and a route that has to reach past
  //    eighteen. About one placement in a hundred does it.
  {
    map: [
      "...o...",
      ".#####.",
      ".......",
      ".#####.",
      ".......",
      ".#####.",
      "...X...",
    ],
    blocks: 3,
    stamina: 18,
  },
];
