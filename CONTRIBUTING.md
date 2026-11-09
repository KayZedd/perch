# Contributing

Bug reports with a screenshot and the Thunderbird/Betterbird version are the most useful thing. For code:

1. `node --test` must pass (about a second, no browser needed).
2. Edit CSS in `src/` only, flat (no nesting), then `node tools/build.mjs`. Never hand-edit `extension/css/perch.css`.
3. Pure logic goes in `extension/lib/` with tests next to the others in `tests/`. Keep browser APIs out of it.
4. A UI change needs a screenshot from `dev/shot.sh` in both light and dark.
5. A change to `background.js` or the Experiment API needs `dev/selftest.sh` to print `PASS`.
6. Do not add one-sided borders, `box-shadow: inset` stripes, network calls or new permissions without an issue first.
7. Keep dev-only code inside `// DEV-BEGIN` / `// DEV-END`; the release build strips it.

Commit messages: imperative mood, one change per commit.
