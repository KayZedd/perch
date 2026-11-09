# Text for the addons.thunderbird.net submission (0.1.0)

Paste into the matching ATN fields. Privacy policy field: paste the full text of `PRIVACY.md`.

## Summary (max 250 characters)

A warm-paper reskin for Thunderbird and Betterbird with editable palettes, plus snooze, one-click unsubscribe, sender initials, attachment preview and account colours. Every feature has an off switch.

## Description

Perch restyles Thunderbird and Betterbird with floating rounded panes, a dock-style spaces bar, card message rows and flat buttons, in light and dark. Settings: Add-ons and Themes, Perch, Options.

What it does, completely:

- Restyles the whole application window (folder pane, message list, message pane, compose, address book, calendar, chat, tabs, menus). Switchable off: the app returns to its normal look.
- Palettes: Paper, Graphite, Ink and your own (pick four colours per light and dark scheme). Accent colour and density options. Export and import of all settings as a JSON file.
- Account colours: tints each account in the folder pane and marks it on messages in multi-account lists.
- Sender initials: a coloured circle with initials on each message card.
- Attachment preview: hover the paperclip on a message row to see file names and sizes.
- Reading typography: serif, 72-character column and palette colours for plain-text mail only. HTML mail is not changed.
- Snooze: a button in the message header. The message moves to a folder called "Snoozed" in the same account and returns, unread, at the time you pick.
- Unsubscribe: in the same button's popup, only for messages with a List-Unsubscribe header. It opens the sender's page in your default browser or prepares an email draft for you to send. It never sends anything itself.
- Messages from this sender: a context-menu entry and a button that open a page listing everything from that address.

Changes made without asking: none. Everything above is on by default because it is the purpose of the add-on, and each part can be switched off in the options. Perch makes no network requests of its own, collects nothing and has no telemetry.

Perch needs an Experiment API to apply the stylesheet to the application window; the app will show its "full access" warning for that reason.

Tested on Thunderbird 140.17.0 ESR, Thunderbird 153.6.0 ESR and Betterbird 153.6.0 ESR.

## Version notes (0.1.0)

First public release. Warm-paper theme, editable palettes, account colours, sender initials, attachment preview, reading typography, snooze, one-click unsubscribe, messages-from-sender page, per-feature switches, settings backup.

## Notes to reviewer

No account or credentials are needed.

**Why an Experiment.** Reshaping the application's own windows needs CSS injected into chrome documents, which WebExtension themes cannot do. `api/perch/implementation.js` does four things only:
1. registers one stylesheet through `nsIStyleSheetService` (AGENT_SHEET, as a data: URL because moz-extension:// sheet URLs are ignored for chrome documents; `tools/build.mjs` makes every declaration `!important` and scopes every selector under `:root[lightweightthemes]` so mail and web content are untouched),
2. adds a sender-initials circle to message-list rows (MutationObserver on about:3pane),
3. on hover of the paperclip, reads that message's attachment names and sizes with `MsgHdrToMimeMessage` and shows a popover,
4. lists incoming server keys and names for the account colours.
It makes no network calls and `onShutdown` removes the stylesheet, observers and injected nodes. `strict_max_version` is `153.*` because the DOM it touches is version specific.

**How to test (about 3 minutes).**
1. Install. The window is restyled immediately.
2. Add-ons and Themes, Perch, Options: toggle features and palettes (changes apply live); create a palette with "+ New palette".
3. Select a message: the header shows a "Snooze or unsubscribe" button. Choose "Later today": the message moves to a "Snoozed" folder in its account. (Wake-up comes back after the chosen time, unread.)
4. Right-click a message, "Messages from this sender".
5. Hover a paperclip on a message with an attachment.
6. A message with a List-Unsubscribe header shows an Unsubscribe row in the popup; it opens a link or a draft only when pressed.

**Source and build.** `perch-source-0.1.0.zip` (also https://github.com/KayZedd/perch, tag v0.1.0). Node 22, `zip` installed. Run `node tools/package.mjs`; it writes `dist/perch-0.1.0.xpi`. I checked that this reproduces the submitted package's contents exactly (only zip timestamps differ). The one generated file is `extension/css/perch.css` (from `src/*.css` by `tools/build.mjs`); it is committed. Development-only hooks are fenced with `// DEV-BEGIN` / `// DEV-END` and removed by `tools/package.mjs` (a test fails if any remain). No minified or obfuscated code.

**Permissions.** storage, alarms (snooze wake-up), accountsRead and accountsFolders (find or create the Snoozed folder), messagesRead, messagesMove, messagesUpdate (snooze, sender page), messagesModify (reading typography in the message pane), compose (unsubscribe draft), menus (context-menu entry). Details in PRIVACY.md.
