// Wiring only. Every rule lives in src/game/field.ts, which is what the spec
// tests exercise --- JSDOM can't run this file or lay the board out, so
// nothing here is allowed to decide anything.

import {
  canPlace,
  createStage,
  indexOf,
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

const RUN_TICK = 230;
const DEMO_TICK = 260;

if (board && progress && curtain && start) {
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
  let demoStep = 0;

  // The hint is a one-time thing you get on the very first tap of the whole
  // game, not a lesson you get retaught on every replay of stage one --- once
  // you've placed a blocker anywhere, you've already learned what a tap does.
  let hintEnabled = true;

  // A different hint for a different reason: four losses on the same stage
  // in a row means the maze itself is the obstacle, not any lesson about
  // tapping. `solve()` already knows a winning sequence --- showing all but
  // its last placement points at the shape of the answer without placing it
  // for you, so the stage is still yours to actually finish.
  let failCount = 0;
  let hintPlan: readonly Cell[] = [];

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

    // Stage one, before the very first tap of the whole game: every cell that
    // would accept a blocker gets a soft glow. It stops the moment you place
    // one, and `hintEnabled` keeps it stopped for good --- a replay of stage
    // one starts mid-skill instead of re-teaching what startup already showed.
    const showHint =
      hintEnabled &&
      state.phase === "setup" &&
      stageIndex === 0 &&
      state.blocksLeft === STAGES[0]!.blocks;

    // Past three straight losses: glow the cells `startRealRound` lined up,
    // but only the ones still open --- once you've placed one yourself it
    // has already done its job and should stop drawing the eye.
    const suggested = new Set<number>();
    if (state.phase === "setup") {
      for (const cell of hintPlan) suggested.add(indexOf(state.cols, cell));
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
        if (showHint && canPlace(state, cell)) el.classList.add("cell--hint");
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
        failCount = 0;
      }
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
  }

  /** Once the last blocker is down the board plays itself out. */
  function runOut(): void {
    window.clearInterval(runTimer);
    runTimer = window.setInterval(() => {
      state = step(state);
      paint();
      if (state.phase !== "running") {
        window.clearInterval(runTimer);
        if (state.phase === "lost") failCount += 1;
      }
    }, RUN_TICK);
  }

  /**
   * A fresh copy of the current stage for an actual (non-demo) round. Past
   * three straight losses on it, also line up a hint: `solve()`'s own
   * winning sequence with its final placement dropped, so the glow shows
   * where the answer is heading without ever finishing it for you.
   */
  function startRealRound(): void {
    state = createStage(STAGES[stageIndex]!);
    hintPlan = failCount > 3 ? (solve(state) ?? []).slice(0, -1) : [];
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
    demoPlan = solve(fresh) ?? [];
    demoStep = 0;
    state = fresh;
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
        const cell = demoPlan[demoStep];
        demoStep += 1;
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
  }

  function refuse(x: number, y: number): void {
    const el = board!.querySelector<HTMLElement>(`[data-x="${x}"][data-y="${y}"]`);
    if (!el) return;
    el.classList.remove("cell--refused");
    void el.offsetWidth; // restart the animation on a repeated tap
    el.classList.add("cell--refused");
  }

  // One button, always on top of the demo rather than only appearing during
  // its losing beat: an arcade "tap anywhere to start" never actually looked
  // like something to press, it just quietly reacted if you happened to.
  // A native <button> gets keyboard activation (Enter/Space) and focus
  // styling for free, so there is no separate keydown handler to maintain.
  start.addEventListener("click", takeOver);

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
    hintEnabled = false;
    paint();
    if (state.phase === "running") runOut();
  });

  startDemoRound();
  paint();
  runDemo();
}
