// Wiring only. Every rule lives in src/game/field.ts, which is what the spec
// tests exercise --- JSDOM can't run this file or lay the board out, so
// nothing here is allowed to decide anything.

import {
  canPlace,
  createStage,
  indexOf,
  routeFor,
  sameCell,
  step,
  tap,
  type Cell,
  type State,
} from "../game/field";
import { STAGES } from "../game/stages";

const board = document.querySelector<HTMLElement>("#board");
const progress = document.querySelector<HTMLElement>("#progress");
const curtain = document.querySelector<HTMLElement>("#curtain");

const RUN_TICK = 230;
const DEMO_TICK = 260;

if (board && progress && curtain) {
  let stageIndex = 0;
  let state = createStage(STAGES[0]!);
  let runTimer = 0;

  // The goal of this game is to PREVENT something, and a board at rest can't
  // say that: a token, a route and a way out read just as easily as "escort
  // it to the exit", which is the opposite of the point. So before anyone
  // touches it the board plays itself, loses, and resets --- the fail state
  // is the only honest way to show what you are meant to stop.
  let demonstrating = true;
  let demoTimer = 0;
  let holdFrames = 0;

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

    const cells: HTMLElement[] = [];
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const cell: Cell = { x, y };
        const at = indexOf(state.cols, cell);
        const el = document.createElement("div");
        el.className = `cell cell--${state.terrain[at]}`;
        el.dataset["x"] = String(x);
        el.dataset["y"] = String(y);

        if (state.trail[at]) el.classList.add("cell--trail");
        if (onRoute.has(at)) el.classList.add("cell--route");
        if (sameCell(cell, state.exit)) el.classList.add("cell--exit");

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
          // Drawn as a fraction of what it started with, so the disc shrinks
          // and greys as it tires: a number alone reads as a score, and a
          // score going down reads as losing.
          meter.style.setProperty(
            "--vigour",
            String(Math.max(0, runner.stamina) / runner.maxStamina),
          );
          meter.textContent = String(Math.max(0, runner.stamina));
          el.append(meter);
        }
        cells.push(el);
      }
    }
    board!.replaceChildren(...cells);
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
      if (state.phase === "won") {
        stageIndex = cleared ? 0 : stageIndex + 1;
      }
      state = createStage(STAGES[stageIndex]!);
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

  function runDemo(): void {
    demoTimer = window.setInterval(() => {
      if (holdFrames > 0) {
        // Sit on the "it got out" frame for a beat, then start over.
        holdFrames -= 1;
        if (holdFrames === 0) {
          state = { ...createStage(STAGES[stageIndex]!), blocksLeft: 0, phase: "running" };
        }
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
    state = createStage(STAGES[stageIndex]!);
    paint();
  }

  function refuse(x: number, y: number): void {
    const el = board!.querySelector<HTMLElement>(`[data-x="${x}"][data-y="${y}"]`);
    if (!el) return;
    el.classList.remove("cell--refused");
    void el.offsetWidth; // restart the animation on a repeated tap
    el.classList.add("cell--refused");
  }

  // Anywhere, not just the board: during the demo the first input's whole job
  // is to hand over, the way an arcade attract screen does, and it is not
  // also a move --- the board it was aimed at is about to be swept away.
  //
  // Listening on click rather than pointerdown is what makes that safe. A
  // click bubbles through the board's own handler first, which sees the demo
  // still running and ignores it, and only then reaches here. Handing over on
  // pointerdown instead needed a flag to suppress the click that followed,
  // and that flag was a race: the two are separate tasks, and replacing the
  // board between them detaches the element the click was aimed at.
  document.addEventListener("click", takeOver);
  document.addEventListener("keydown", takeOver);

  board.addEventListener("click", (event) => {
    if (demonstrating || state.phase !== "setup") return;
    const el = (event.target as HTMLElement).closest<HTMLElement>(".cell");
    if (!el) return;
    const cell: Cell = { x: Number(el.dataset["x"]), y: Number(el.dataset["y"]) };

    const next = tap(state, cell);
    if (next === null) {
      // Flash only for the refusal that means something. Tapping the maze,
      // the way out or the runner is simply inert, and a red flash on those
      // would turn the one signal the rules need into background noise ---
      // what is left is exactly "that one would seal the way out".
      const at = indexOf(state.cols, cell);
      const plausible =
        state.terrain[at] === "open" &&
        !sameCell(cell, state.exit) &&
        !state.runners.some((runner) => sameCell(runner.start, cell));
      if (plausible && !canPlace(state, cell)) refuse(cell.x, cell.y);
      return;
    }
    state = next;
    paint();
    if (state.phase === "running") runOut();
  });

  // The demo needs a board that is already running, since setup has nothing
  // to show: an empty maze and a runner that never moves.
  state = { ...state, blocksLeft: 0, phase: "running" };
  paint();
  runDemo();
}
