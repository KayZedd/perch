"use strict";
// Export / import of all Perch settings as one JSON document. Pure; the options page does the I/O.
(function (root) {
  const FORMAT = "perch-settings";
  const VERSION = 1;
  const MAX_BYTES = 256 * 1024;

  function exportSettings(settings, normalize) {
    return JSON.stringify({ format: FORMAT, version: VERSION, settings: normalize(settings) }, null, 2);
  }

  // Never throws: returns { ok: true, settings } or { ok: false, error }.
  function parseImport(text, normalize) {
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Nothing to import." };
    if (text.length > MAX_BYTES) return { ok: false, error: "File is too large to be a Perch settings export." };
    let doc;
    try {
      doc = JSON.parse(text);
    } catch {
      return { ok: false, error: "Not valid JSON." };
    }
    if (!doc || doc.format !== FORMAT) return { ok: false, error: "This is not a Perch settings export." };
    if (!Number.isInteger(doc.version) || doc.version > VERSION) {
      return { ok: false, error: "This export was made by a newer Perch. Update the add-on first." };
    }
    if (!doc.settings || typeof doc.settings !== "object") return { ok: false, error: "The export has no settings." };
    return { ok: true, settings: normalize(doc.settings) };
  }

  const api = { FORMAT, VERSION, MAX_BYTES, exportSettings, parseImport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PerchTransfer = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
