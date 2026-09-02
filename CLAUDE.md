# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site is what gets marked, not this repo.

The [course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/) publishes this deliverable's brief and spec, and this repo's name tells you which deliverable applies. Read both before you plan or build.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s head points at it. Replace it and the `description` meta, and copy the head block into any new page. The card URL resolves against the page that names it, like any link --- `./card.png` is wrong one directory down, and nothing in CI checks it, so the deployed head is the only place a broken one shows up.

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you ship. CI runs the same plus links, secrets and the deploy.

A local pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) blocks any commit that looks like it contains an API key. It's the sensor that actually matters for secrets --- CI's scan only sees a key after it's already pushed.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and say what they are for.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the harness is assessed. This file and the sensors you wire into `check` carry across the course --- both come with you into next week's repo. The prototype doesn't: source, and the tests answering this week's published spec, stay behind. `spec/README.md` draws the line.

## Working practices

- **Start each week with the `start` skill.** It fetches the spec and turns its checkable lines into tests.
- **Argue with the plan before building.** Ask the agent what's ambiguous, what it assumed, what it missed, and which choice the spec requires versus merely prefers.
- **Check the baseline first.** Run `pnpm check` before changing anything; a red baseline means the failure isn't yours to fix.
- **Run the CI-only checks yourself while the repo is private.** Links, secrets and the deploy only run once the repo is public; run `pnpm dlx linkinator ./dist --silent` against a fresh `pnpm build` to catch broken links sooner.
- **Look at the rendered page.** Open it in a browser, or use `agent-browser`, rather than reasoning about it from source.
- **Treat a red check as correct until proven otherwise.** Read it before changing anything, and never weaken a check to reach green.
- **Reproduce before fixing.** For a bug found by hand, add a failing test first, confirm it fails for the right reason, then fix.
- **Keep output pristine.** Leave no ignored errors, warnings, or backtraces in logs.
- **Never rewrite the spec to match the build.** A disagreement between them is a decision to flag, not a diff to resolve quietly.
- **Use the cheapest recovery available.** `Esc` interrupts, `/rewind` undoes in-session, `git revert` undoes a commit.
- **Write one-line paragraphs.** A hard-wrapped rewrap diffs every line and buries the sentence that changed.
- **Lint Markdown before committing it.** Run `markdownlint-cli2 "**/*.md"`; `.markdownlint-cli2.jsonc` disables `MD013` (one-line paragraphs are the convention here, not a violation) and ignores `node_modules` and `dist`.
- **Commit small and often.** The commit trail is evidence of process, not just the final diff; a single dump before the deadline is the weakest version of it.
- **Commit only on green, then push immediately.** Stage files by name, never force, and read the CI run afterward — a local green is not a green deploy.

## Stack notes

**The card moved.** This repo builds with Astro; the link-preview plumbing above now lives in `src/layouts/Layout.astro`, which points at `card.png` for every page. Replace the image and pass a `description` prop, rather than copying a head block per page.

## Grading conditions

- **Markers test conditions no test suite covers.** They drive the deployed site in Chrome at 1920×1080 and 390×844, by keyboard alone — Tab order, arrow keys, Enter or Space — as readily as by mouse.
- **Grading is time-boxed.** Checks must be green fifteen minutes after the crit cutoff; a check still running counts as not green.
- **Green does not mean good.** A passing suite establishes only what it checks. Qualities like playability or coherence need a person — before calling a change done, show it to someone who has not seen it before.
- **A green accessibility or performance check is a lab estimate, not proof.** It reflects one run on one machine, not real users.

## Lessons from failures

- **Workflow files are harness, not spec.** Edit `.github/workflows/` only to restore a check that drifted from the initial commit's intent — diff against that commit first. Never weaken a check the spec requires.
- **Verify against the built site, not the dev server.** `astro preview` may run on a different port if 4321 is busy; read the printed port. `ASTRO-DEV-TOOLBAR` in the tab order means you tested the dev server by mistake.
- **Check the deployed URL, not just `pnpm preview`.** GitHub Pages serves the site under a subpath; a base-path or asset bug can look fine locally and only 404 once live.
- **Commit the updated lockfile after any dependency change.** CI installs with `--frozen-lockfile`, so a stale `pnpm-lock.yaml` breaks the build there even though it works locally.
- **Never show a plausible-looking guess.** Fail visibly, or show nothing.
- **Measure before claiming an outcome.** Get numbers before judging by eye.
- **JSDOM cannot run scripts or lay out pages.** Unit-test DOM-free logic directly; verify visual and interactive behaviour in a real browser.
- **A stuck automated test is evidence to investigate, not a verdict on the app.** Check the test's assumptions against the app's actual behaviour before trusting a red result.

## Maintaining this file

- **Delete, don't append.** Write down what you learn as you go, and remove anything here the moment it is stale or contradicted.
- **A recurring correction belongs in a sensor, not here.** Add a check instead of lengthening this list.
