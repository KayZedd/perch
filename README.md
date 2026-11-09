<p align="center">
  <img src="extension/icons/perch.svg" width="112" alt="Perch logo">
</p>

<h1 align="center">Perch</h1>

<p align="center">
  A warm-paper reskin for <b>Thunderbird</b> and <b>Betterbird</b>,<br>
  with editable palettes and a few small mail features that earn their place.
</p>

<p align="center">
  <a href="https://github.com/KayZedd/perch/actions/workflows/test.yml"><img alt="tests" src="https://github.com/KayZedd/perch/actions/workflows/test.yml/badge.svg"></a>
  <a href="https://github.com/KayZedd/perch/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/KayZedd/perch?color=b9502a"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-2a251d"></a>
  <img alt="Thunderbird 140 to 153" src="https://img.shields.io/badge/Thunderbird-140%E2%80%93153-5d7d5e">
  <img alt="Betterbird 153" src="https://img.shields.io/badge/Betterbird-153-5d7d5e">
</p>

<p align="center">
  <img src="https://github.com/KayZedd/perch/releases/download/v0.1.0/1-light.png" width="49%" alt="Perch, light theme">
  <img src="https://github.com/KayZedd/perch/releases/download/v0.1.0/2-dark.png" width="49%" alt="Perch, dark theme">
</p>

## Why Perch

Floating rounded panes, a dock for your spaces, calm cards for messages, light and dark, no gradients. Every feature has an off switch,
nothing phones home, and the whole thing is a few hundred lines of readable CSS and JavaScript.

> Not affiliated with or endorsed by the Thunderbird or Betterbird projects.
> Tested on Thunderbird 140.17.0 ESR, Thunderbird 153.6.0 ESR and Betterbird 153.6.0 ESR-bb12 (theme, sender initials, attachment preview, snooze round trip).
> Declared range: 140 to 153.x. Experiments are tied to the application version, so later versions are not claimed until tested.

## What you get

<table>
  <tr>
    <td width="50%" valign="top">
      <b>Theme</b><br>
      Folder pane, message list, message pane, compose, address book, calendar, chat, tabs and menus, restyled as one piece.
    </td>
    <td width="50%" valign="top">
      <b>Palettes</b><br>
      Paper, Graphite, Ink, or your own: pick background, panes, text and accent for light and dark; the rest is derived and contrast-checked. Share as JSON.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>Snooze</b><br>
      Header button. Moves the mail to a <code>Snoozed</code> folder in its account and brings it back, unread, at the time you pick.
    </td>
    <td valign="top">
      <b>Unsubscribe</b><br>
      Same button, only on mailing-list mail. Opens the sender's page or prepares a draft. Never sends anything itself.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>Sender initials</b><br>
      A coloured circle with initials on every message card.
    </td>
    <td valign="top">
      <b>Attachment preview</b><br>
      Hover the paperclip on a row to see file names and sizes.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>Messages from this sender</b><br>
      Right-click a message. One page with everything from that address.
    </td>
    <td valign="top">
      <b>Account colours</b><br>
      Tints each account in the folder pane and marks it on messages in multi-account lists.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>Reading typography</b><br>
      Plain-text mail only: serif, 72-character column, palette colours. HTML mail is untouched.
    </td>
    <td valign="top">
      <b>Backup</b><br>
      Export and import every setting as one JSON file.
    </td>
  </tr>
</table>

<p align="center">
  <img src="https://github.com/KayZedd/perch/releases/download/v0.1.0/3-snooze.png" width="49%" alt="Snooze popup">
  <img src="https://github.com/KayZedd/perch/releases/download/v0.1.0/4-attachments.png" width="49%" alt="Attachment preview">
</p>

Settings: Add-ons and Themes, Perch, Options.

## Install

1. Download `perch-0.1.0.xpi` from the [latest release](https://github.com/KayZedd/perch/releases/latest).
2. In the app: Add-ons and Themes, gear icon, **Install Add-on From File**, pick the file.

Perch restyles the application window, which needs an Experiment API, so the app will say the add-on has "full, unrestricted access".
See [Why an Experiment](#why-an-experiment) and [PRIVACY.md](PRIVACY.md). Uninstall in Add-ons and Themes; everything reverts
(the `Snoozed` folders stay, move the mail out first).

From source (Linux or macOS, Node 22 and `zip`): `node tools/package.mjs`, then install `dist/perch-<version>.xpi` the same way.
`tools/install.sh <profile-dir>` copies it into a profile for you (close the app first). Details in [BUILDING.md](BUILDING.md).

## Privacy

No telemetry, no accounts, no servers of its own. Settings and the snooze list live in the add-on's local storage.
The unsubscribe button opens a link or a draft only when you press it. Hovering a paperclip may fetch that one message over your
existing mail connection, as opening it would. Full text in [PRIVACY.md](PRIVACY.md).

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

## Build

See [BUILDING.md](BUILDING.md) (Node 22, `zip`, `node tools/package.mjs`, no dependencies).

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
