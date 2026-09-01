// Wiring only. Every rule lives in src/game/field.ts, which is what the spec
// tests exercise --- JSDOM can't run this file or lay the board out, so
// nothing here is allowed to decide anything.

import {
  createStage,
  indexOf,
  isOpenTarget,
  placeBlock,
  routeFor,
  sameCell,
  solve,
  step,
  tap,
  type Cell,
} from "../game/field";
import { STAGES } from "../game/stages";

const board = document.querySelector<HTMLElement>("#board");
const progress = document.querySelector<HTMLElement>("#progress");
const curtain = document.querySelector<HTMLElement>("#curtain");
const start = document.querySelector<HTMLButtonElement>("#start");
const hint = document.querySelector<HTMLButtonElement>("#hint");

const RUN_TICK = 230;
const DEMO_TICK = 260;

if (board && progress && curtain && start && hint) {
  let stageIndex = 0;
  let state = createStage(STAGES[0]!);
  let runTimer = 0;

  // The goal of this game is to PREVENT something, but the only verb the
  // player has is placing blockers, and a board at rest can't show a verb.
  // So before anyone touches it the board plays a real, provably winning
  // sequence from `solve()` --- the same blockers a good player would choose,
  // going down one at a time, ending in "Contained" rather than an untouched
  // maze the runner simply walks through.
  let demonstrating = true;
  let demoTimer = 0;
  let holdFrames = 0;
  let demoPlan: Cell[] = [];

  // Set only by pressing "Show solution", never on its own: `solve()` already
  // knows a winning sequence, and showing all but its last placement points
  // at the shape of the answer without placing it for you, so the stage is
  // still yours to actually finish. Asking is the player's call to make.
  let hintPlan: readonly Cell[] = [];

  // The keyboard equivalent of "where the mouse is hovering": one logical
  // cell that arrow keys move and Enter/Space activates, re-centred whenever
  // a fresh board appears, the way a pointer would start over a new maze.
  function centreCursor(): Cell {
    return { x: Math.floor(state.cols / 2), y: Math.floor(state.rows / 2) };
  }
  let cursor: Cell = centreCursor();

  function paintProgress(): void {
    const marks: HTMLElement[] = STAGES.map((_, i) => {
      const pip = document.createElement("span");
      pip.className =
        "pip" + (i < stageIndex ? " pip--done" : i === stageIndex ? " pip--now" : "");
      return pip;
    });

    // The blockers still in hand, as one dot each. A count you can see at a
    // glance is the whole reason the budget reads as a budget. Hidden during
    // the demo, where an empty purse would be describing a hand nobody holds.
    if (demonstrating) {
      progress!.replaceChildren(...marks);
      return;
    }

    const purse = document.createElement("span");
    purse.className = "purse";
    for (let i = 0; i < STAGES[stageIndex]!.blocks; i++) {
      const dot = document.createElement("span");
      dot.className = "coin" + (i < state.blocksLeft ? "" : " coin--spent");
      purse.append(dot);
    }

    progress!.replaceChildren(...marks, purse);
  }

  function paintBoard(): void {
    // The board sizes its own cells from these, so a seven-wide stage does
    // not overflow a phone the way a five-wide one doesn't.
    board!.style.setProperty("--cols", String(state.cols));
    board!.style.setProperty("--rows", String(state.rows));
    board!.classList.toggle("board--setup", state.phase === "setup");

    // The route each runner will take. During setup this is the only way to
    // see what a blocker actually bought you before committing to the run.
    const onRoute = new Set<number>();
    for (const runner of state.runners) {
      if (runner.fate !== null) continue;
      for (const cell of routeFor(state, runner.at) ?? []) {
        onRoute.add(indexOf(state.cols, cell));
      }
    }

    // Set only once "Show solution" has been pressed: glow the cells it
    // lined up, but only the ones still open --- once you've placed one
    // yourself it has already done its job and should stop drawing the eye.
    const suggested = new Set<number>();
    if (state.phase === "setup") {
      for (const cell of hintPlan) suggested.add(indexOf(state.cols, cell));
    }

    // The board is one Tab stop, not one per cell: tabbing through 25+ cells
    // one at a time would be unusable. A single roving cell carries
    // `tabindex="0"`; arrow keys move which one that is (see the `keydown`
    // listener below). Cells drop out of the Tab order entirely once the
    // board stops being interactive, the same way the demo never was one.
    const interactive = !demonstrating && state.phase === "setup";

    const cells: HTMLElement[] = [];
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const cell: Cell = { x, y };
        const at = indexOf(state.cols, cell);
        const el = document.createElement("div");
        el.className = `cell cell--${state.terrain[at]}`;
        el.dataset["x"] = String(x);
        el.dataset["y"] = String(y);

        if (interactive) {
          el.setAttribute("role", "gridcell");
          el.tabIndex = sameCell(cell, cursor) ? 0 : -1;
        }

        if (state.trail[at]) el.classList.add("cell--trail");
        if (onRoute.has(at)) el.classList.add("cell--route");
        if (sameCell(cell, state.exit)) el.classList.add("cell--exit");
        if (suggested.has(at) && state.terrain[at] === "open") {
          el.classList.add("cell--suggest");
        }

        // Resolved runners stay on the board on purpose. A spent one leaves a
        // husk where you stopped it, and an escaped one sits on the breach it
        // walked out of --- so both endings have a picture, not just a word.
        const runner = state.runners.find((r) =>
          sameCell(r.fate === "escaped" ? state.exit : r.at, cell),
        );
        if (runner) {
          el.classList.add("cell--runner");
          if (runner.fate === "spent") el.classList.add("cell--spent");
          if (runner.fate === "escaped") el.classList.add("cell--escaped");

          const meter = document.createElement("span");
          meter.className = "meter";
          // Drawn as a fraction of what it started with, so the body shrinks
          // and greys as it tires: a number alone reads as a score, and a
          // score going down reads as losing.
          meter.style.setProperty(
            "--vigour",
            String(Math.max(0, runner.stamina) / runner.maxStamina),
          );
          // How fierce the horns look, tied to the real difficulty ramp
          // rather than an arbitrary cosmetic choice.
          meter.style.setProperty("--menace", String(stageIndex));
          meter.textContent = String(Math.max(0, runner.stamina));
          el.append(meter);
        }
        cells.push(el);
      }
    }
    // Read *before* `replaceChildren` runs, not after: detaching a focused
    // element fires its blur/focusout synchronously, so by the next line
    // `boardFocused` has already flipped to false even though the user never
    // left the board. Checking `activeElement` here catches the true state
    // an instant before that happens.
    const hadFocus = interactive && board!.contains(document.activeElement);
    board!.replaceChildren(...cells);

    // Restore focus onto the fresh cursor cell — otherwise every repaint (an
    // arrow-key move included) would silently bounce keyboard focus to
    // <body> and end the keyboard-only run right there.
    if (hadFocus) {
      cells[indexOf(state.cols, cursor)]?.focus();
    }
  }

  function paintCurtain(): void {
    if (state.phase === "setup" || state.phase === "running") {
      curtain!.replaceChildren();
      curtain!.hidden = true;
      return;
    }

    const cleared = state.phase === "won" && stageIndex === STAGES.length - 1;
    const mark = document.createElement("p");
    mark.className = "verdict";
    mark.textContent =
      state.phase === "lost" ? "It got out" : cleared ? "All clear" : "Contained";

    curtain!.classList.toggle("curtain--lost", state.phase === "lost");

    // While the board is demonstrating itself there is nothing to press: the
    // next input anywhere hands control over. The class also stops the
    // curtain swallowing that input --- it sits over the board, so without it
    // a tap aimed at a cell during the "it got out" beat hits glass.
    if (demonstrating) {
      curtain!.classList.add("curtain--demo");
      curtain!.replaceChildren(mark);
      curtain!.hidden = false;
      return;
    }
    curtain!.classList.remove("curtain--demo");

    const again = document.createElement("button");
    again.type = "button";
    again.className = "again";
    again.textContent = state.phase === "lost" ? "Again" : cleared ? "Again" : "Next";
    again.addEventListener("click", () => {
      if (state.phase === "won") stageIndex = cleared ? 0 : stageIndex + 1;
      startRealRound();
      paint();
      again.blur();
    });

    curtain!.replaceChildren(mark, again);
    curtain!.hidden = false;
    again.focus();
  }

  function paint(): void {
    paintProgress();
    paintBoard();
    paintCurtain();
    start!.hidden = !demonstrating;
    hint!.hidden = demonstrating || state.phase !== "setup";
  }

  /** Once the last blocker is down the board plays itself out. */
  function runOut(): void {
    window.clearInterval(runTimer);
    runTimer = window.setInterval(() => {
      state = step(state);
      paint();
      if (state.phase !== "running") window.clearInterval(runTimer);
    }, RUN_TICK);
  }

  /** A fresh copy of the current stage for an actual (non-demo) round. */
  function startRealRound(): void {
    state = createStage(STAGES[stageIndex]!);
    hintPlan = [];
    cursor = centreCursor();
  }

  /**
   * Lines up `solve()`'s own winning sequence for the round in progress,
   * final placement dropped, so pressing the button points at the shape of
   * the answer without ever finishing the stage for you.
   */
  function showSolution(): void {
    if (state.phase !== "setup") return;
    hintPlan = (solve(state) ?? []).slice(0, -1);
    paint();
  }

  /**
   * A fresh stage-one board plus a winning placement sequence for it.
   * `solve` is deterministic, so this is the same sequence every round; if it
   * ever came back empty (it doesn't --- the spec proves every stage
   * solvable) the round would simply sit in setup forever rather than
   * pretend a placement it doesn't have.
   */
  function startDemoRound(): void {
    const fresh = createStage(STAGES[stageIndex]!);
    demoPlan = [...(solve(fresh) ?? [])];
    state = fresh;
    cursor = centreCursor();
  }

  function runDemo(): void {
    demoTimer = window.setInterval(() => {
      if (holdFrames > 0) {
        // Sit on the verdict for a beat, then start over.
        holdFrames -= 1;
        if (holdFrames === 0) startDemoRound();
      } else if (state.phase === "setup") {
        // One blocker down per tick, so the placement is legible instead of
        // appearing all at once.
        const cell = demoPlan.shift();
        if (cell) state = placeBlock(state, cell) ?? state;
      } else {
        state = step(state);
        if (state.phase !== "running") holdFrames = 4;
      }
      paint();
    }, DEMO_TICK);
  }

  function takeOver(): void {
    if (!demonstrating) return;
    demonstrating = false;
    window.clearInterval(demoTimer);
    startRealRound();
    paint();

    // The board sits earlier in the document than Start, so once Start is
    // hidden a forward Tab would skip straight past the board to "Show
    // solution" rather than landing on it --- there is nothing to Tab back
    // to. Move focus onto the cursor cell explicitly, the one time the board
    // has to steal focus rather than merely keep hold of it.
    (board!.children[indexOf(state.cols, cursor)] as HTMLElement | undefined)?.focus();
  }

  function refuse(cell: Cell): void {
    const el = board!.children[indexOf(state.cols, cell)] as HTMLElement | undefined;
    if (!el) return;
    el.classList.remove("cell--refused");
    void el.offsetWidth; // restart the animation on a repeated tap
    el.classList.add("cell--refused");
  }

  /** Shared by the click handler and the keyboard's Enter/Space. */
  function attemptPlacement(cell: Cell): void {
    if (demonstrating || state.phase !== "setup") return;

    const next = tap(state, cell);
    if (next === null) {
      // Flash only for the refusal that means something. Tapping the maze,
      // the way out or the runner is simply inert, and a red flash on those
      // would turn the one signal the rules need into background noise ---
      // what is left is exactly "that one would seal the way out".
      if (isOpenTarget(state, cell)) refuse(cell);
      return;
    }
    state = next;
    paint();
    if (state.phase === "running") runOut();
  }

  // One button, always on top of the demo rather than only appearing during
  // its losing beat: an arcade "tap anywhere to start" never actually looked
  // like something to press, it just quietly reacted if you happened to.
  // A native <button> gets keyboard activation (Enter/Space) and focus
  // styling for free, so there is no separate keydown handler to maintain.
  start.addEventListener("click", takeOver);
  hint.addEventListener("click", showSolution);

  board.addEventListener("click", (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(".cell");
    if (!el) return;
    attemptPlacement({ x: Number(el.dataset["x"]), y: Number(el.dataset["y"]) });
  });

  // Arrow keys move the one roving cursor cell (paintBoard keeps its
  // tabindex in sync); Enter or Space activates it exactly like a click.
  // No on-screen text ever names this scheme --- the board is the one
  // thing on the page a keyboard-only player would try arrowing around.
  const ARROW_STEPS: Readonly<Record<string, Cell>> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  function clamp(value: number, max: number): number {
    return Math.max(0, Math.min(max, value));
  }

  board.addEventListener("keydown", (event) => {
    if (demonstrating || state.phase !== "setup") return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      attemptPlacement(cursor);
      return;
    }

    const move = ARROW_STEPS[event.key];
    if (!move) return;
    cursor = {
      x: clamp(cursor.x + move.x, state.cols - 1),
      y: clamp(cursor.y + move.y, state.rows - 1),
    };
    event.preventDefault(); // the page must not scroll under an arrow press
    paintBoard();
  });

  startDemoRound();
  paint();
  runDemo();
}
