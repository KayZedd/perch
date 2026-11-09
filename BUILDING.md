# Building Perch from source

This file is the build documentation for add-on reviewers. Perch has **no npm dependencies, no bundler, no minifier,
no transpiler and no template engine**. The JavaScript, HTML and JSON in `extension/` are the sources and ship as written.
The only processing is a small CSS step and a packaging step, both plain Node scripts in `tools/`.

## Environment

| Requirement | Version used | Notes |
| --- | --- | --- |
| OS | Linux x86_64 (also runs on macOS) | The scripts use only Node and `zip`; no OS-specific code. |
| Node.js | 22.x (CI uses 22.23.4; the author also ran 26.13.0) | No `npm install`; there is no `package.json` and no dependency. Install from https://nodejs.org/ or your package manager. |
| zip | Info-ZIP 3.0 (`zip -v`) | Used by `tools/package.mjs` to create the xpi. |

## Steps

```bash
# 1. Unpack the source archive (or `git clone https://github.com/KayZedd/perch && git checkout v0.1.0`)
unzip perch-source-0.1.0.zip && cd perch-0.1.0

# 2. Build the package. This single script does everything below.
node tools/package.mjs

# Result:
ls dist/perch-0.1.0.xpi
```

`node tools/package.mjs` performs these steps in order:

1. `tools/build.mjs`: reads the human-written stylesheets `src/*.css` (sorted by file name), runs them through `tools/important.mjs`
   (adds `!important` to every declaration and prefixes every selector with `:root[lightweightthemes]`; both are needed because the
   stylesheet is registered as an agent sheet, see README "Why an Experiment"), and writes `extension/css/perch.css`.
   That generated file is also committed to the repository so the source tree can be inspected without running anything.
2. Copies `extension/` to a staging folder, removes code fenced by `// DEV-BEGIN` / `// DEV-END` (development-only test hooks) and removes the
   two development functions (`devMode`, `log`) from `api/perch/schema.json`.
3. Fails the build if any dev marker, `devMode`, `selfTest`, `dump(` or `console.log(` remains in the staged files.
4. Zips the staged folder into `dist/perch-0.1.0.xpi`.

## Verify

```bash
node --test            # 59 tests, about 1 second
```

To compare with the submitted package: unzip both xpi files and `diff -r` them. The contents are identical; only zip timestamps differ.
I checked this by building from the source archive in an empty directory.

## What is hand-written and what is generated

| Path | Origin |
| --- | --- |
| `src/*.css` | hand-written CSS (flat, no nesting) |
| `extension/css/perch.css` | **generated** by `tools/build.mjs` from `src/*.css` (the only generated file in the package) |
| `extension/**/*.js`, `*.html`, `*.json`, `*.svg` | hand-written, shipped as is (minus the dev-only blocks removed in step 2) |
| `tools/`, `tests/`, `dev/` | build, tests and development harness; not part of the xpi |
