# Perch

A warm-paper reskin for Thunderbird and [Betterbird](https://www.betterbird.eu/), plus a handful of small
mail features. Light and dark, editable palettes, every feature has an off switch.

> Not affiliated with or endorsed by the Thunderbird or Betterbird projects.
> Tested on Thunderbird 140.17.0esr, Thunderbird 153.6.0esr and Betterbird 153.6.0esr-bb12 (theme, sender initials, attachment preview, snooze round trip). Declared range: 140 to 153.x. Experiments are tied to the application version, so later versions are not claimed until tested.

## What you get

| | |
| --- | --- |
| **Theme** | Floating rounded panes, dock-style spaces bar, card message rows, flat pill buttons, no gradients. Folder pane, thread pane, message header, compose window, address book, calendar, chat, tabs. |
| **Palettes** | Paper, Graphite, Ink, or your own: pick background, panes, text and accent for light and dark; the rest is derived and contrast-checked. Share as JSON. Accent override and three densities. |
| **Account colours** | Tints each account in the folder pane and marks it on messages in multi-account lists. |
| **Sender initials** | Coloured initials circle on each message card. |
| **Attachment preview** | Hover the paperclip on a row to see file names and sizes. |
| **Snooze** | Header button. Moves the mail to a `Snoozed` folder in its account and brings it back unread at the time you pick. |
| **Unsubscribe** | Same button, only on mailing-list mail. Opens the sender's page or prepares an email draft. Never sends anything itself. |
| **Messages from this sender** | Right-click a message (or use the header button). One page with everything from that address. |
| **Reading typography** | Plain-text mail only: serif, 72-character column, palette colours. HTML mail is untouched. |
| **Backup** | Export and import all settings as one JSON file. |

Settings: Add-ons and Themes, Perch, Options.

## Install

- From a release: download `perch-<version>.xpi`, then Add-ons and Themes, gear icon, Install Add-on From File.
- From source (Linux/macOS, needs Node 20+ and `zip`): `node tools/package.mjs`, then install `dist/perch-<version>.xpi` the same way.
  `tools/install.sh <profile-dir>` copies it into a profile for you (close the app first).

Perch needs an Experiment API to restyle the application window, so the app will warn that the add-on has
"full, unrestricted access". See [Why an Experiment](#why-an-experiment) and [PRIVACY.md](PRIVACY.md).

Uninstall: remove it in Add-ons and Themes. Everything reverts; the `Snoozed` folders stay (move the mail out first).

## Privacy

No telemetry, no accounts, no servers of its own. (Hovering a paperclip may fetch that one message over your existing mail connection, as opening it would.) Settings and the snooze list live in the add-on's local storage.
The unsubscribe button opens a link or a draft only when you press it. Full text in [PRIVACY.md](PRIVACY.md).

## Why an Experiment

A WebExtension theme can only recolour. Reshaping panes, spacing and radii needs CSS injected into the
application's own windows, which only a privileged Experiment API can do. Findings on Betterbird 153 that shaped the code:

| Attempt | Result |
| --- | --- |
| `USER_SHEET` / `AUTHOR_SHEET` via `nsIStyleSheetService` | ignored for chrome documents |
| sheet URL `moz-extension://...` | ignored |
| `data:` URL + `AGENT_SHEET` | applies |
| `@-moz-document`, `@media (-moz-is-chrome-doc)` in that sheet | do not match |

So `tools/` compiles the readable CSS in `src/` into one agent sheet: every declaration gets `!important`
(agent sheets lose to author rules otherwise) and every selector is scoped under `:root[lightweightthemes]`, which
application windows set and mail or web content never does. Source CSS must be flat (no nesting); the build fails
instead of emitting wrong output.

## Layout

```
src/*.css             readable source CSS (tokens, shell, mail, controls, spaces, compose, features)
tools/build.mjs       src -> extension/css/perch.css (generated, committed)
tools/important.mjs   !important + selector scoping
tools/package.mjs     release build: strips dev-only code, verifies, zips dist/perch-<version>.xpi
tools/install.sh      copy the xpi into a profile
extension/            manifest, background, Experiment API (api/perch), options, popup, sender page, lib/
extension/lib/        pure logic, no browser APIs, unit-tested in node
tests/                node --test
dev/                  screenshot harness and an end-to-end snooze self-test (not shipped)
docs/PUBLISHING.md    how to submit to addons.thunderbird.net
```

## Develop

```bash
node --test                       # gate tests, about 1 s
node tools/build.mjs                     # after editing src/
dev/selftest.sh                          # real snooze round trip in a throwaway profile, about 45 s
EXT=$PWD/extension EXTRA_PREFS='user_pref("mail.threadpane.listview", 0);' \
  ACTIONS='xdotool mousemove 700 210 click 1' dev/shot.sh /tmp/out.png dark    # screenshot, light or dark
```

`dev/shot.sh` builds a throwaway profile with sample mail (`dev/make_profile.py`), runs Betterbird on a private Xvfb,
loads the unpacked extension, runs optional `xdotool` steps and saves a screenshot. It never touches a real profile.
Run it sequentially. Needs `xvfb-run`, `xdotool` and ImageMagick `import`.

Code fenced with `// DEV-BEGIN` / `// DEV-END` is only for that harness; `tools/package.mjs` strips it and fails if any remains.

House rules, enforced by tests: no one-sided borders or inset-shadow stripes in any stylesheet; every generated declaration is `!important`;
every selector is scoped; every file referenced by a manifest or page exists; permissions are a fixed list.

## Known limits

- Sender initials and the attachment popover depend on Betterbird's internal message-card DOM (`.card-layout`, `.sender`,
  `.card-container`). If an update renames them those two features stop; nothing else breaks. Table view has neither.
- Snooze creates a `Snoozed` folder per account (a real server folder on IMAP). Wake-up can be about a minute late and needs the app running.
- The header button cannot be hidden by an add-on; with snooze, unsubscribe and sender page all off it is greyed.
- The compose editor and the message body are separate documents and keep their own colours.
- Context menus show square corners on setups without window transparency.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licence: [MIT](LICENSE).
