"use strict";
// List-Unsubscribe (RFC 2369) parsing. Only https: and mailto: targets are ever returned.
(function (root) {
  function parseMailto(raw) {
    const rest = raw.slice("mailto:".length);
    const q = rest.indexOf("?");
    const to = decodeURIComponent(q === -1 ? rest : rest.slice(0, q)).trim();
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+$/.test(to)) return null;
    const params = new URLSearchParams(q === -1 ? "" : rest.slice(q + 1));
    return { to, subject: params.get("subject") || "unsubscribe", body: params.get("body") || "" };
  }

  function parse(header, postHeader) {
    const out = { https: null, mailto: null, oneClick: false };
    if (typeof header !== "string") return out;
    for (const m of header.matchAll(/<([^<>]+)>/g)) {
      const target = m[1].trim();
      if (/^https:\/\//i.test(target) && !out.https) {
        try { out.https = new URL(target).href; } catch { /* malformed: skip */ }
      } else if (/^mailto:/i.test(target) && !out.mailto) {
        try { out.mailto = parseMailto(target); } catch { /* malformed: skip */ }
      }
    }
    out.oneClick = /List-Unsubscribe=One-Click/i.test(String(postHeader ?? ""));
    return out;
  }

  const api = { parse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PerchUnsub = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
