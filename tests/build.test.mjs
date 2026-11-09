import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build, SCOPE } from "../tools/build.mjs";
import { splitSelectors } from "../tools/important.mjs";

const css = build();
const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url)));

// Strip comments, then walk top-level rules: every selector list must be scoped
// (or start with :root) and keyframes bodies are exempt from the !important rule.
const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");

test("no @-moz-document (unsupported in agent sheets) and no nesting selector", () => {
  assert.doesNotMatch(flat, /@-moz-document/);
  assert.doesNotMatch(flat, /(^|[{};,])\s*&/);
});

test("every selector is scoped to chrome documents or is a :root rule", () => {
  const bad = [];
  for (const m of flat.matchAll(/(^|\})\s*([^{}@][^{}]*)\{/g)) {
    for (const sel of splitSelectors(m[2])) {
      const t = sel.trim();
      if (t && !t.startsWith(SCOPE) && !t.startsWith(":root")) bad.push(t);
    }
  }
  assert.deepEqual(bad, []);
});

test("every declaration is !important (agent sheets lose to author rules otherwise)", () => {
  const bad = [];
  for (const m of flat.matchAll(/\{([^{}]*)\}/g)) {
    for (const d of m[1].split(/;(?![^(]*\))/)) {
      const t = d.trim();
      if (t && t.includes(":") && !/!important$/.test(t)) bad.push(t);
    }
  }
  assert.deepEqual(bad, []);
});

test("token layer overrides the app's own variables on :root", () => {
  for (const v of ["--layout-background-0", "--selected-item-color", "--button-border-radius", "--tree-card-background-selected"]) {
    assert.match(flat, new RegExp(`${v}:`));
  }
});

test("manifest is MV2 with the Experiment API wired to existing files", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.browser_specific_settings.gecko.id, "perch@kayzedd");
  const api = manifest.experiment_apis.perch;
  for (const f of [api.schema, api.parent.script, ...manifest.background.scripts]) {
    assert.ok(readFileSync(new URL("../extension/" + f, import.meta.url)).length > 0, f);
  }
});

test("house rule: no one-sided borders or inset-shadow stripes anywhere", () => {
  const bad = flat.match(/border-(left|right|top|bottom|inline|block)[a-z-]*\s*:|box-shadow:\s*inset/gi);
  assert.equal(bad, null, "one-sided border found: " + bad);
});

import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

test("every file referenced by the manifest, popup and options pages exists", () => {
  const ext = new URL("../extension/", import.meta.url).pathname;
  const refs = [
    ...manifest.background.scripts,
    manifest.message_display_action.default_popup,
    manifest.message_display_action.default_icon,
    manifest.options_ui.page,
    manifest.experiment_apis.perch.schema,
    manifest.experiment_apis.perch.parent.script,
  ];
  for (const page of [manifest.message_display_action.default_popup, manifest.options_ui.page, "sender/sender.html"]) {
    const html = readFileSync(join(ext, page), "utf8");
    for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) refs.push(normalize(join(dirname(page), m[1])));
  }
  const missing = refs.filter((r) => !existsSync(join(ext, r)));
  assert.deepEqual(missing, []);
});

test("manifest requests only the permissions the features need", () => {
  assert.deepEqual([...manifest.permissions].sort(), [
    "accountsFolders", "accountsRead", "alarms", "compose", "menus", "messagesModify", "messagesMove", "messagesRead", "messagesUpdate", "storage",
  ]);
  assert.ok(!manifest.permissions.includes("<all_urls>"));
});

test("house rule also holds for the options and popup pages", () => {
  for (const f of ["options/options.css", "popup/popup.css", "sender/sender.css"]) {
    const css = readFileSync(new URL("../extension/" + f, import.meta.url), "utf8");
    assert.equal(css.match(/border-(left|right|top|bottom|inline|block)[a-z-]*\s*:|box-shadow:\s*inset/gi), null, f);
  }
});
