# Changelog

## Unreleased

- Snooze: a wake finishing while a new snooze was saved could drop the new entry; both now run through one queue.
- Snooze: a failing wake (server offline, folder gone) retried every second; now once a minute.
- Snooze: a failing theme apply at startup no longer skips scheduling and waking snoozed mail.
- Attachment preview: sizes just under a unit roll over ("1 MB", not "1024 KB"); long emoji names no longer break.
- Unsubscribe: "+" in a mailto subject or body stays a plus.
- Sender page: shows the newest 500 of up to 5000 matches, not an arbitrary 500; the cap notice now appears.
- List enhancements: closed mail tabs are released; hover no longer leaves stale attachment parsers running.
- Snooze: a woken message is marked unread even when the folder lists the moved message late (IMAP); retried once a minute for up to 5 minutes.

## 0.1.0

First public release.

- Warm-paper theme: panes, spaces dock, message cards, compose, address book, calendar, chat. Light and dark.
- Palettes: Paper, Graphite, Ink and user-made palettes (with contrast checks and JSON sharing), accent override, density.
- Account colours, sender initials, attachment preview, reading typography for plain-text mail.
- Snooze, one-click unsubscribe, "messages from this sender" page.
- Per-feature switches and a settings export/import.
