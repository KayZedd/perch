import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ext = new URL("../extension/", import.meta.url);

// Runs the real background.js against a stub `browser`; only the browser API is faked.
async function startup({ accountsFail }) {
  const calls = [];
  const noop = async () => {};
  const store = { snoozed: [{ headerMessageId: "a", wakeAt: 1, snoozeId: "s", originId: "o" }] };
  const browser = {
    perch: { log: noop, devMode: async () => "", apply: noop, clear: noop, setListFeatures: noop,
      getAccounts: async () => { if (accountsFail) throw new Error("accounts not ready"); return []; } },
    storage: { local: { get: async k => ({ [k]: store[k] }), set: async o => Object.assign(store, o) }, onChanged: { addListener() {} } },
    runtime: { getURL: p => p, onMessage: { addListener() {} } },
    alarms: { clear: noop, create: () => calls.push("alarm"), onAlarm: { addListener() {} } },
    folders: { get: async () => { calls.push("wake-attempt"); throw new Error("offline"); } },
    menus: { removeAll: noop, create() {}, onClicked: { addListener() {} } },
    messageDisplayAction: { enable: noop, disable: noop, setTitle: noop },
    messageDisplayScripts: { register: async () => ({ unregister: noop }) },
  };
  const ctx = { browser, setTimeout, console: { error() {} }, fetch: async () => ({ text: async () => "" }) };
  for (const [g, f] of [["PerchThemes", "themes"], ["PerchSnooze", "snooze"], ["PerchUnsub", "unsub"], ["PerchSender", "sender"]]) {
    ctx[g] = require(new URL(`lib/${f}.js`, ext).pathname);
  }
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("background.js", ext), "utf8"), ctx);
  await new Promise(r => setTimeout(r, 50));
  return calls;
}

test("startup: snoozed mail is still scheduled and woken when applyAll fails", async () => {
  const calls = await startup({ accountsFail: true });
  assert.ok(calls.includes("wake-attempt"), "processDue ran");
  assert.ok(calls.includes("alarm"), "alarm scheduled");
});

test("startup: normal path also schedules and wakes", async () => {
  const calls = await startup({ accountsFail: false });
  assert.ok(calls.includes("wake-attempt") && calls.includes("alarm"));
});

// Wake path: the message is moved back, but the origin folder lists it only after `visibleAfter` queries.
async function wake({ visibleAfter }) {
  const updates = [];
  let originQueries = 0;
  const store = { snoozed: [{ headerMessageId: "m1", wakeAt: 1, snoozeId: "snz", originId: "inbox" }] };
  const noop = async () => {};
  const browser = {
    perch: { log: noop, devMode: async () => "", apply: noop, clear: noop, setListFeatures: noop, getAccounts: async () => [] },
    storage: { local: { get: async k => ({ [k]: store[k] }), set: async o => Object.assign(store, o) }, onChanged: { addListener() {} } },
    runtime: { getURL: p => p, onMessage: { addListener() {} } },
    alarms: { clear: noop, create() {}, onAlarm: { addListener() {} } },
    folders: { get: async id => ({ id }) },
    messages: {
      query: async ({ folderId }) => {
        if (folderId === "snz") return { messages: [{ id: 1 }] };
        originQueries++;
        return { messages: originQueries > visibleAfter ? [{ id: 2 }] : [] };
      },
      move: noop,
      update: async (id, p) => updates.push([id, p]),
    },
    menus: { removeAll: noop, create() {}, onClicked: { addListener() {} } },
    messageDisplayAction: { enable: noop, disable: noop, setTitle: noop },
    messageDisplayScripts: { register: async () => ({ unregister: noop }) },
  };
  const ctx = { browser, setTimeout, console: { error() {} }, fetch: async () => ({ text: async () => "" }) };
  for (const [g, f] of [["PerchThemes", "themes"], ["PerchSnooze", "snooze"], ["PerchUnsub", "unsub"], ["PerchSender", "sender"]]) {
    ctx[g] = require(new URL(`lib/${f}.js`, ext).pathname);
  }
  vm.createContext(ctx);
  const src = readFileSync(new URL("background.js", ext), "utf8").replace("const POLL_MS = 1000", "const POLL_MS = 1");
  vm.runInContext(src, ctx);
  await new Promise(r => setTimeout(r, 150));
  return { updates, store };
}

test("wake: a message that shows up late in the origin folder is still marked unread", async () => {
  const { updates, store } = await wake({ visibleAfter: 3 });
  assert.equal(JSON.stringify(updates), JSON.stringify([[2, { read: false }]]));
  assert.equal(store.snoozed.length, 0);
});

test("wake: a message that never shows up within the poll is kept for a later unread retry", async () => {
  const { updates, store } = await wake({ visibleAfter: 1000 });
  assert.equal(updates.length, 0);
  assert.equal(store.snoozed.length, 1);
  assert.equal(store.snoozed[0].woken, true);
  assert.ok(store.snoozed[0].wakeAt > Date.now());
});
