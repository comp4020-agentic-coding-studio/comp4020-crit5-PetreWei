// The rules of the game, with no DOM anywhere in them. The tests in spec/
// import this module directly, which is the only way the mechanic gets
// tested at all --- JSDOM can't run the client script or lay the board out,
// so anything that matters has to be decidable from these functions alone.

export type Terrain = "open" | "pillar" | "wall" | "trampled";

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface RunnerConfig {
  readonly entry: Cell;
  readonly stamina: number;
  /** Cells crossed per turn. Two makes a runner that outruns your building. */
  readonly speed?: number;
  /** First turn this runner moves. Later entries share the turns already spent. */
  readonly entersOn?: number;
}

export interface StageConfig {
  readonly cols: number;
  readonly rows: number;
  readonly exit: Cell;
  readonly pillars?: readonly Cell[];
  readonly runners: readonly RunnerConfig[];
}

export type Fate = "escaped" | "spent";

export interface Runner {
  readonly at: Cell;
  readonly stamina: number;
  readonly speed: number;
  readonly entersOn: number;
  readonly fate: Fate | null;
}

export type Status = "playing" | "won" | "lost";

export interface State {
  readonly cols: number;
  readonly rows: number;
  readonly exit: Cell;
  readonly terrain: readonly Terrain[];
  readonly runners: readonly Runner[];
  readonly turn: number;
  readonly status: Status;
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

// Trampled ground is ground, so it stays walkable --- it only stops being
// buildable. Walls and pillars are the only things that turn a route.
function walkable(terrain: Terrain): boolean {
  return terrain === "open" || terrain === "trampled";
}

const STEPS: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/**
 * Breadth-first route from `from` to `exit` over a given terrain, including
 * both endpoints. Null when there is no way through. Taking terrain as an
 * argument rather than reading it off a state is what lets `canPlace` ask
 * the question about a board that doesn't exist yet.
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
      const x = here % cols;
      const y = (here - x) / cols;
      for (const step of STEPS) {
        const cell = { x: x + step.x, y: y + step.y };
        if (!inBounds(cols, rows, cell)) continue;
        const there = indexOf(cols, cell);
        if (seen[there] === 1) continue;
        if (!walkable(terrain[there]!)) continue;
        seen[there] = 1;
        cameFrom[there] = here;
        if (there === target) {
          const route: Cell[] = [];
          for (let at = target; at !== -1; at = cameFrom[at]!) {
            route.push({ x: at % cols, y: (at - (at % cols)) / cols });
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
  const terrain: Terrain[] = new Array(config.cols * config.rows).fill("open");
  for (const pillar of config.pillars ?? []) {
    terrain[indexOf(config.cols, pillar)] = "pillar";
  }
  return {
    cols: config.cols,
    rows: config.rows,
    exit: config.exit,
    terrain,
    runners: config.runners.map((runner) => ({
      at: runner.entry,
      stamina: runner.stamina,
      speed: runner.speed ?? 1,
      entersOn: runner.entersOn ?? 1,
      fate: null,
    })),
    turn: 0,
    status: "playing",
  };
}

/**
 * The rule the spec test is written against: a wall may go anywhere open
 * except where it would leave a runner with no route to the exit at all.
 * Refusing the tap (rather than allowing it and inventing a way out) is what
 * stops a board ever soft-locking.
 */
export function canPlace(state: State, cell: Cell): boolean {
  if (state.status !== "playing") return false;
  if (!inBounds(state.cols, state.rows, cell)) return false;
  if (sameCell(cell, state.exit)) return false;
  if (state.terrain[indexOf(state.cols, cell)] !== "open") return false;
  for (const runner of state.runners) {
    if (runner.fate === null && sameCell(runner.at, cell)) return false;
  }

  const trial = state.terrain.slice();
  trial[indexOf(state.cols, cell)] = "wall";
  for (const runner of state.runners) {
    if (runner.fate !== null) continue;
    if (!pathOver(state.cols, state.rows, trial, runner.at, state.exit)) {
      return false;
    }
  }
  return true;
}

export function placeWall(state: State, cell: Cell): State | null {
  if (!canPlace(state, cell)) return null;
  const terrain = state.terrain.slice();
  terrain[indexOf(state.cols, cell)] = "wall";
  return { ...state, terrain };
}

function statusOf(runners: readonly Runner[]): Status {
  if (runners.some((runner) => runner.fate === "escaped")) return "lost";
  if (runners.every((runner) => runner.fate !== null)) return "won";
  return "playing";
}

/** One turn of movement: every runner that has entered takes its steps. */
export function step(state: State): State {
  if (state.status !== "playing") return state;

  const turn = state.turn + 1;
  const terrain = state.terrain.slice();
  const runners = state.runners.map((runner) => ({ ...runner }));

  for (const runner of runners) {
    if (runner.fate !== null || turn < runner.entersOn) continue;
    for (let moved = 0; moved < runner.speed; moved++) {
      terrain[indexOf(state.cols, runner.at)] = "trampled";
      const route = pathOver(
        state.cols,
        state.rows,
        terrain,
        runner.at,
        state.exit,
      );
      if (route === null || route.length < 2) break;
      runner.at = route[1]!;
      runner.stamina -= 1;
      if (sameCell(runner.at, state.exit)) {
        runner.fate = "escaped";
        break;
      }
      terrain[indexOf(state.cols, runner.at)] = "trampled";
      if (runner.stamina <= 0) {
        runner.fate = "spent";
        break;
      }
    }
  }

  return { ...state, turn, terrain, runners, status: statusOf(runners) };
}

/**
 * A whole turn. Placing is the only thing the player does, and it always
 * hands the runners a step in exchange --- which is why there is no wall
 * budget to draw: their stamina is the clock for both sides.
 */
export function takeTurn(state: State, cell: Cell): State | null {
  const walled = placeWall(state, cell);
  return walled === null ? null : step(walled);
}

/** Every cell a wall could legally go in right now. */
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
