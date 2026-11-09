"use strict";
// Palettes, density, account colours, reading CSS. Pure functions: no browser APIs, unit-tested in node.
(function (root) {
  const HEX = /^#[0-9a-f]{6}$/i;

  // Each palette defines both colour schemes. `n` is a 10-step neutral scale (gray-05 .. gray-90).
  const PALETTES = {
    paper: {
      label: "Paper (warm)",
      light: { canvas: "#ece4d6", card: "#fcf9f2", card2: "#f5efe3", card3: "#ece4d3", card4: "#e1d7c1", border: "#e2d8c5", borderStrong: "#cdbfa6", text: "#2a251d", text2: "#564d3f", muted: "#85796a", accent: "#b9502a" },
      dark: { canvas: "#17140f", card: "#221e18", card2: "#2a251e", card3: "#342e25", card4: "#40392e", border: "#382f26", borderStrong: "#4d4435", text: "#efe7d6", text2: "#c4baa5", muted: "#968b78", accent: "#e98a5c" },
      n: ["#fbf8f1", "#f4efe4", "#e9e2d2", "#d8cfbb", "#aaa08c", "#82786a", "#5f574b", "#463f35", "#2d2822", "#1d1914"],
    },
    graphite: {
      label: "Graphite (neutral)",
      light: { canvas: "#e8eaed", card: "#ffffff", card2: "#f3f4f6", card3: "#e7e9ed", card4: "#d9dce2", border: "#dcdfe5", borderStrong: "#c2c7d0", text: "#1c2026", text2: "#454c58", muted: "#767e8c", accent: "#2f6df0" },
      dark: { canvas: "#101215", card: "#1a1d22", card2: "#21252b", card3: "#2a2f36", card4: "#353b44", border: "#2c3139", borderStrong: "#434a55", text: "#e9ecf1", text2: "#b9bfca", muted: "#8a92a0", accent: "#7ea5ff" },
      n: ["#fafbfc", "#f3f4f6", "#e7e9ed", "#d4d8de", "#a3a9b4", "#7b8290", "#575e6b", "#3d434d", "#262a31", "#16181d"],
    },
    ink: {
      label: "Ink (indigo night)",
      light: { canvas: "#e6e8f4", card: "#ffffff", card2: "#f2f3fb", card3: "#e6e8f5", card4: "#d8dbee", border: "#dadcef", borderStrong: "#bfc3e0", text: "#161933", text2: "#454a73", muted: "#767ba3", accent: "#5a47e6" },
      dark: { canvas: "#0b0d1b", card: "#141830", card2: "#1b2040", card3: "#252b52", card4: "#313967", border: "#252a4d", borderStrong: "#3a4275", text: "#eceefb", text2: "#b8bde0", muted: "#8289b8", accent: "#9588ff" },
      n: ["#fafaff", "#f2f3fb", "#e6e8f5", "#d2d5ea", "#a1a5c9", "#7a7fa8", "#585d86", "#40446b", "#282b4a", "#171933"],
    },
  };

  const DENSITIES = {
    compact: { cardPad: "2px", folderRow: "26px", cardGap: "1px" },
    comfortable: { cardPad: "6px", folderRow: "32px", cardGap: "2px" },
    spacious: { cardPad: "11px", folderRow: "38px", cardGap: "4px" },
  };

  const ACCOUNT_COLORS = ["#d2603a", "#2f8f83", "#4a6fe0", "#a85fc4", "#c79a1e", "#cc4b72", "#5a9a3d", "#6f7a8c"];

  const FEATURES = ["theme", "accountColors", "avatars", "attachments", "reading", "snooze", "unsubscribe", "sender"];
  const MAX_CUSTOM = 12;
  const CUSTOM_ID = /^c_[a-z0-9]{1,16}$/;

  const DEFAULTS = Object.freeze({
    palette: "paper",
    accent: null,
    density: "comfortable",
    features: Object.freeze(Object.fromEntries(FEATURES.map((f) => [f, true]))),
    accountColors: {},
    customPalettes: [],
  });

  function normalizeScheme(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = {};
    for (const k of ["canvas", "card", "text", "accent"]) {
      if (typeof raw[k] !== "string" || !HEX.test(raw[k])) return null;
      out[k] = raw[k].toLowerCase();
    }
    return out;
  }

  function normalizeCustom(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const c of list) {
      if (!c || typeof c.id !== "string" || !CUSTOM_ID.test(c.id) || seen.has(c.id)) continue;
      const light = normalizeScheme(c.light);
      const dark = normalizeScheme(c.dark);
      if (!light || !dark) continue;
      const label = String(c.label ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) || "Custom";
      seen.add(c.id);
      out.push({ id: c.id, label, light, dark });
      if (out.length >= MAX_CUSTOM) break;
    }
    return out;
  }

  function normalize(raw) {
    const r = raw && typeof raw === "object" ? raw : {};
    const colors = {};
    if (r.accountColors && typeof r.accountColors === "object") {
      for (const [k, v] of Object.entries(r.accountColors)) {
        if (typeof v === "string" && HEX.test(v)) colors[k] = v.toLowerCase();
      }
    }
    // Features: v0.2 stored `avatars` and `readingMode`; keep those users' choices.
    const f = r.features && typeof r.features === "object" ? r.features : {};
    const features = {};
    for (const name of FEATURES) features[name] = f[name] === false ? false : true;
    if (r.avatars === false) features.avatars = false;
    if (r.readingMode === "off") features.reading = false;

    const customPalettes = normalizeCustom(r.customPalettes);
    const known = Object.hasOwn(PALETTES, r.palette) || customPalettes.some((c) => c.id === r.palette);
    return {
      palette: known ? r.palette : DEFAULTS.palette,
      accent: typeof r.accent === "string" && HEX.test(r.accent) ? r.accent.toLowerCase() : null,
      density: Object.hasOwn(DENSITIES, r.density) ? r.density : DEFAULTS.density,
      features,
      accountColors: colors,
      customPalettes,
    };
  }

  // ---- colour maths for user palettes
  const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
  // t = share of b in the result
  function mix(a, b, t) {
    const x = toRgb(a), y = toRgb(b);
    return toHex(x.map((v, i) => v + (y[i] - v) * t));
  }

  // 4 picked colours -> the 11 tokens the stylesheet uses.
  function deriveScheme(c) {
    return {
      canvas: c.canvas,
      card: c.card,
      card2: mix(c.card, c.text, 0.04),
      card3: mix(c.card, c.text, 0.09),
      card4: mix(c.card, c.text, 0.15),
      border: mix(c.card, c.text, 0.11),
      borderStrong: mix(c.card, c.text, 0.22),
      text: c.text,
      text2: mix(c.text, c.card, 0.25),
      muted: mix(c.text, c.card, 0.5),
      accent: c.accent,
    };
  }

  const NEUTRAL_STEPS = [0, 0.05, 0.12, 0.2, 0.4, 0.55, 0.7, 0.8, 0.9, 0.97];

  function resolvePalette(settings) {
    const s = settings.palette !== undefined && settings.features ? settings : normalize(settings);
    if (Object.hasOwn(PALETTES, s.palette)) return PALETTES[s.palette];
    const c = s.customPalettes.find((x) => x.id === s.palette);
    if (!c) return PALETTES.paper;
    const light = deriveScheme(c.light);
    return {
      label: c.label,
      light,
      dark: deriveScheme(c.dark),
      n: NEUTRAL_STEPS.map((t) => mix(light.card, light.text, t)),
    };
  }

  // Human-readable problems with a user palette; empty array means fine.
  function paletteWarnings(c) {
    const out = [];
    for (const mode of ["light", "dark"]) {
      const d = deriveScheme(c[mode]);
      if (contrast(d.text, d.card) < 4.5) out.push(`${mode}: text on card is hard to read`);
      if (contrast(d.accent, d.card) < 3) out.push(`${mode}: accent is too close to the card colour`);
    }
    return out;
  }

  function newCustomId(now = Date.now()) {
    return "c_" + now.toString(36).slice(-10);
  }

  function luminance(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Text colour readable on an accent-coloured button.
  function textOn(hex) {
    return contrast(hex, "#ffffff") >= contrast(hex, "#14110d") ? "#ffffff" : "#14110d";
  }

  const TOKEN_KEYS = ["canvas", "card", "card2", "card3", "card4", "border", "borderStrong", "text", "text2", "muted", "accent"];
  const CSS_NAME = { canvas: "canvas", card: "card", card2: "card-2", card3: "card-3", card4: "card-4", border: "border", borderStrong: "border-strong", text: "text", text2: "text-2", muted: "muted", accent: "accent" };

  function cssEscapeIdent(s) {
    return String(s).replace(/[^A-Za-z0-9_-]/g, (ch) => "\\" + ch);
  }

  // Account colour: explicit choice, else a stable pick by position.
  function accountColor(settings, key, index) {
    return settings.accountColors[key] ?? ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
  }

  function buildThemeCss(rawSettings, accounts) {
    const s = normalize(rawSettings);
    const p = resolvePalette(s);
    const d = DENSITIES[s.density];
    const L = { ...p.light };
    const D = { ...p.dark };
    if (s.accent) { L.accent = s.accent; D.accent = s.accent; }

    const decl = [];
    for (const k of TOKEN_KEYS) decl.push(`--perch-${CSS_NAME[k]}: light-dark(${L[k]}, ${D[k]}) !important;`);
    decl.push(`--perch-accent-text: light-dark(${textOn(L.accent)}, ${textOn(D.accent)}) !important;`);
    decl.push("--perch-unread: var(--perch-accent) !important;");
    const gk = ["05", "10", "20", "30", "40", "50", "60", "70", "80", "90"];
    p.n.forEach((v, i) => {
      decl.push(`--color-gray-${gk[i]}: ${v} !important;`);
      if (i > 0) decl.push(`--color-ink-${gk[i]}: ${v} !important;`);
    });
    decl.push(`--color-ink-10: ${p.n[1]} !important;`);
    decl.push(`--perch-card-pad: ${d.cardPad} !important;`);
    decl.push(`--perch-folder-row: ${d.folderRow} !important;`);
    decl.push(`--perch-card-gap: ${d.cardGap} !important;`);

    const rules = [":root {\n  " + decl.join("\n  ") + "\n}"];

    (s.features.accountColors ? accounts || [] : []).forEach((a, i) => {
      const color = accountColor(s, a.key, i);
      const key = cssEscapeIdent(a.key);
      rules.push(`:root { --server-${key}-color: ${color} !important; }`);
      rules.push(
        `:root[lightweightthemes] li[data-server-type][data-server-key="${key}"] > .container {` +
          ` background-color: color-mix(in srgb, ${color} 16%, transparent) !important;` +
          ` color: color-mix(in srgb, ${color} 60%, var(--perch-text)) !important; }`
      );
    });
    return rules.join("\n");
  }

  // Reading typography for plain-text mail only. Runs inside the message document, where the
  // Perch custom properties do not exist, so concrete colours are baked in.
  function buildReadingCss(rawSettings) {
    const s = normalize(rawSettings);
    if (!s.features.reading) return "";
    const p = resolvePalette(s);
    const body = (m) => `background-color: ${p[m].card} !important; color: ${p[m].text} !important;`;
    const plain = "div.moz-text-plain, div.moz-text-flowed, pre.moz-text-plain, pre.moz-text-flowed";
    return [
      `${plain} { font-family: "Source Serif 4", "Noto Serif", Georgia, serif !important; font-size: 16px !important; line-height: 1.65 !important;`,
      `  max-width: 72ch !important; margin-inline: auto !important; padding: 24px 28px !important; white-space: pre-wrap !important; }`,
      `body:has(> :is(div, pre).moz-text-plain, > :is(div, pre).moz-text-flowed) { ${body("light")} }`,
      `@media (prefers-color-scheme: dark) { body:has(> :is(div, pre).moz-text-plain, > :is(div, pre).moz-text-flowed) { ${body("dark")} } }`,
    ].join("\n");
  }

  // CSS custom properties for extension pages (options, popup) so they follow the chosen palette.
  function pageVars(rawSettings) {
    const s = normalize(rawSettings);
    const p = resolvePalette(s);
    const L = { ...p.light }, D = { ...p.dark };
    if (s.accent) { L.accent = s.accent; D.accent = s.accent; }
    const ld = (k) => `light-dark(${L[k]}, ${D[k]})`;
    return {
      "--bg": ld("canvas"), "--card": ld("card"), "--card-2": ld("card2"), "--fg": ld("text"), "--muted": ld("muted"),
      "--line": ld("border"), "--hover": ld("card3"), "--accent": ld("accent"),
      "--accent-fg": `light-dark(${textOn(L.accent)}, ${textOn(D.accent)})`,
    };
  }

  const api = { FEATURES, MAX_CUSTOM, mix, deriveScheme, resolvePalette, paletteWarnings, newCustomId, pageVars, PALETTES, DENSITIES, ACCOUNT_COLORS, DEFAULTS, normalize, contrast, luminance, textOn, buildThemeCss, buildReadingCss, accountColor, cssEscapeIdent, TOKEN_KEYS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PerchThemes = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
