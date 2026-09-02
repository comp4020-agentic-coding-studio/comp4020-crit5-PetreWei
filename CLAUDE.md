# COMP4020 prototype

This is a static site in HTML, CSS and TypeScript, built to plain HTML, CSS and JS, and deployed to GitHub Pages. The deployed site is what gets marked, not this repo. A marker drives it in Chrome at 1920x1080 and 390x844, by keyboard alone, Tab order, arrow keys, Enter or Space, as readily as by mouse. None of that shows up in a green `vitest` run.

The course site publishes each deliverable's brief (the open problem) and spec (the fixed contract). This repo's name tells you which applies. Run the course plugin's **start** skill each week to fetch the spec and turn its checkable lines into tests. Read the brief and spec before building.

## How to work in here

- Run `pnpm check` before changing anything, not only after. A red baseline means the failure isn't yours to fix.
- Keep `pnpm dev` running for the fast loop, but trust nothing you haven't seen on `pnpm build && pnpm preview`.
- Open the page in a browser, or use `agent-browser`, rather than imagining it. The rendered page is the truth.
- A red check is a sensor doing its job. Read it before changing anything. Never weaken a check just to reach green.
- The cheapest recovery wins: `Esc` to interrupt, `/rewind` to undo in-session, `git revert` once committed.
- Commit only when checks pass.
- Markdown paragraphs are one line each, with no hard wrap. A rewrap diffs every line and buries the sentence that changed.
- **Push every commit as you make it, without asking.** When `pnpm check` is green, commit, then push, never force. Stage files by name, then read the CI run, since a local green is not a green deploy.

## The link-preview card

`public/card.png` (1200x630) is what a shared link shows. `src/layouts/Layout.astro` is the one place that points at it, so replace the image and pass a `description` prop instead of copying a head block per page. Nothing in CI checks the card, so the deployed head is the only place a broken one shows up.

## The checks (your sensors)

`pnpm check` runs typecheck, build and the spec tests. CI adds `check:evidence`, links, secrets and the deploy. Green checks fifteen minutes after the crit cutoff are worth half the week's shipped mark. Still running counts as not green.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` say what they're for.

## Rules from a specific failure

- **The workflow file is harness, not spec, but treat it conservatively.** `.github/workflows/` is yours to edit only when a check has drifted from what the initial commit's version actually verified — diff against that commit to see what changed and why — and only enough to restore the original intent. Never touch it to relax a check that verifies something the spec requires.
- **Verify against the built site, not the dev server.** A stray `astro dev` once made a whole check pass by reading the dev server, toolbar included. Read the port `astro preview` actually prints, since it moves to 4322 if 4321 is taken. `ASTRO-DEV-TOOLBAR` in the tab order is the tell.
- **Never show a plausible-looking guess.** Fail visibly, or show nothing.
- **Measure before claiming an outcome.** "Make it readable" invites an eyeballed diff. Get the numbers first.
- **JSDOM can't run client scripts or lay out the page.** Keep logic DOM-free and unit-test it directly. Verify anything visual or interactive by hand in a browser.
- **A recurring correction belongs in a sensor, not here.** This list is read on every turn, so keep it short. Add a check instead of a longer rule.
- **A stuck automated test is evidence to investigate, not a verdict on the app.** A keyboard-only Playwright round once looked stuck; the app was fine and the script's assumptions were wrong. Check the test's assumptions against the app's actual behaviour before trusting a red result.

## This file is yours

Not a rulebook. Write down what you learn as you go.
