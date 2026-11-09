"use strict";
// Sender initials and a stable hue. Pure.
(function (root) {
  function displayName(sender) {
    let s = String(sender ?? "").trim();
    const m = s.match(/^"?([^"<]*?)"?\s*<([^>]*)>$/);
    if (m) s = m[1].trim() || m[2].trim();
    return s;
  }

  function initials(sender) {
    const name = displayName(sender);
    const base = name.includes("@") ? name.split("@")[0] : name;
    const words = base.split(/[\s._+-]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    if (!words.length) return "?";
    const first = Array.from(words[0].replace(/^[^\p{L}\p{N}]+/u, ""))[0];
    const second = words.length > 1 ? Array.from(words[words.length - 1].replace(/^[^\p{L}\p{N}]+/u, ""))[0] : "";
    return (first + second).toLocaleUpperCase();
  }

  function hue(sender) {
    const key = displayName(sender).toLowerCase();
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 360;
  }

  const api = { displayName, initials, hue };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PerchAvatar = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
