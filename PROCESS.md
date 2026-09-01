# Process overview

A reading-guide to how the work came together --- a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

**Detour**, a maze-blocker puzzle: a runner is already loose in a fixed maze
and you spend a small, visible budget of blockers to seal its route before it
reaches the exit. There's no wall-building race against a moving target ---
setup and run are separate phases, so a stage's difficulty is a single
measurable question (can this many blockers push every route past this much
stamina), and ten stages ramp that question from a floor anyone clears on the
first try to one that needs real search. No tutorial appears anywhere; the
board's own visuals (a shrinking stamina disc, an exit drawn as a breach in
the wall, both endings left standing on the board) do the teaching a caption
would otherwise have to do.

## The moments that mattered

1. **The clock and the building were the same rule.** The first working
   version had you tapping cells to grow walls in real time while the runner
   walked, and each tap also cost it a step --- so difficulty could only be
   tuned by feel. Instead of adding more mazes to that loop, I split it into a
   setup phase (spend a fixed budget) followed by an automatic run, which
   turns "is this stage fair" into a countable question. I checked it by
   enumerating every legal placement of blockers on each maze, scoring the
   winning share, and tuning stamina to land on an explicit ramp (21.8% down
   to 1.0% across the stages) --- then added a test asserting every shipped
   stage is actually solvable within its budget, so "feels harder" became a
   number `pnpm check` verifies.
   [`3d16c9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-PetreWei/commit/3d16c9a)

2. **Playing it found the board could be read backwards.** With a token, a
   dotted route and a way out, nothing stopped a first look from reading
   "escort it to the exit" instead of "trap it" --- the opposite of the point,
   under which winning looks like losing. The brief and the repo's own
   no-tutorial test rule out fixing that with a caption, so I changed only
   what the board shows: stamina drawn as a shrinking fraction of a whole
   thing (a weakening runner reads as winning; a counting number reads as a
   score), the exit redrawn as a breach punched through the frame rather than
   a green prize square, and both endings left visible on the board instead of
   vanishing. I knew it landed because handing the built game to someone cold
   got the read right --- "contain it" --- before their first placement.
   [`0564aff`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-PetreWei/commit/0564aff)

3. **A hint the game gave you is not the same as a hint you asked for.** I'd
   added a cell glow that appeared unprompted after four straight losses, to
   keep a no-tutorial game legible without a word of text. Losing a few
   streaks myself made the problem obvious: a hint the game volunteers
   undercuts the very "no tutorial" spirit it exists to protect. I reworked it
   into a quiet corner button the player has to press, wired to the same
   solved sequence, and confirmed it only ever appears during setup and
   renders the same at both viewports --- a design correction made from
   playing my own game, not from a bug report.
   [`dbeacb4...86f0a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-PetreWei/compare/dbeacb4...86f0a01)

4. **Keyboard was the surface 57 green tests never touched.** Reading
   lecture 5's "drive the artefact like a marker" against the live deploy
   found a real gap: the board had a click handler and nothing else, so a
   marker without a mouse could reach Start and Show solution (native buttons
   get that for free) but could never place a single blocker. I added a
   roving-tabindex cursor --- one Tab stop for the whole grid, arrow keys move
   it, Enter/Space activates it --- rather than one Tab stop per cell, which
   would make a board this size unusable to tab through. Verifying it with a
   real keyboard-only Playwright round caught a second, smaller lesson: the
   round looked permanently stuck after one blocker, and my first instinct was
   to suspect the app. It wasn't --- the script assumed the wrong number of
   blockers for stage 1 and didn't know the hint deliberately withholds the
   final cell. Fixing the script instead of the app, and reading that
   distinction straight out of lecture 5's own "a failed automated interaction
   is evidence to investigate, not a conclusion about the artefact," is now a
   line in `CLAUDE.md` rather than a one-off save.
   [`19f1ca4`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-PetreWei/commit/19f1ca4)

   > Please read `~/4020/lecture-notes` and improve current project based on
   > it, especially on `lecture-05.md`.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
