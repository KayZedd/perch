/* global PerchThemes, PerchSender */
const $ = id => document.getElementById(id);
const MAX = 500;
const dateFmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });

function status(text) {
  $("status").textContent = text;
}

async function collect(email) {
  let page = await browser.messages.query({ author: email });
  const all = [...page.messages];
  while (page.id && all.length < MAX) {
    page = await browser.messages.continueList(page.id);
    all.push(...page.messages);
  }
  return all;
}

function render(messages, folderNames) {
  const list = $("list");
  list.replaceChildren();
  for (const m of messages) {
    const li = document.createElement("li");
    if (!m.read) li.className = "unread";
    const b = document.createElement("button");
    b.type = "button";
    const subject = document.createElement("span");
    subject.className = "subject";
    subject.textContent = m.subject || "(no subject)";
    const time = document.createElement("time");
    time.textContent = dateFmt.format(new Date(m.date));
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = folderNames.get(m.folder?.id) ?? "";
    b.append(subject, time, meta);
    b.addEventListener("click", () => browser.messageDisplay.open({ messageId: m.id, location: "tab" }));
    li.append(b);
    list.append(li);
  }
}

async function init() {
  const { settings } = await browser.storage.local.get("settings");
  for (const [k, v] of Object.entries(PerchThemes.pageVars(settings))) document.documentElement.style.setProperty(k, v);

  const email = new URLSearchParams(location.search).get("author") ?? "";
  if (!PerchSender.extractEmail(email)) {
    $("who").textContent = "No sender";
    status("Open this page from a message.");
    return;
  }
  $("who").textContent = email;
  status("Searching…");
  const found = PerchSender.exactMatches(await collect(email), email);
  const s = PerchSender.summarize(found);
  const accountNames = new Map((await browser.accounts.list()).map(a => [a.id, a.name]));
  const folderNames = new Map();
  for (const m of found) {
    if (m.folder && !folderNames.has(m.folder.id)) {
      folderNames.set(m.folder.id, `${accountNames.get(m.folder.accountId) ?? m.folder.accountId}: ${m.folder.name}`);
    }
  }
  const parts = [`${s.count} message${s.count === 1 ? "" : "s"}`];
  if (s.unread) parts.push(`${s.unread} unread`);
  if (s.withAttachments) parts.push(`${s.withAttachments} with attachments`);
  if (s.first && s.last) parts.push(`${dateFmt.format(s.first)} to ${dateFmt.format(s.last)}`);
  $("summary").textContent = parts.join(" · ");
  render(found, folderNames);
  status(found.length ? (found.length >= MAX ? `Showing the newest ${MAX}.` : "") : "No messages found.");
}

init().catch(e => status(String(e.message ?? e)));
