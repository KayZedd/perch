/* global PerchSnooze, PerchUnsub, PerchThemes, PerchSender */
const $ = id => document.getElementById(id);
const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
let messageId = null;

function status(text, isError = false) {
  const el = $("status");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

async function send(payload) {
  try {
    await browser.runtime.sendMessage(payload);
    window.close();
  } catch (e) {
    status(String(e.message ?? e), true);
  }
}

async function init() {
  const { settings: stored } = await browser.storage.local.get("settings");
  const settings = PerchThemes.normalize(stored);
  for (const [k, v] of Object.entries(PerchThemes.pageVars(settings))) document.documentElement.style.setProperty(k, v);
  $("snoozeSection").hidden = !settings.features.snooze;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const msg = tab ? await browser.messageDisplay.getDisplayedMessage(tab.id) : null;
  if (!msg) {
    status("No message selected.", true);
    return;
  }
  messageId = msg.id;
  if (settings.features.sender && PerchSender.extractEmail(msg.author)) {
    $("senderBox").hidden = false;
    $("senderBtn").addEventListener("click", () => send({ type: "sender", author: msg.author }));
  }

  const list = $("presets");
  for (const p of settings.features.snooze ? PerchSnooze.presets(new Date()) : []) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = p.label;
    b.lastChild.textContent = fmt.format(p.at);
    b.addEventListener("click", () => send({ type: "snooze", messageId, wakeAt: p.at.getTime() }));
    li.append(b);
    list.append(li);
  }

  $("custom").addEventListener("submit", e => {
    e.preventDefault();
    const wakeAt = new Date($("when").value).getTime();
    if (!PerchSnooze.isValidWake(wakeAt, new Date())) {
      status("Pick a time in the future.", true);
      return;
    }
    send({ type: "snooze", messageId, wakeAt });
  });

  const full = await browser.messages.getFull(messageId);
  const first = n => full.headers[n]?.[0];
  const r = PerchUnsub.parse(first("list-unsubscribe"), first("list-unsubscribe-post"));
  if (settings.features.unsubscribe && (r.https || r.mailto)) {
    $("unsub").hidden = false;
    $("unsubBtn").textContent = r.https ? "Unsubscribe (opens the sender's page)" : "Unsubscribe (prepares an email)";
    $("unsubBtn").addEventListener("click", () => send({ type: "unsubscribe", messageId }));
  }
}

init().catch(e => status(String(e.message ?? e), true));
