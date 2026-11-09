#!/usr/bin/env node
// Builds the release xpi: css build -> staging copy -> strip dev-only code -> verify -> zip.
//   node tools/package.mjs        writes dist/perch-<version>.xpi and prints the path
// Dev-only code is fenced with `// DEV-BEGIN` / `// DEV-END` in extension/*.js and lives in the
// unpacked extension/ dir that dev/shot.sh loads. It never ships.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEV_FUNCTIONS = new Set(["devMode", "log"]);
const FORBIDDEN = [/DEV-BEGIN|DEV-END/, /devMode/, /selfTest|SELFTEST/, /\bdump\(/, /extensions\.perch\./, /console\.log\(/];

export function stripDev(source) {
  const out = source.replace(/^[ \t]*\/\/ DEV-BEGIN[\s\S]*?\/\/ DEV-END[ \t]*\r?\n/gm, "");
  if (/DEV-(BEGIN|END)/.test(out)) throw new Error("Unbalanced DEV markers");
  return out;
}

export function stripSchema(schemaText) {
  const schema = JSON.parse(schemaText);
  for (const ns of schema) ns.functions = ns.functions.filter((f) => !DEV_FUNCTIONS.has(f.name));
  return JSON.stringify(schema, null, 2) + "\n";
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function stage(outDir) {
  rmSync(outDir, { recursive: true, force: true });
  cpSync(join(root, "extension"), outDir, { recursive: true });
  for (const f of walk(outDir)) {
    if (f.endsWith(".js")) writeFileSync(f, stripDev(readFileSync(f, "utf8")));
  }
  const schema = join(outDir, "api/perch/schema.json");
  writeFileSync(schema, stripSchema(readFileSync(schema, "utf8")));
  for (const f of walk(outDir)) {
    if (!/\.(js|json|html|css)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    for (const re of FORBIDDEN) if (re.test(text)) throw new Error(`${f} still contains ${re}`);
  }
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(root, "extension/css/perch.css"), build());
  const version = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8")).version;
  const dist = join(root, "dist");
  mkdirSync(dist, { recursive: true });
  const staged = stage(join(dist, "stage"));
  const xpi = join(dist, `perch-${version}.xpi`);
  rmSync(xpi, { force: true });
  execFileSync("zip", ["-qr", "-X", xpi, "."], { cwd: staged });
  rmSync(staged, { recursive: true, force: true });
  console.log(xpi);
}
