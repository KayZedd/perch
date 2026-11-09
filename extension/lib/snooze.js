"use strict";
// Snooze time maths in local time. Pure and deterministic given `now`.
(function (root) {
  const HOUR = 3600 * 1000;

  function atHour(base, hour) {
    const d = new Date(base);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  function addDays(base, n) {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  }

  // Returns the presets that make sense for `now` (e.g. no "This evening" at 22:00).
  function presets(now) {
    const list = [];
    list.push({ id: "later", label: "Later today", at: new Date(now.getTime() + 3 * HOUR) });
    if (now.getHours() < 16) list.push({ id: "evening", label: "This evening", at: atHour(now, 18) });
    list.push({ id: "tomorrow", label: "Tomorrow morning", at: atHour(addDays(now, 1), 8) });
    const dow = now.getDay(); // 0 Sun .. 6 Sat
    if (dow >= 1 && dow <= 4) list.push({ id: "weekend", label: "This weekend", at: atHour(addDays(now, 6 - dow), 8) });
    const toMonday = ((8 - dow) % 7) || 7;
    list.push({ id: "nextweek", label: "Next week", at: atHour(addDays(now, toMonday), 8) });
    return list;
  }

  function dueEntries(entries, now) {
    return entries.filter((e) => e.wakeAt <= now.getTime()).sort((a, b) => a.wakeAt - b.wakeAt);
  }

  function isValidWake(ts, now) {
    return Number.isFinite(ts) && ts > now.getTime();
  }

  const api = { presets, dueEntries, isValidWake };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PerchSnooze = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
