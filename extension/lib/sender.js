"use strict";
// Helpers for the "messages from this sender" page. Pure.
(function (root) {
  function extractEmail(author) {
    const s = String(author ?? "");
    const m = s.match(/<([^<>\s]+@[^<>\s]+)>/) ?? s.match(/([^\s<>"',;]+@[^\s<>"',;]+)/);
    return m ? m[1].toLowerCase() : "";
  }

  // The query matches substrings ("ann@x.com" also finds "joann@x.com"): keep exact addresses only,
  // newest first, de-duplicated by headerMessageId (the same mail can sit in several folders).
  function exactMatches(messages, email) {
    const seen = new Set();
    return messages
      .filter((m) => extractEmail(m.author) === email)
      .filter((m) => {
        const k = m.headerMessageId || `id:${m.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function summarize(messages) {
    const dates = messages.map((m) => new Date(m.date).getTime()).filter(Number.isFinite);
    return {
      count: messages.length,
      unread: messages.filter((m) => !m.read).length,
      withAttachments: messages.filter((m) => m.attachments?.length || m.hasAttachments).length,
      first: dates.length ? new Date(Math.min(...dates)) : null,
      last: dates.length ? new Date(Math.max(...dates)) : null,
    };
  }

  const api = { extractEmail, exactMatches, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PerchSender = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
