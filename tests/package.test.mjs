import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripDev, stripSchema, stage } from "../tools/package.mjs";

test("stripDev removes fenced blocks and keeps the rest", () => {
  const src = "a();\n// DEV-BEGIN\nsecret();\n// DEV-END\nb();\n  // DEV-BEGIN\n  x();\n  // DEV-END\n";
  assert.equal(stripDev(src), "a();\nb();\n");
});

test("stripDev refuses unbalanced markers", () => {
  assert.throws(() => stripDev("// DEV-BEGIN\nx();\n"), /Unbalanced/);
});

test("stripSchema drops dev functions only", () => {
  const out = JSON.parse(stripSchema(JSON.stringify([{ namespace: "n", functions: [{ name: "apply" }, { name: "devMode" }, { name: "log" }] }])));
  assert.deepEqual(out[0].functions.map((f) => f.name), ["apply"]);
});

test("the staged release has no dev hooks, no debug output, and still has what the features need", () => {
  const dir = stage(join(mkdtempSync(join(tmpdir(), "perch-")), "stage"));
  const bg = readFileSync(join(dir, "background.js"), "utf8");
  const impl = readFileSync(join(dir, "api/perch/implementation.js"), "utf8");
  const schema = readFileSync(join(dir, "api/perch/schema.json"), "utf8");
  for (const text of [bg, impl, schema]) assert.doesNotMatch(text, /devMode|selfTest|SELFTEST|DEV-/);
  assert.doesNotMatch(impl, /dump\(/);
  assert.match(bg, /snoozeMessage/);
  assert.match(schema, /"apply"/);
  assert.ok(existsSync(join(dir, "css/perch.css")));
  assert.ok(!existsSync(join(dir, "dev")));
});
