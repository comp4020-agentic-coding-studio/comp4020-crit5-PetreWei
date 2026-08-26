import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// This week's brief: a small game with no tutorial anywhere, on screen or off
// --- the opening screen has to make the first move obvious on its own. The
// published spec (comp.anu.edu.au/.../crits/05-game/) has lines no test can
// hold --- "a stranger can pick it up and reach an ending inside five
// minutes", "obvious in ten seconds, still interesting at five" --- those are
// judged live at the crit, played cold. This file covers only what a machine
// can see in the built site: the ABSENCE of an explicit tutorial. "One rule
// has a focused automated test" is a real spec line too, but it names a test
// on your specific mechanic once you've chosen one, not something this file
// can write for you --- add it here alongside these once the game exists.

const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files().map((path) => relative(DIST, path).split(sep).join("/"));
const pages = shipped
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

// Wording, not just markup: a page can be tutorial-free in structure and still
// spell out the rules in a paragraph. Catches the common shapes of "telling
// instead of teaching" --- it can't catch every phrasing, so it's a floor, not
// a substitute for actually playing the thing cold.
const INSTRUCTIONAL_PATTERN = /how to play|instructions|tutorial|click here to start|use the arrow keys/i;

describe("crit 5: a game", () => {
  it("ships no separate instructions/tutorial/how-to-play page", () => {
    const instructionalPage = shipped.find((name) =>
      /instructions|tutorial|how-?to-?play|help/i.test(name),
    );
    expect(
      instructionalPage,
      `${instructionalPage} reads like a rules page --- the brief wants the opening screen to teach the first move on its own`,
    ).toBeUndefined();
  });

  for (const { name, doc } of pages) {
    it(`${name} has no on-screen instructions modal or panel`, () => {
      const instructionalElement = doc.querySelector(
        '[id*="instructions" i], [class*="instructions" i], [id*="tutorial" i], [class*="tutorial" i], [id*="how-to-play" i], [class*="how-to-play" i]',
      );
      expect(
        instructionalElement,
        `an element (${instructionalElement?.outerHTML.slice(0, 80)}) names itself as instructions --- the opening screen has to make the first move obvious without one`,
      ).toBeNull();
    });

    it(`${name} has no body text that reads as explicit rules`, () => {
      const bodyText = doc.body.textContent ?? "";
      const match = INSTRUCTIONAL_PATTERN.exec(bodyText);
      expect(
        match?.[0],
        `found "${match?.[0]}" in the page text --- that's telling the player, not letting them find out`,
      ).toBeUndefined();
    });
  }
});
