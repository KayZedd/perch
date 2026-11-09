import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const T = require("../extension/lib/themes.js");
const U = require("../extension/lib/unsub.js");
const S = require("../extension/lib/snooze.js");
const A = require("../extension/lib/avatar.js");

// ---- themes
test("every palette is readable: text >= 7:1 and muted >= 3:1 on card, both schemes", () => {
  for (const [name, p] of Object.entries(T.PALETTES)) {
    for (const mode of ["light", "dark"]) {
      const c = p[mode];
      assert.ok(T.contrast(c.text, c.card) >= 7, `${name}/${mode} text on card`);
      assert.ok(T.contrast(c.text2, c.card) >= 4.5, `${name}/${mode} text2 on card`);
      assert.ok(T.contrast(c.muted, c.card) >= 3, `${name}/${mode} muted on card`);
      assert.ok(T.contrast(c.accent, c.card) >= 3, `${name}/${mode} accent on card`);
      assert.ok(T.contrast(T.textOn(c.accent), c.accent) >= 4.5, `${name}/${mode} text on accent`);
    }
  }
});

test("every palette defines every token and a 10-step neutral scale", () => {
  for (const [name, p] of Object.entries(T.PALETTES)) {
    for (const mode of ["light", "dark"]) for (const k of T.TOKEN_KEYS) assert.match(p[mode][k], /^#[0-9a-f]{6}$/i, `${name}/${mode}/${k}`);
    assert.equal(p.n.length, 10);
  }
});

test("normalize rejects garbage and keeps valid input", () => {
  assert.deepEqual(T.normalize(null), T.DEFAULTS);
  const n = T.normalize({ palette: "evil", accent: "red", density: "huge", features: { snooze: false, bogus: false }, accountColors: { a: "#ABCDEF", b: "url(x)" } });
  assert.equal(n.palette, "paper");
  assert.equal(n.accent, null);
  assert.equal(n.density, "comfortable");
  assert.equal(n.features.snooze, false);
  assert.equal(n.features.avatars, true);
  assert.equal("bogus" in n.features, false);
  assert.deepEqual(n.accountColors, { a: "#abcdef" });
});

test("buildThemeCss: palette, accent override, density, account colours", () => {
  const css = T.buildThemeCss({ palette: "ink", accent: "#ff0000", density: "compact" }, [{ key: "server1" }, { key: "server2" }]);
  assert.match(css, /--perch-canvas: light-dark\(#e6e8f4, #0b0d1b\) !important/);
  assert.match(css, /--perch-accent: light-dark\(#ff0000, #ff0000\) !important/);
  assert.match(css, /--perch-card-pad: 2px !important/);
  assert.match(css, /--server-server1-color: #d2603a !important/);
  assert.match(css, /li\[data-server-type\]\[data-server-key="server2"\]/);
});

test("buildThemeCss escapes account keys so they cannot break out of the selector", () => {
  const css = T.buildThemeCss({}, [{ key: 'x"] { color: red } a[' }]);
  assert.doesNotMatch(css, /color: red \}/);
  assert.match(css, /x\\"\\\]\\ \\\{/);
});

test("every declaration in generated theme CSS is !important", () => {
  const css = T.buildThemeCss({}, [{ key: "server1" }]);
  for (const m of css.matchAll(/\{([^{}]*)\}/g)) for (const d of m[1].split(/;(?![^(]*\))/)) if (d.trim()) assert.match(d, /!important\s*$/, d);
});

test("no one-sided borders in generated CSS", () => {
  assert.doesNotMatch(T.buildThemeCss({}, [{ key: "server1" }]) + T.buildReadingCss({}), /border-(left|right|top|bottom|inline|block)/i);
});

test("buildReadingCss: off yields nothing; on targets plain text only", () => {
  assert.equal(T.buildReadingCss({ features: { reading: false } }), "");
  assert.equal(T.buildReadingCss({ readingMode: "off" }), ""); // v0.2 stored setting
  const css = T.buildReadingCss({});
  assert.match(css, /max-width: 72ch/);
  assert.doesNotMatch(css, /moz-text-html/);
});

// ---- unsubscribe
test("unsub: https + mailto, prefers both present", () => {
  const r = U.parse("<mailto:unsub@x.com?subject=Remove%20me>, <https://x.com/u?id=1>", "List-Unsubscribe=One-Click");
  assert.equal(r.https, "https://x.com/u?id=1");
  assert.deepEqual(r.mailto, { to: "unsub@x.com", subject: "Remove me", body: "" });
  assert.equal(r.oneClick, true);
});

test("unsub: rejects javascript:, http:, data: and malformed mailto", () => {
  const r = U.parse("<javascript:alert(1)>, <http://x.com/u>, <data:text/html,x>, <mailto:not an address>");
  assert.deepEqual(r, { https: null, mailto: null, oneClick: false });
});

test("unsub: missing or non-string header", () => {
  assert.deepEqual(U.parse(undefined), { https: null, mailto: null, oneClick: false });
  assert.deepEqual(U.parse(["x"]), { https: null, mailto: null, oneClick: false });
});

// ---- snooze (all dates local)
const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
test("snooze presets on a Monday morning", () => {
  const p = Object.fromEntries(S.presets(at(2026, 11, 9, 9, 30)).map((x) => [x.id, x.at]));
  assert.deepEqual(p.later, at(2026, 11, 9, 12, 30));
  assert.deepEqual(p.evening, at(2026, 11, 9, 18));
  assert.deepEqual(p.tomorrow, at(2026, 11, 10, 8));
  assert.deepEqual(p.weekend, at(2026, 11, 14, 8));
  assert.deepEqual(p.nextweek, at(2026, 11, 16, 8));
});

test("snooze presets: no evening late in the day, no weekend on Fri/Sat/Sun, next week is always future", () => {
  const night = S.presets(at(2026, 11, 9, 22)).map((x) => x.id);
  assert.ok(!night.includes("evening"));
  for (const day of [13, 14, 15]) assert.ok(!S.presets(at(2026, 11, day, 10)).map((x) => x.id).includes("weekend"), `day ${day}`);
  for (let d = 9; d <= 22; d++) {
    const now = at(2026, 11, d, 10);
    for (const x of S.presets(now)) assert.ok(x.at > now, `${x.id} on ${d}`);
  }
  assert.deepEqual(S.presets(at(2026, 11, 15, 10)).find((x) => x.id === "nextweek").at, at(2026, 11, 16, 8)); // Sunday -> Monday
  assert.deepEqual(S.presets(at(2026, 11, 16, 10)).find((x) => x.id === "nextweek").at, at(2026, 11, 23, 8)); // Monday -> next Monday
});

test("snooze: dueEntries sorted and inclusive; isValidWake", () => {
  const now = at(2026, 11, 9, 12);
  const e = [{ id: 1, wakeAt: now.getTime() + 1 }, { id: 2, wakeAt: now.getTime() }, { id: 3, wakeAt: now.getTime() - 5 }];
  assert.deepEqual(S.dueEntries(e, now).map((x) => x.id), [3, 2]);
  assert.equal(S.isValidWake(now.getTime(), now), false);
  assert.equal(S.isValidWake(NaN, now), false);
  assert.equal(S.isValidWake(now.getTime() + 1, now), true);
});

// ---- avatar
test("avatar initials", () => {
  assert.equal(A.initials("Anna Kowalska <anna@example.com>"), "AK");
  assert.equal(A.initials('"Piotr Nowak" <p@x.pl>'), "PN");
  assert.equal(A.initials("GitHub"), "G");
  assert.equal(A.initials("noreply@github.com"), "N");
  assert.equal(A.initials("jan.kowalski@x.pl"), "JK");
  assert.equal(A.initials("<a@b.c>"), "A");
  assert.equal(A.initials("łukasz żółć"), "ŁŻ");
  assert.equal(A.initials(""), "?");
  assert.equal(A.initials("!!! ???"), "?");
});

test("avatar hue is stable, case-insensitive, 0..359", () => {
  const h = A.hue("Anna Kowalska <a@x>");
  assert.equal(h, A.hue("anna kowalska <b@y>"));
  assert.ok(h >= 0 && h < 360);
});

// ---- v0.3: features, custom palettes
test("old v0.2 settings migrate into features", () => {
  const n = T.normalize({ avatars: false, readingMode: "off" });
  assert.equal(n.features.avatars, false);
  assert.equal(n.features.reading, false);
  assert.equal(n.features.theme, true);
});

test("feature off: no account rules; theme CSS still valid", () => {
  const css = T.buildThemeCss({ features: { accountColors: false } }, [{ key: "server1" }]);
  assert.doesNotMatch(css, /server1/);
});

const CUSTOM = { id: "c_abc123", label: "  <b>Sea</b>  ", light: { canvas: "#e0ecef", card: "#ffffff", text: "#102027", accent: "#00796b" }, dark: { canvas: "#0b1418", card: "#12222a", text: "#e6f2f5", accent: "#4db6ac" } };

test("custom palette: validated, label sanitised, resolved and used by the CSS builders", () => {
  const n = T.normalize({ palette: "c_abc123", customPalettes: [CUSTOM, { id: "bad id", light: {}, dark: {} }, { ...CUSTOM, id: "c_x", light: { ...CUSTOM.light, accent: "red" } }] });
  assert.equal(n.customPalettes.length, 1);
  assert.equal(n.customPalettes[0].label, "bSea/b");
  assert.equal(n.palette, "c_abc123");
  const css = T.buildThemeCss(n, []);
  assert.match(css, /--perch-canvas: light-dark\(#e0ecef, #0b1418\) !important/);
  assert.match(T.buildReadingCss(n), /#102027/);
});

test("unknown custom id falls back to paper; custom list is capped and de-duplicated", () => {
  assert.equal(T.normalize({ palette: "c_nope" }).palette, "paper");
  const many = Array.from({ length: 30 }, (_, i) => ({ ...CUSTOM, id: "c_" + i }));
  assert.equal(T.normalize({ customPalettes: many }).customPalettes.length, T.MAX_CUSTOM);
  assert.equal(T.normalize({ customPalettes: [CUSTOM, CUSTOM] }).customPalettes.length, 1);
});

test("derived scheme: card steps move monotonically toward text, contrast holds for the sample", () => {
  const d = T.deriveScheme(CUSTOM.light);
  const lum = [d.card, d.card2, d.card3, d.card4].map(T.luminance);
  for (let i = 1; i < lum.length; i++) assert.ok(lum[i] < lum[i - 1], "light cards darken");
  const dd = T.deriveScheme(CUSTOM.dark);
  const dl = [dd.card, dd.card2, dd.card3, dd.card4].map(T.luminance);
  for (let i = 1; i < dl.length; i++) assert.ok(dl[i] > dl[i - 1], "dark cards lighten");
  assert.deepEqual(T.paletteWarnings(CUSTOM), []);
  const r = T.resolvePalette(T.normalize({ palette: "c_abc123", customPalettes: [CUSTOM] }));
  assert.equal(r.n.length, 10);
});

test("paletteWarnings flags unreadable and flat palettes", () => {
  const bad = { ...CUSTOM, light: { canvas: "#ffffff", card: "#ffffff", text: "#eeeeee", accent: "#fefefe" } };
  assert.equal(T.paletteWarnings(bad).length, 2);
});

test("mix endpoints and midpoint", () => {
  assert.equal(T.mix("#000000", "#ffffff", 0), "#000000");
  assert.equal(T.mix("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(T.mix("#000000", "#ffffff", 0.5), "#808080");
});

test("pageVars follows palette and accent for extension pages", () => {
  const v = T.pageVars({ palette: "ink", accent: "#ff0000" });
  assert.equal(v["--bg"], "light-dark(#e6e8f4, #0b0d1b)");
  assert.equal(v["--accent"], "light-dark(#ff0000, #ff0000)");
  assert.ok(Object.values(v).every((x) => typeof x === "string"));
});

test("newCustomId matches the id pattern", () => {
  assert.match(T.newCustomId(), /^c_[a-z0-9]{1,10}$/);
});

// ---- v0.1 additions: transfer, sender, attach
const X = require("../extension/lib/transfer.js");
const Sn = require("../extension/lib/sender.js");
const At = require("../extension/lib/attach.js");

test("transfer: round trip keeps palettes, features and account colours", () => {
  const s = T.normalize({ palette: "c_abc123", customPalettes: [CUSTOM], features: { snooze: false }, accountColors: { server1: "#112233" }, density: "compact", accent: "#ff0000" });
  const back = X.parseImport(X.exportSettings(s, T.normalize), T.normalize);
  assert.equal(back.ok, true);
  assert.deepEqual(back.settings, s);
});

test("transfer: rejects empty, oversized, non-JSON, foreign and newer documents without throwing", () => {
  const n = T.normalize;
  assert.equal(X.parseImport("", n).ok, false);
  assert.equal(X.parseImport(undefined, n).ok, false);
  assert.equal(X.parseImport("x".repeat(X.MAX_BYTES + 1), n).ok, false);
  assert.match(X.parseImport("{nope", n).error, /JSON/);
  assert.match(X.parseImport('{"format":"other","version":1,"settings":{}}', n).error, /not a Perch/);
  assert.match(X.parseImport('{"format":"perch-settings","version":99,"settings":{}}', n).error, /newer/);
  assert.match(X.parseImport('{"format":"perch-settings","version":1}', n).error, /no settings/);
  assert.equal(X.parseImport("null", n).ok, false);
});

test("transfer: hostile import is normalised (bad colours, ids, unknown keys)", () => {
  const doc = JSON.stringify({ format: "perch-settings", version: 1, settings: { palette: "x", accent: "javascript:1", accountColors: { a: "red" }, customPalettes: [{ id: "../x", light: {}, dark: {} }], evil: 1 } });
  const r = X.parseImport(doc, T.normalize);
  assert.equal(r.ok, true);
  assert.deepEqual(r.settings, T.normalize(null));
});

test("sender: extractEmail", () => {
  assert.equal(Sn.extractEmail("Anna <Anna@Example.com>"), "anna@example.com");
  assert.equal(Sn.extractEmail("anna@example.com"), "anna@example.com");
  assert.equal(Sn.extractEmail('"Doe, J" <j@x.io>'), "j@x.io");
  assert.equal(Sn.extractEmail("no address"), "");
  assert.equal(Sn.extractEmail(undefined), "");
});

test("sender: exactMatches drops substring hits, duplicates, sorts newest first", () => {
  const m = [
    { id: 1, author: "Ann <ann@x.com>", date: "2026-01-01", headerMessageId: "a" },
    { id: 2, author: "Joann <joann@x.com>", date: "2026-02-01", headerMessageId: "b" },
    { id: 3, author: "ann@x.com", date: "2026-03-01", headerMessageId: "c" },
    { id: 4, author: "Ann <ann@x.com>", date: "2026-03-01", headerMessageId: "c" },
  ];
  assert.deepEqual(Sn.exactMatches(m, "ann@x.com").map((x) => x.id), [3, 1]);
});

test("sender: summarize", () => {
  const s = Sn.summarize([{ read: false, date: "2026-01-02", attachments: [1] }, { read: true, date: "2026-01-05" }]);
  assert.equal(s.count, 2);
  assert.equal(s.unread, 1);
  assert.equal(s.withAttachments, 1);
  assert.equal(s.first.getTime(), new Date("2026-01-02").getTime());
  assert.deepEqual(Sn.summarize([]), { count: 0, unread: 0, withAttachments: 0, first: null, last: null });
});

test("attach: formatSize", () => {
  assert.equal(At.formatSize(0), "0 B");
  assert.equal(At.formatSize(850), "850 B");
  assert.equal(At.formatSize(1536), "1.5 KB");
  assert.equal(At.formatSize(20 * 1024), "20 KB");
  assert.equal(At.formatSize(5 * 1024 * 1024), "5 MB");
  assert.equal(At.formatSize(-1), "");
  assert.equal(At.formatSize("x"), "");
});

test("attach: shortName keeps the extension, summarize caps the list", () => {
  assert.equal(At.shortName("faktura.pdf"), "faktura.pdf");
  const long = "a".repeat(60) + ".pdf";
  const s = At.shortName(long);
  assert.ok(s.length <= 34 && s.endsWith(".pdf") && s.includes("…"));
  const sum = At.summarize(Array.from({ length: 9 }, (_, i) => ({ name: `f${i}.txt`, size: 10 })));
  assert.equal(sum.items.length, 6);
  assert.equal(sum.more, 3);
  assert.deepEqual(At.summarize(null), { items: [], more: 0 });
});
