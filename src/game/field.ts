// The rules of the game, with no DOM anywhere in them. The tests in spec/
// import this module directly, which is the only way the mechanic gets
// tested at all --- JSDOM can't run the client script or lay the board out,
// so anything that matters has to be decidable from these functions alone.
//
// A stage is a fixed maze plus a budget of blockers. The player spends the
// whole budget with the runner standing still; placing the last blocker
// starts the run, and from there the board plays itself out. That makes the
// puzzle fully deterministic: a placement either lengthens every runner's
// route past its stamina or it doesn't, and `solve` below can say which.

export type Terrain = "open" | "wall" | "block";

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface StageConfig {
  /** Rows of `#` wall, `.` open, `o` a runner's start, `X` the way out. */
  readonly map: readonly string[];
  /** How many blockers the player gets. The run begins when the last is set. */
  readonly blocks: number;
  /** Cells a runner can cross before it drops. */
  readonly stamina: number;
}

export type Fate = "escaped" | "spent";

export interface Runner {
  readonly at: Cell;
  readonly start: Cell;
  readonly stamina: number;
  readonly maxStamina: number;
  readonly fate: Fate | null;
}

/** Placing blockers, watching it play out, and the two ways it can end. */
export type Phase = "setup" | "running" | "won" | "lost";

export interface State {
  readonly cols: number;
  readonly rows: number;
  readonly exit: Cell;
  readonly terrain: readonly Terrain[];
  /** Cells a runner has crossed. Cosmetic --- it makes the run readable. */
  readonly trail: readonly boolean[];
  readonly runners: readonly Runner[];
  readonly blocksLeft: number;
  readonly phase: Phase;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function indexOf(cols: number, cell: Cell): number {
  return cell.y * cols + cell.x;
}

function inBounds(cols: number, rows: number, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < cols && cell.y < rows;
}

function cellFor(cols: number, index: number): Cell {
  const x = index % cols;
  return { x, y: (index - x) / cols };
}

const STEPS: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/**
 * Breadth-first route from `from` to `exit`, including both endpoints, or
 * null when there is no way through. Terrain comes in as an argument rather
 * than off a state so `canPlace` can ask about a board that doesn't exist
 * yet.
 */
export function pathOver(
  cols: number,
  rows: number,
  terrain: readonly Terrain[],
  from: Cell,
  exit: Cell,
): Cell[] | null {
  if (!inBounds(cols, rows, from) || !inBounds(cols, rows, exit)) return null;
  if (sameCell(from, exit)) return [from];

  const start = indexOf(cols, from);
  const target = indexOf(cols, exit);
  const cameFrom = new Int32Array(cols * rows).fill(-1);
  const seen = new Uint8Array(cols * rows);
  seen[start] = 1;

  let frontier: number[] = [start];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const here of frontier) {
      const { x, y } = cellFor(cols, here);
      for (const step of STEPS) {
        const cell = { x: x + step.x, y: y + step.y };
        if (!inBounds(cols, rows, cell)) continue;
        const there = indexOf(cols, cell);
        if (seen[there] === 1) continue;
        if (terrain[there] !== "open") continue;
        seen[there] = 1;
        cameFrom[there] = here;
        if (there === target) {
          const route: Cell[] = [];
          for (let at = target; at !== -1; at = cameFrom[at]!) {
            route.push(cellFor(cols, at));
          }
          return route.reverse();
        }
        next.push(there);
      }
    }
    frontier = next;
  }
  return null;
}

export function routeFor(state: State, from: Cell): Cell[] | null {
  return pathOver(state.cols, state.rows, state.terrain, from, state.exit);
}

export function createStage(config: StageConfig): State {
  const rows = config.map.length;
  const cols = Math.max(...config.map.map((row) => row.length));
  const terrain: Terrain[] = new Array(cols * rows).fill("wall");
  const starts: Cell[] = [];
  let exit: Cell | null = null;

  for (let y = 0; y < rows; y++) {
    const row = config.map[y]!;
    for (let x = 0; x < cols; x++) {
      const mark = row[x] ?? "#";
      const cell = { x, y };
      if (mark === "#") continue;
      terrain[indexOf(cols, cell)] = "open";
      if (mark === "o") starts.push(cell);
      if (mark === "X") exit = cell;
    }
  }

  if (exit === null) throw new Error("stage map has no exit (X)");
  if (starts.length === 0) throw new Error("stage map has no runner (o)");

  return {
    cols,
    rows,
    exit,
    terrain,
    trail: new Array(cols * rows).fill(false),
    runners: starts.map((start) => ({
      at: start,
      start,
      stamina: config.stamina,
      maxStamina: config.stamina,
      fate: null,
    })),
    blocksLeft: config.blocks,
    phase: "setup",
  };
}

/**
 * The rule the spec test is written against: a blocker may go on any open
 * cell except one that would leave a runner with no route out at all.
 * Refusing the placement, rather than allowing it and inventing a way out,
 * is what stops a board ever soft-locking --- and it is what keeps this a
 * routing puzzle instead of a sealing puzzle, since walling the exit in
 * would otherwise win every stage outright.
 */
/**
 * The cheap conditions a target cell must meet before it's even worth
 * running `canPlace`'s trial-BFS: open ground, not the exit, not where a
 * runner starts. `main.ts` uses this to tell "that tap did nothing" apart
 * from "that placement would have sealed the way out."
 */
export function isOpenTarget(state: State, cell: Cell): boolean {
  return (
    state.terrain[indexOf(state.cols, cell)] === "open" &&
    !sameCell(cell, state.exit) &&
    !state.runners.some((runner) => sameCell(runner.start, cell))
  );
}

export function canPlace(state: State, cell: Cell): boolean {
  if (state.phase !== "setup") return false;
  if (state.blocksLeft <= 0) return false;
  if (!inBounds(state.cols, state.rows, cell)) return false;
  if (sameCell(cell, state.exit)) return false;
  if (state.terrain[indexOf(state.cols, cell)] !== "open") return false;
  for (const runner of state.runners) {
    if (sameCell(runner.start, cell)) return false;
  }

  const trial = state.terrain.slice();
  trial[indexOf(state.cols, cell)] = "block";
  for (const runner of state.runners) {
    if (!pathOver(state.cols, state.rows, trial, runner.at, state.exit)) {
      return false;
    }
  }
  return true;
}

/** Spending the last blocker is what starts the run; there is no go button. */
export function placeBlock(state: State, cell: Cell): State | null {
  if (!canPlace(state, cell)) return null;
  const terrain = state.terrain.slice();
  terrain[indexOf(state.cols, cell)] = "block";
  const blocksLeft = state.blocksLeft - 1;
  return {
    ...state,
    terrain,
    blocksLeft,
    phase: blocksLeft === 0 ? "running" : "setup",
  };
}

/** Tapping a blocker you already set picks it back up, while setup lasts. */
export function removeBlock(state: State, cell: Cell): State | null {
  if (state.phase !== "setup") return null;
  if (!inBounds(state.cols, state.rows, cell)) return null;
  if (state.terrain[indexOf(state.cols, cell)] !== "block") return null;
  const terrain = state.terrain.slice();
  terrain[indexOf(state.cols, cell)] = "open";
  return { ...state, terrain, blocksLeft: state.blocksLeft + 1 };
}

/** One tap: pick a blocker back up, or set one down. */
export function tap(state: State, cell: Cell): State | null {
  return removeBlock(state, cell) ?? placeBlock(state, cell);
}

function phaseFor(runners: readonly Runner[]): Phase {
  if (runners.some((runner) => runner.fate === "escaped")) return "lost";
  if (runners.every((runner) => runner.fate !== null)) return "won";
  return "running";
}

/** One tick of the run. Every unresolved runner takes a single step. */
export function step(state: State): State {
  if (state.phase !== "running") return state;

  const trail = state.trail.slice();
  const runners = state.runners.map((runner) => ({ ...runner }));

  for (const runner of runners) {
    if (runner.fate !== null) continue;
    trail[indexOf(state.cols, runner.at)] = true;
    const route = pathOver(
      state.cols,
      state.rows,
      state.terrain,
      runner.at,
      state.exit,
    );
    if (route === null || route.length < 2) continue;
    runner.at = route[1]!;
    runner.stamina -= 1;
    if (sameCell(runner.at, state.exit)) {
      runner.fate = "escaped";
      continue;
    }
    trail[indexOf(state.cols, runner.at)] = true;
    if (runner.stamina <= 0) runner.fate = "spent";
  }

  return { ...state, trail, runners, phase: phaseFor(runners) };
}

/** Every cell a blocker could legally go in right now. */
export function legalPlacements(state: State): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const cell = { x, y };
      if (canPlace(state, cell)) cells.push(cell);
    }
  }
  return cells;
}

/**
 * How far the nearest-to-escaping runner still has to walk. Because the run
 * takes no input, this single number decides the whole stage: every runner
 * has to be made to walk further than its stamina.
 */
export function shortestRun(state: State): number {
  let worst = Infinity;
  for (const runner of state.runners) {
    const route = routeFor(state, runner.at);
    if (route === null) return Infinity;
    worst = Math.min(worst, route.length - 1);
  }
  return worst;
}

/**
 * Beam search for a placement that wins the stage, used to prove in the spec
 * tests that every shipped stage can actually be solved with the budget it
 * gives you. Returning a placement is proof; returning null is only evidence,
 * since the search is bounded --- so stages are tuned to be found easily
 * rather than tuned to sit right at the edge of what it can reach.
 */
export function solve(start: State, beamWidth = 140): Cell[] | null {
  let beam: Array<{ state: State; picks: Cell[] }> = [{ state: start, picks: [] }];

  for (let depth = 0; depth < start.blocksLeft; depth++) {
    const next: Array<{ state: State; picks: Cell[]; score: number }> = [];
    const seen = new Set<string>();

    for (const { state, picks } of beam) {
      for (const cell of legalPlacements(state)) {
        const placed = placeBlock(state, cell);
        if (placed === null) continue;
        const key = placed.terrain.join("");
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state: placed, picks: [...picks, cell], score: shortestRun(placed) });
      }
    }
    if (next.length === 0) return null;

    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, beamWidth).map(({ state, picks }) => ({ state, picks }));
  }

  for (const { state, picks } of beam) {
    if (state.runners.every((runner) => shortestRun(state) > runner.maxStamina)) {
      return picks;
    }
  }
  return null;
}
