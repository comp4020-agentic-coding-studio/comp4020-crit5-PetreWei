# COMP4020 prototype

This is a static site written in HTML, CSS and TypeScript. It builds to plain HTML, CSS and JS and deploys to GitHub Pages. **The deployed site is what gets marked** — not this repo, and not "it works on my machine". A marker opens the live URL in Chrome at two sizes, 1920×1080 (desktop) and 390×844 (phone), and drives it by keyboard alone — Tab order, arrow keys, Enter/Space — as readily as by mouse. All three count in full, and none of them show up in a green `vitest` run.

The course website publishes each deliverable's brief (the open problem) and spec (the fixed contract); this repo's name tells you which applies. Run the course plugin's **start** skill at the beginning of each week — it fetches the right spec and helps turn its checkable lines into tests. Read the brief and spec before planning or building.

## How to work in here

- Keep `pnpm dev` running for the fast loop, but trust nothing you haven't seen on `pnpm build && pnpm preview`.
- Open the page in a browser (or use `agent-browser`) rather than imagining it. The rendered page is the truth; your mental model of it isn't.
- A red check is a sensor doing its job: read what it says before changing anything, and never weaken a check just to reach green.
- Commit when checks pass. Never commit a red state.
- Markdown paragraphs are one line each — no hard wrap at 80 columns. Nothing here reformats prose, so a rewrap shows as a diff on every line of a paragraph and buries the sentence that actually changed.
- **Push every commit as you make it, without asking.** An unpushed commit is work that doesn't count. `pnpm check` green → commit → push, never force. Read `git status` and stage by name — this repo is public and a push is permanent — then read the CI run, because a local green is not a green deploy.

## The link-preview card

`public/card.png` (1200×630) is what a shared link shows. `src/layouts/Layout.astro` is the one place that points at it, so every page that uses the shared layout gets the card for free — replace the image and pass a `description` prop, rather than copying a head block per page. The card URL resolves against the deployed page, like any link, and nothing in CI checks it, so the deployed head is the only place a broken one shows up.

## The checks (your sensors)

`pnpm check` runs typecheck, build and the spec tests; CI repeats that plus `check:evidence`, links, secrets and the deploy. Green checks fifteen minutes after your crit's cutoff are worth half the week's shipped mark — still running counts as not green.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and say what they're for.

## Rules that came from a specific failure

- **Never edit `.github/workflows/`.** It's the sensor this work has to satisfy, not part of the work. If a check fails for a reason outside the repo, remove the dependency instead.
- **Verify against the built site, not the dev server.** A stray `astro dev` holding the port once made a whole "verification" pass read the dev server by accident, toolbar included. Read the port `astro preview` actually printed — it silently moves to 4322 when 4321 is taken — and assert the tab order, because `ASTRO-DEV-TOOLBAR` in it is the tell.
- **Never show a plausible-looking guess.** A fallback that looks like the real answer is worse than an obvious failure — fail visibly, or show nothing.
- **When asked for an outcome, measure first.** "Make it readable" invites a diff approved by eye. Get the numbers before the diff.
- **JSDOM can't run client scripts or lay out the page.** Keep logic DOM-free and unit-test it directly; check the built HTML for what the script needs to find; verify anything visual or interactive by hand in a real browser.
- **A correction that keeps repeating belongs in a sensor, not in this file.** Every line here is read on every turn and competes for attention with the task, so a rule that is always on is easy to stop seeing. The dev-server rule above was already written when it got broken again, and an assertion — not the rule — is what caught it. When a mistake recurs, add the check that fires on it and keep this list short enough to still be read.
- **A stuck automated interaction is evidence to investigate, not a verdict on the app.** A keyboard-only Playwright round once looked permanently stuck after one blocker; the app was fine — the script assumed stage 1 needed one blocker instead of two, and didn't know the hint deliberately withholds the winning cell on the last placement. Check the script's assumptions against the app's actual state before believing the artefact is broken.

## This file is yours

Not a rulebook — as you learn what this prototype needs, write it down here. The gap between the boilerplate and your own version is part of what gets read.
