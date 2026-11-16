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
  const ctx = { browser, console: { error() {} }, fetch: async () => ({ text: async () => "" }) };
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
