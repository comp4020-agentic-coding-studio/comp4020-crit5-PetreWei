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
  takeTurn,
  type Cell,
  type State,
} from "../game/field";
import { STAGES } from "../game/stages";

const board = document.querySelector<HTMLElement>("#board");
const progress = document.querySelector<HTMLElement>("#progress");
const curtain = document.querySelector<HTMLElement>("#curtain");

if (board && progress && curtain) {
  let stageIndex = 0;
  let state = createStage(STAGES[0]!);

  // The goal of this game is to PREVENT something, and a board at rest can't
  // say that: a token, a dotted line and a way out read just as easily as
  // "escort it to the exit", which is the opposite of the point. So before
  // anyone touches it the board plays itself, loses, and resets --- the fail
  // state is the only honest way to show what you are meant to stop.
  let demonstrating = true;
  let demoTimer = 0;
  let holdFrames = 0;

  const entered = (state: State, index: number): boolean =>
    state.turn + 1 >= state.runners[index]!.entersOn;

  function paintProgress(): void {
    progress!.replaceChildren(
      ...STAGES.map((_, i) => {
        const pip = document.createElement("span");
        pip.className =
          "pip" + (i < stageIndex ? " pip--done" : i === stageIndex ? " pip--now" : "");
        return pip;
      }),
    );
  }

  function paintBoard(): void {
    // The board sizes its own cells from these, so a seven-wide stage does
    // not overflow a phone the way a five-wide one doesn't.
    board!.style.setProperty("--cols", String(state.cols));
    board!.style.setProperty("--rows", String(state.rows));

    // Where each runner is heading, so that a detour you just created is
    // visible as a detour rather than as the runner mysteriously turning.
    const onRoute = new Set<number>();
    state.runners.forEach((runner, i) => {
      if (runner.fate !== null || !entered(state, i)) return;
      for (const cell of routeFor(state, runner.at) ?? []) {
        onRoute.add(indexOf(state.cols, cell));
      }
    });

    const cells: HTMLElement[] = [];
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const cell: Cell = { x, y };
        const at = indexOf(state.cols, cell);
        const el = document.createElement("div");
        el.className = `cell cell--${state.terrain[at]}`;
        el.dataset["x"] = String(x);
        el.dataset["y"] = String(y);

        if (onRoute.has(at)) el.classList.add("cell--route");
        if (sameCell(cell, state.exit)) el.classList.add("cell--exit");

        // Resolved runners stay on the board on purpose. A spent one leaves a
        // husk where you stopped it, and an escaped one sits on the breach it
        // walked out of --- so both endings have a picture, not just a word.
        const index = state.runners.findIndex((runner) =>
          sameCell(runner.fate === "escaped" ? state.exit : runner.at, cell),
        );
        if (index !== -1) {
          const runner = state.runners[index]!;
          el.classList.add("cell--runner");
          if (runner.fate === "spent") el.classList.add("cell--spent");
          if (runner.fate === "escaped") el.classList.add("cell--escaped");
          if (runner.fate === null && !entered(state, index)) {
            el.classList.add("cell--waiting");
          }
          if (runner.speed > 1) el.classList.add("cell--swift");

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
    if (state.status === "playing") {
      curtain!.replaceChildren();
      curtain!.hidden = true;
      return;
    }

    const cleared = state.status === "won" && stageIndex === STAGES.length - 1;
    const mark = document.createElement("p");
    mark.className = "verdict";
    mark.textContent =
      state.status === "lost" ? "It got out" : cleared ? "All clear" : "Contained";

    curtain!.classList.toggle("curtain--lost", state.status === "lost");

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
    again.textContent = state.status === "lost" ? "Again" : cleared ? "Again" : "Next";
    again.addEventListener("click", () => {
      if (state.status === "won") {
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

  function runDemo(): void {
    demoTimer = window.setInterval(() => {
      if (holdFrames > 0) {
        // Sit on the "it got out" frame for a beat, then start over.
        holdFrames -= 1;
        if (holdFrames === 0) state = createStage(STAGES[stageIndex]!);
      } else if (state.status === "playing") {
        state = step(state);
        if (state.status !== "playing") holdFrames = 4;
      }
      paint();
    }, 430);
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
    if (demonstrating || state.status !== "playing") return;
    const el = (event.target as HTMLElement).closest<HTMLElement>(".cell");
    if (!el) return;
    const cell: Cell = { x: Number(el.dataset["x"]), y: Number(el.dataset["y"]) };

    const next = takeTurn(state, cell);
    if (next === null) {
      if (!canPlace(state, cell)) refuse(cell.x, cell.y);
      return;
    }
    state = next;
    paint();
  });

  paint();
  runDemo();
}
