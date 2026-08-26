import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A sensor, not a contract test: holds every colour/background pair declared
// together in global.css to the WCAG 2.1 minimum. Grew out of crit4, where a
// hand-calculated 5.4:1 turned out to measure 4.10:1 at 320px, because the real
// background came from an ancestor element the arithmetic never saw. This
// generalised version only catches pairs declared in the SAME rule --- a
// background inherited from elsewhere still needs its own one-off measured
// check, the way crit4's did (see that repo's spec/contrast.test.ts for the
// technique: screenshot the patch, sample it, fingerprint the source it was
// sampled against so a repaint invalidates the recorded value).

const CSS = readFileSync(resolve("src/styles/global.css"), "utf8");

/** WCAG 2.1 minimum for text below 18.66px bold / 24px regular. */
const FLOOR = 4.5;

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: readonly [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Every rule that sets both `color` and a plain `background`/`background-color`
 * as six-digit hex in the same block. Anything else --- a gradient, a custom
 * property, a background inherited from an ancestor --- is outside what a
 * source-level check can see; that's still a real risk, just not this sensor's.
 */
function colocatedPairs(): { selector: string; color: string; background: string }[] {
  const pairs: { selector: string; color: string; background: string }[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(CSS))) {
    const [, selectorRaw, body] = match;
    const color = /(?:^|;|\s)color:\s*(#[0-9a-fA-F]{6})\s*;/.exec(body!);
    const background = /(?:^|;|\s)background(?:-color)?:\s*(#[0-9a-fA-F]{6})\s*;/.exec(body!);
    if (color && background) {
      pairs.push({ selector: selectorRaw!.trim(), color: color[1]!, background: background[1]! });
    }
  }
  return pairs;
}

const PAIRS = colocatedPairs();

// Skipped rather than passed vacuously when nothing co-locates yet --- an
// empty pass here would look like a clean bill of health it hasn't earned.
describe.skipIf(PAIRS.length === 0)(
  "contrast: colour/background pairs declared together in global.css",
  () => {
    for (const { selector, color, background } of PAIRS) {
      it(`${selector} clears ${FLOOR}:1 (${color} on ${background})`, () => {
        const ratio = contrast(hexToRgb(color), hexToRgb(background));
        expect(
          Number(ratio.toFixed(2)),
          `${selector} is ${color} on ${background} = ${ratio.toFixed(2)}:1.`,
        ).toBeGreaterThanOrEqual(FLOOR);
      });
    }
  },
);
