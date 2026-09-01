# Crit 5 reflection

**What was the breakthrough that moved the work forward?**

Reading lecture 5's "drive the artefact like a marker" against my own
deployed game rather than against its test suite. Fifty-seven passing tests
said nothing about whether the game could be played without a mouse, and it
turned out it couldn't --- the board only had a click handler. That check was
cheap to run and immediately falsified my belief that "green tests" meant
"done." A smaller version of the same lesson showed up while verifying the
fix: an automated keyboard round looked permanently stuck, and my first
instinct was to suspect the app. It wasn't --- my test script assumed the
wrong number of blockers and didn't know a hint deliberately withholds the
final move. Treating that stuck script as something to investigate, rather
than something to patch around, is the habit the lecture was actually asking
me to build.

**What did this work change about who I want to be as a software developer?**

I used to treat "the tests pass" and "I looked at it in a browser" as
roughly the same strength of evidence. They aren't. A test suite only checks
what someone thought to write down, and a screenshot only shows what I
thought to look at; the artefact itself --- Tab order, arrow keys, a stage
that's genuinely unwinnable the way I meant it to be --- will happily show me
what neither anticipated. I want to be the kind of developer who treats a
green check as a floor, not a finish line, and who is honestly suspicious of
their own verification tooling before they're suspicious of the code it's
testing.
