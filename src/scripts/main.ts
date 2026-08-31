// Wiring only. Every rule lives in src/game/field.ts, which is what the spec
// tests exercise --- JSDOM can't run this file or lay the board out, so
// nothing here is allowed to decide anything.

import {
  canPlace,
  createStage,
  indexOf,
  routeFor,
  sameCell,
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

        const index = state.runners.findIndex(
          (runner) => runner.fate === null && sameCell(runner.at, cell),
        );
        if (index !== -1) {
          const runner = state.runners[index]!;
          el.classList.add("cell--runner");
          if (!entered(state, index)) el.classList.add("cell--waiting");
          if (runner.speed > 1) el.classList.add("cell--swift");
          const meter = document.createElement("span");
          meter.className = "meter";
          meter.textContent = String(runner.stamina);
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
    curtain!.classList.toggle("curtain--lost", state.status === "lost");
    again.focus();
  }

  function paint(): void {
    paintProgress();
    paintBoard();
    paintCurtain();
  }

  function refuse(x: number, y: number): void {
    const el = board!.querySelector<HTMLElement>(`[data-x="${x}"][data-y="${y}"]`);
    if (!el) return;
    el.classList.remove("cell--refused");
    void el.offsetWidth; // restart the animation on a repeated tap
    el.classList.add("cell--refused");
  }

  board.addEventListener("click", (event) => {
    if (state.status !== "playing") return;
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
}
