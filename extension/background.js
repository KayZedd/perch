// Orchestrates everything that is not pure CSS:
//  - builds and applies the theme (base css + palette/density/account overrides)
//  - registers the plain-text reading typography for message bodies
//  - snooze (move to a "Snoozed" folder, wake via alarm) and one-click unsubscribe
// Pure logic lives in lib/ and is unit-tested in node.
/* global PerchThemes, PerchUnsub, PerchSnooze, PerchSender */

const SNOOZE_FOLDER = "Snoozed";
const ALARM = "perch-wake";
let baseCss = null;
let avatarSource = null;
let attachSource = null;
let readingScript = null;

// Release builds have no browser.perch.log (stripped by tools/package.mjs): logging becomes a no-op.
const log = line => (browser.perch.log ? browser.perch.log(String(line)) : Promise.resolve()).catch(() => {});

async function loadSettings() {
  const { settings } = await browser.storage.local.get("settings");
  return PerchThemes.normalize(settings);
}

async function applyAll() {
  if (baseCss === null) {
    baseCss = await (await fetch(browser.runtime.getURL("css/perch.css"))).text();
  }
  avatarSource ??= await (await fetch(browser.runtime.getURL("lib/avatar.js"))).text();
  attachSource ??= await (await fetch(browser.runtime.getURL("lib/attach.js"))).text();
  const settings = await loadSettings();
  const f = settings.features;

  if (f.theme) {
    const accounts = await browser.perch.getAccounts();
    await browser.perch.apply(baseCss + "\n" + PerchThemes.buildThemeCss(settings, accounts));
  } else {
    await browser.perch.clear();
  }
  // Avatar and popover styling live in the theme sheet, so both need the theme.
  await browser.perch.setListFeatures({
    avatars: f.theme && f.avatars,
    attachments: f.theme && f.attachments,
    avatarSource,
    attachSource,
  });
  await syncMenus(f);

  if (readingScript) {
    await readingScript.unregister();
    readingScript = null;
  }
  const reading = PerchThemes.buildReadingCss(settings);
  if (reading) {
    readingScript = await browser.messageDisplayScripts.register({ css: [{ code: reading }] });
  }

  // The header button cannot be hidden by an extension; with both of its jobs off, grey it out.
  if (f.snooze || f.unsubscribe) {
    await browser.messageDisplayAction.enable();
    await browser.messageDisplayAction.setTitle({ title: "Snooze or unsubscribe" });
  } else {
    await browser.messageDisplayAction.disable();
    await browser.messageDisplayAction.setTitle({ title: "Perch (off)" });
  }
}

// ---- messages from this sender -------------------------------------------

async function syncMenus(features) {
  await browser.menus.removeAll();
  if (features.sender) {
    browser.menus.create({ id: "perch-sender", title: "Messages from this sender", contexts: ["message_list"] });
  }
}

function openSender(author) {
  const email = PerchSender.extractEmail(author);
  if (!email) {
    throw new Error("This message has no sender address");
  }
  return browser.tabs.create({ url: browser.runtime.getURL("sender/sender.html?author=" + encodeURIComponent(email)) });
}

browser.menus.onClicked.addListener(info => {
  if (info.menuItemId !== "perch-sender") {
    return;
  }
  const msg = info.selectedMessages?.messages?.[0];
  if (msg) {
    openSender(msg.author).catch(e => log("openSender " + e));
  }
});

// ---- snooze -------------------------------------------------------------

async function getSnoozed() {
  const { snoozed } = await browser.storage.local.get("snoozed");
  return Array.isArray(snoozed) ? snoozed : [];
}

const setSnoozed = list => browser.storage.local.set({ snoozed: list });

async function ensureSnoozeFolder(accountId) {
  const account = await browser.accounts.get(accountId);
  const subs = await browser.folders.getSubFolders(account.rootFolder, false);
  return subs.find(f => f.name === SNOOZE_FOLDER) ?? browser.folders.create(account.rootFolder, SNOOZE_FOLDER);
}

async function findByHeaderId(folder, headerMessageId) {
  const page = await browser.messages.query({ folderId: folder.id, headerMessageId });
  return page.messages[0] ?? null;
}

async function snoozeMessage(messageId, wakeAt) {
  if (!PerchSnooze.isValidWake(wakeAt, new Date())) {
    throw new Error("Snooze time must be in the future");
  }
  const msg = await browser.messages.get(messageId);
  const origin = msg.folder;
  if (!origin) {
    throw new Error("Message has no folder");
  }
  if (origin.name === SNOOZE_FOLDER && origin.path === "/" + SNOOZE_FOLDER) {
    throw new Error("Message is already snoozed");
  }
  const target = await ensureSnoozeFolder(origin.accountId);
  await browser.messages.move([messageId], target.id);
  const list = await getSnoozed();
  list.push({
    headerMessageId: msg.headerMessageId,
    subject: msg.subject,
    originId: origin.id,
    snoozeId: target.id,
    wakeAt,
  });
  await setSnoozed(list);
  await scheduleAlarm();
  await log(`snoozed ${msg.headerMessageId} until ${new Date(wakeAt).toISOString()}`);
}

async function scheduleAlarm() {
  await browser.alarms.clear(ALARM);
  const list = await getSnoozed();
  if (!list.length) {
    return;
  }
  const next = Math.min(...list.map(e => e.wakeAt));
  // Alarms fire no earlier than ~1 minute out in practice; overdue ones run via processDue.
  browser.alarms.create(ALARM, { when: Math.max(next, Date.now() + 1000) });
}

async function processDue() {
  const list = await getSnoozed();
  const due = PerchSnooze.dueEntries(list, new Date());
  const keep = list.filter(e => !due.includes(e));
  for (const e of due) {
    try {
      const snoozeFolder = await browser.folders.get(e.snoozeId);
      const msg = await findByHeaderId(snoozeFolder, e.headerMessageId);
      if (msg) {
        await browser.messages.move([msg.id], e.originId);
        const back = await findByHeaderId(await browser.folders.get(e.originId), e.headerMessageId);
        if (back) {
          await browser.messages.update(back.id, { read: false });
        }
        await log(`woke ${e.headerMessageId}`);
      } else {
        await log(`snoozed message gone, dropping ${e.headerMessageId}`);
      }
    } catch (err) {
      // Folder deleted or server offline: keep the entry and retry on the next alarm.
      await log(`wake failed for ${e.headerMessageId}: ${err}`);
      keep.push(e);
    }
  }
  await setSnoozed(keep);
  await scheduleAlarm();
}

// ---- unsubscribe ---------------------------------------------------------

async function unsubscribe(messageId) {
  const full = await browser.messages.getFull(messageId);
  const first = name => full.headers[name]?.[0];
  const r = PerchUnsub.parse(first("list-unsubscribe"), first("list-unsubscribe-post"));
  if (r.https) {
    await browser.windows.openDefaultBrowser(r.https);
    return { opened: "https" };
  }
  if (r.mailto) {
    await browser.compose.beginNew({ to: r.mailto.to, subject: r.mailto.subject, body: r.mailto.body });
    return { opened: "mailto" };
  }
  throw new Error("No usable List-Unsubscribe target");
}

// ---- wiring --------------------------------------------------------------

browser.runtime.onMessage.addListener(async msg => {
  switch (msg?.type) {
    case "snooze":
      await snoozeMessage(msg.messageId, msg.wakeAt);
      return { ok: true };
    case "unsubscribe":
      return unsubscribe(msg.messageId);
    case "sender":
      await openSender(msg.author);
      return { ok: true };
    default:
      return undefined;
  }
});

browser.alarms.onAlarm.addListener(a => {
  if (a.name === ALARM) {
    processDue().catch(e => log("processDue " + e));
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) {
    applyAll().catch(e => console.error("Perch: apply failed", e));
  }
});

// DEV-BEGIN
async function selfTest() {
  // Drives the real snooze round trip against whatever is in the first Inbox found.
  // The folder tree is populated lazily at startup: poll until the Inbox shows up.
  let inbox = null;
  for (let i = 0; i < 40 && !inbox; i++) {
    for (const a of await browser.accounts.list()) {
      const subs = await browser.folders.getSubFolders(a.rootFolder, false);
      inbox ??= subs.find(f => f.type === "inbox" || f.name === "Inbox");
    }
    if (!inbox) await new Promise(r => setTimeout(r, 500));
  }
  if (!inbox) throw new Error("SELFTEST: no Inbox found");
  let page = await browser.messages.query({ folderId: inbox.id });
  for (let i = 0; i < 40 && !page.messages.length; i++) {
    await new Promise(r => setTimeout(r, 500));
    page = await browser.messages.query({ folderId: inbox.id });
  }
  const m = page.messages.find(x => x.read) ?? page.messages[0];
  if (!m) throw new Error("SELFTEST: Inbox has no messages");
  await log(`SELFTEST start message=${m.headerMessageId}`);
  await snoozeMessage(m.id, Date.now() + 1500);
  const snoozeFolder = await ensureSnoozeFolder(inbox.accountId);
  const inSnoozed = await findByHeaderId(snoozeFolder, m.headerMessageId);
  await log(`SELFTEST in-snoozed=${!!inSnoozed}`);
  await new Promise(r => setTimeout(r, 2000));
  await processDue();
  const back = await findByHeaderId(inbox, m.headerMessageId);
  await log(`SELFTEST back-in-inbox=${!!back} unread=${back ? !back.read : "n/a"}`);
  await log(back && inSnoozed && !back.read ? "SELFTEST OK" : "SELFTEST FAIL");
}
// DEV-END

(async () => {
  try {
    await applyAll();
    await scheduleAlarm();
    await processDue();
    // DEV-BEGIN
    // Dev harness only: "options" or "options:<settings json>" seeds settings and opens the page.
    const [dev, seed] = (await browser.perch.devMode()).split(/:(.*)/s);
    await log("devMode=" + dev);
    if (seed) {
      await browser.storage.local.set({ settings: JSON.parse(seed) });
    }
    if (dev === "selftest") {
      await selfTest();
    } else if (dev === "sender") {
      await openSender("Anna <anna@example.com>");
    } else if (dev === "editor") {
      await browser.tabs.create({ url: browser.runtime.getURL("options/options.html?edit=new") });
    } else if (dev === "options") {
      await browser.tabs.create({ url: browser.runtime.getURL("options/options.html") });
    }
    // DEV-END
  } catch (e) {
    console.error("Perch: startup failed", e);
    await log("startup failed: " + e);
  }
})();
