"use strict";
// Formatting for the attachment preview popover. Pure.
(function (root) {
  function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return `${Math.round(n)} B`;
    const units = ["KB", "MB", "GB"];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
  }

  // Shortens the middle of a long file name but keeps the extension: "very-long-na….pdf"
  function shortName(name, max = 34) {
    const s = String(name ?? "");
    if (s.length <= max) return s;
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 && s.length - dot <= 8 ? s.slice(dot) : "";
    return s.slice(0, max - ext.length - 1) + "…" + ext;
  }

  // list: [{ name, size }] -> { items: [{name, size}] (max `limit`), more }
  function summarize(list, limit = 6) {
    const clean = (Array.isArray(list) ? list : [])
      .filter((a) => a && a.name)
      .map((a) => ({ name: shortName(a.name), size: formatSize(a.size) }));
    return { items: clean.slice(0, limit), more: Math.max(0, clean.length - limit) };
  }

  const api = { formatSize, shortName, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PerchAttach = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
