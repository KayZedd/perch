# Perch privacy policy

Perch does not collect, transmit or share any data.

**What Perch stores.** In the add-on's local storage on your computer: your settings (palette, colours, switches, account colour
choices) and, if you use Snooze, a list of snoozed messages (message id, subject, folder ids, wake-up time). Nothing leaves the computer.
Uninstalling the add-on removes it.

**What Perch reads.** To do what you ask, it reads message headers and folder names through Thunderbird's own APIs:
sender and subject (list and sender page), the `List-Unsubscribe` headers (unsubscribe button), attachment names and sizes
(attachment preview), account names (account colours). This happens locally and only for the features you leave switched on.

**What Perch changes.** It restyles the application window. Snooze moves a message to a `Snoozed` folder in the same account and moves it back;
it marks the message unread when it returns. Perch never deletes messages.

**Network.** Perch makes no network requests of its own. The unsubscribe button either opens the link from the message in your
default browser or prepares an email draft that you review and send yourself. Moving mail on an IMAP account uses your existing account connection like any other move. Likewise, hovering the paperclip in the attachment preview may fetch that one message from your mail server over the existing connection if it is not stored offline.

**Permissions.** `storage`, `alarms` (snooze wake-up), `accountsRead` and `accountsFolders` (find or create the `Snoozed` folder),
`messagesRead`, `messagesMove`, `messagesUpdate` (snooze and sender page), `messagesModify` (reading typography in the message pane),
`compose` (unsubscribe draft), `menus` (the "Messages from this sender" entry). The bundled Experiment API gives Thunderbird's full
privileges; it is used only to register the stylesheet, add the initials and attachment popover to the message list, and read account names.
The source is in this repository.

**Contact.** Open an issue in the repository.
