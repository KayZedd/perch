/* global PerchThemes, PerchTransfer */
const $ = id => document.getElementById(id);
const FEATURE_INFO = {
  theme: ["Perch theme", "Floating panes, dock, cards and the palette. Off restores Betterbird's own look."],
  accountColors: ["Account colours", "Tint accounts in the folder pane and mark them on messages."],
  avatars: ["Sender initials", "A coloured circle with initials on each message card."],
  attachments: ["Attachment preview", "Hover the paperclip on a message to see file names and sizes."],
  reading: ["Reading typography", "Serif, narrow column and palette colours for plain-text mail."],
  snooze: ["Snooze", "Send a message away and bring it back unread at a time you pick."],
  unsubscribe: ["Unsubscribe", "Offer a one-click unsubscribe on mailing-list messages."],
  sender: ["Messages from this sender", "Right-click a message, or use the header button, to see everything from that address."],
};
const SCHEME_FIELDS = [["canvas", "Background"], ["card", "Panes"], ["text", "Text"], ["accent", "Accent"]];
const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;

let settings = PerchThemes.normalize(null);
let accounts = [];
let timer = null;
let editing = null; // { id|null, label, light, dark }

function toast(text) {
  $("saved").textContent = text;
  clearTimeout(timer);
  timer = setTimeout(() => ($("saved").textContent = ""), 1800);
}

async function save(patch) {
  settings = PerchThemes.normalize({ ...settings, ...patch });
  await browser.storage.local.set({ settings });
  render();
  toast("Saved");
}

function applyPageTheme() {
  for (const [k, v] of Object.entries(PerchThemes.pageVars(settings))) document.documentElement.style.setProperty(k, v);
}

function swatch(colors, cls = "swatch") {
  const sw = document.createElement("div");
  sw.className = cls;
  for (const col of colors) {
    const s = document.createElement("span");
    s.style.background = col;
    sw.append(s);
  }
  return sw;
}

function paletteColors(id) {
  const p = PerchThemes.resolvePalette({ ...settings, palette: id });
  const c = dark() ? p.dark : p.light;
  return [c.canvas, c.card, c.card3, settings.accent ?? c.accent];
}

// ---- features
function renderFeatures() {
  const wrap = $("features");
  wrap.replaceChildren();
  for (const name of PerchThemes.FEATURES) {
    const [title, desc] = FEATURE_INFO[name];
    const row = document.createElement("label");
    row.className = "feat";
    const t = document.createElement("strong");
    t.textContent = title;
    const d = document.createElement("span");
    d.textContent = desc;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = settings.features[name];
    input.addEventListener("change", () => save({ features: { ...settings.features, [name]: input.checked } }));
    row.append(t, d, input);
    wrap.append(row);
  }
}

// ---- palettes
function renderPalettes() {
  const wrap = $("palettes");
  wrap.replaceChildren();
  const entries = [
    ...Object.entries(PerchThemes.PALETTES).map(([id, p]) => ({ id, label: p.label, custom: false })),
    ...settings.customPalettes.map(c => ({ id: c.id, label: c.label, custom: true })),
  ];
  for (const e of entries) {
    const box = document.createElement("div");
    box.className = "pwrap";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "palette";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(settings.palette === e.id));
    const name = document.createElement("div");
    name.textContent = e.label;
    b.append(swatch(paletteColors(e.id)), name);
    b.addEventListener("click", () => save({ palette: e.id }));
    box.append(b);
    if (e.custom) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit ${e.label}`);
      edit.addEventListener("click", () => openEditor(settings.customPalettes.find(c => c.id === e.id)));
      box.append(edit);
    }
    wrap.append(box);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "newpal";
  add.textContent = "+ New palette";
  add.disabled = settings.customPalettes.length >= PerchThemes.MAX_CUSTOM;
  add.addEventListener("click", () => openEditor(null));
  wrap.append(add);
}

function renderBaseOptions() {
  const sel = $("pBase");
  sel.replaceChildren();
  const opts = [
    ...Object.entries(PerchThemes.PALETTES).map(([id, p]) => [id, p.label]),
    ...settings.customPalettes.map(c => [c.id, c.label]),
  ];
  for (const [id, label] of opts) sel.append(new Option(label, id));
  sel.value = settings.palette;
}

function schemeOf(id, mode) {
  const p = PerchThemes.resolvePalette({ ...settings, palette: id });
  const c = p[mode];
  return { canvas: c.canvas, card: c.card, text: c.text, accent: c.accent };
}

function openEditor(existing) {
  editing = existing
    ? { id: existing.id, label: existing.label, light: { ...existing.light }, dark: { ...existing.dark } }
    : { id: null, label: "", light: schemeOf(settings.palette, "light"), dark: schemeOf(settings.palette, "dark") };
  $("editor").hidden = false;
  $("editorTitle").textContent = existing ? `Edit ${existing.label}` : "New palette";
  $("pName").value = editing.label;
  $("pDelete").hidden = !existing;
  renderBaseOptions();
  $("pBase").disabled = !!existing;
  renderEditorColors();
  $("pName").focus();
}

function renderEditorColors() {
  const wrap = $("pColors");
  wrap.replaceChildren();
  for (const mode of ["light", "dark"]) {
    const row = document.createElement("div");
    row.className = "crow";
    const h = document.createElement("strong");
    h.textContent = mode === "light" ? "Light" : "Dark";
    row.append(h);
    for (const [key, label] of SCHEME_FIELDS) {
      const l = document.createElement("label");
      const input = document.createElement("input");
      input.type = "color";
      input.value = editing[mode][key];
      input.addEventListener("input", () => {
        editing[mode][key] = input.value;
        updatePreview();
      });
      l.append(input, document.createTextNode(label));
      row.append(l);
    }
    wrap.append(row);
  }
  updatePreview();
}

function updatePreview() {
  const prev = $("pPreview");
  prev.replaceChildren();
  for (const mode of ["light", "dark"]) {
    const d = PerchThemes.deriveScheme(editing[mode]);
    for (const col of [d.canvas, d.card, d.card3, d.text, d.accent]) {
      const s = document.createElement("span");
      s.style.background = col;
      prev.append(s);
    }
  }
  const warn = $("pWarn");
  warn.replaceChildren();
  for (const w of PerchThemes.paletteWarnings(editing)) {
    const li = document.createElement("li");
    li.textContent = w;
    warn.append(li);
  }
}

function closeEditor() {
  editing = null;
  $("editor").hidden = true;
}

async function saveEditor(e) {
  e.preventDefault();
  const label = $("pName").value.trim();
  if (!label) return;
  const entry = { id: editing.id ?? PerchThemes.newCustomId(), label, light: editing.light, dark: editing.dark };
  const rest = settings.customPalettes.filter(c => c.id !== entry.id);
  closeEditor();
  await save({ customPalettes: [...rest, entry], palette: entry.id });
}

async function deletePalette() {
  const id = editing.id;
  closeEditor();
  await save({
    customPalettes: settings.customPalettes.filter(c => c.id !== id),
    palette: settings.palette === id ? "paper" : settings.palette,
  });
}

function exportJson() {
  $("pJson").value = JSON.stringify({ label: $("pName").value.trim() || "Custom", light: editing.light, dark: editing.dark }, null, 2);
}

function importJson() {
  try {
    const raw = JSON.parse($("pJson").value);
    const n = PerchThemes.normalize({ palette: "c_import", customPalettes: [{ id: "c_import", label: raw.label, light: raw.light, dark: raw.dark }] });
    const c = n.customPalettes[0];
    if (!c) throw new Error("needs label, light and dark with canvas, card, text and accent as #rrggbb");
    editing.light = c.light;
    editing.dark = c.dark;
    $("pName").value = c.label;
    renderEditorColors();
    toast("Loaded into the editor. Save to keep it.");
  } catch (err) {
    toast("Import failed: " + err.message);
  }
}

// ---- backup
function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importText(text) {
  const r = PerchTransfer.parseImport(text, PerchThemes.normalize);
  if (!r.ok) {
    toast("Import failed: " + r.error);
    return;
  }
  settings = r.settings;
  await browser.storage.local.set({ settings });
  render();
  toast("Imported");
}

// ---- accounts
function renderAccounts() {
  const wrap = $("accounts");
  wrap.replaceChildren();
  if (!accounts.length) {
    wrap.textContent = "No accounts found.";
    return;
  }
  accounts.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "account";
    const input = document.createElement("input");
    input.type = "color";
    input.value = PerchThemes.accountColor(settings, a.key, i);
    input.disabled = !settings.features.accountColors;
    input.setAttribute("aria-label", `Colour for ${a.name}`);
    input.addEventListener("change", () => save({ accountColors: { ...settings.accountColors, [a.key]: input.value } }));
    const label = document.createElement("span");
    label.textContent = a.name;
    row.append(input, label);
    wrap.append(row);
  });
}

function render() {
  applyPageTheme();
  renderFeatures();
  renderPalettes();
  const p = PerchThemes.resolvePalette(settings);
  $("accent").value = settings.accent ?? (dark() ? p.dark.accent : p.light.accent);
  $("density").value = settings.density;
  renderAccounts();
}

async function init() {
  const stored = await browser.storage.local.get("settings");
  settings = PerchThemes.normalize(stored.settings);
  accounts = await browser.perch.getAccounts();
  $("accent").addEventListener("change", e => save({ accent: e.target.value }));
  $("accentReset").addEventListener("click", () => save({ accent: null }));
  $("density").addEventListener("change", e => save({ density: e.target.value }));
  $("editor").addEventListener("submit", saveEditor);
  $("pCancel").addEventListener("click", closeEditor);
  $("pDelete").addEventListener("click", deletePalette);
  $("pExport").addEventListener("click", exportJson);
  $("pImport").addEventListener("click", importJson);
  $("pBase").addEventListener("change", e => {
    if (!editing || editing.id) return;
    editing.light = schemeOf(e.target.value, "light");
    editing.dark = schemeOf(e.target.value, "dark");
    renderEditorColors();
  });
  $("bExport").addEventListener("click", () => downloadText("perch-settings.json", PerchTransfer.exportSettings(settings, PerchThemes.normalize)));
  $("bFill").addEventListener("click", () => ($("bJson").value = PerchTransfer.exportSettings(settings, PerchThemes.normalize)));
  $("bLoad").addEventListener("click", () => importText($("bJson").value));
  $("bFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) await importText(await file.text());
  });
  render();
  // DEV-BEGIN
  if (new URLSearchParams(location.search).get("edit") === "new") openEditor(null);
  // DEV-END
}

init();
