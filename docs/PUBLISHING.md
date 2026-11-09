# Publishing Perch

Two routes. Betterbird has no add-on store of its own for third parties (its site hosts a few add-ons by its project leader);
Betterbird users install from addons.thunderbird.net (ATN) or from a file, like Thunderbird users.

## 1. GitHub release (works today, no review)

1. `node --test && dev/selftest.sh` must pass.
2. `node tools/package.mjs` produces `dist/perch-<version>.xpi`.
3. Tag and attach the xpi to a GitHub release: `git tag v<version> && git push origin v<version>`, then `gh release create v<version> dist/perch-<version>.xpi --notes-file CHANGELOG.md`.
4. Users install via Add-ons and Themes, gear, Install Add-on From File. Updates are manual.

Betterbird and Thunderbird accept unsigned add-ons from file. Verify that on your build; the author checked Betterbird 153.6.0esr-bb12
(`MOZ_REQUIRE_SIGNING` is off there).

## 2. addons.thunderbird.net (listed, signed, automatic updates)

Requirements from the [ATN review policy](https://thunderbird.github.io/atn-review-policy):

- **Experiments mean manual review.** Expect a delay and questions. Keep the Experiment small and explain it in the notes (it registers a stylesheet,
  injects initials and a popover into the message list, lists account names).
- **Human-readable source and build steps.** The xpi contains readable JS, but `extension/css/perch.css` is generated. Upload a source archive
  (`git archive --format=zip -o perch-source.zip HEAD`) and write: "Node 22. `node tools/package.mjs` rebuilds the xpi byte-for-byte except zip timestamps."
- **Privacy policy field must contain the full text**, not a link: paste `PRIVACY.md`. Put a short summary in the listing description.
- **Listing description** must say everything the add-on does: restyles the whole window, adds a header button, adds a context-menu entry, creates a `Snoozed` folder, opens links on request.
- **Testing notes** for the reviewer: "Install, open Settings tab Perch, toggle features. Snooze: select a message, header button, choose a time; it moves to `Snoozed` and returns unread."
- **Name.** Perch avoids the Thunderbird trademark. Check availability when you create the listing; the author's search found no existing add-on with that name.
- **Screenshots** (ATN asks for them): `dev/shot.sh` produces them; store them outside git.
- Add-on id is `perch@kayzedd`. It cannot change after the first upload.

## Before every release

1. Update `version` in `extension/manifest.json` and add a `CHANGELOG.md` entry.
2. `node --test`, `node tools/build.mjs` (commit the generated css), `dev/selftest.sh`.
3. `node tools/package.mjs`, install the resulting xpi in a throwaway profile, open the window once in light and dark.
