import { test } from "node:test";
import assert from "node:assert/strict";
import { addImportant } from "../tools/important.mjs";

const norm = (s) => s.replace(/\s+/g, " ").trim();

test("adds !important to each declaration, including the last without semicolon", () => {
  assert.equal(norm(addImportant("a { color: red; margin: 0 }")), "a { color: red !important; margin: 0 !important }");
});

test("keeps existing !important untouched", () => {
  assert.equal(norm(addImportant("a { color: red !important; }")), "a { color: red !important; }");
});

test("does not split on ; inside url() or strings", () => {
  const out = addImportant('a { background: url("data:image/png;base64,AAA"); content: "a;b"; }');
  assert.match(out, /url\("data:image\/png;base64,AAA"\) !important;/);
  assert.match(out, /content: "a;b" !important;/);
});

test("recurses into @media and @-moz-document groups", () => {
  const out = norm(addImportant("@media (prefers-reduced-motion) { a { transition: none } } @-moz-document url-prefix(about:) { b { top: 0 } }"));
  assert.match(out, /transition: none !important/);
  assert.match(out, /top: 0 !important/);
});

test("leaves @keyframes alone", () => {
  const out = norm(addImportant("@keyframes x { from { opacity: 0 } to { opacity: 1 } }"));
  assert.equal(out, "@keyframes x { from { opacity: 0 } to { opacity: 1 } }");
});

test("custom properties get !important too", () => {
  assert.match(addImportant(":root { --a: light-dark(#fff, #000); }"), /--a: light-dark\(#fff, #000\) !important;/);
});

test("strips comments", () => {
  assert.equal(norm(addImportant("/* hi; { */ a { top: 0 }")), "a { top: 0 !important }");
});

test("rejects CSS nesting instead of emitting wrong output", () => {
  assert.throws(() => addImportant("a { color: red; & b { top: 0 } }"), /nesting/i);
});

test("throws on unbalanced braces", () => {
  assert.throws(() => addImportant("a { color: red;"), /Unbalanced/);
});

import { splitSelectors, scopeSelectors } from "../tools/important.mjs";

test("splitSelectors keeps commas inside :is() and attribute strings", () => {
  assert.deepEqual(splitSelectors("a, :is(b, c), [x='1,2'] d").map((s) => s.trim()), ["a", ":is(b, c)", "[x='1,2'] d"]);
});

test("scopeSelectors prefixes everything except :root-led selectors", () => {
  assert.equal(scopeSelectors("a, :root b, :root:not(.x)", ".s"), ".s a,\n:root b,\n:root:not(.x)");
});

test("scope option rewrites rule selectors, also inside @media, never at-rules or keyframes", () => {
  const out = norm(addImportant("a, b { top: 0 } @media (x) { c { top: 1 } } @keyframes k { from { top: 0 } }", { scope: ".s" }));
  assert.equal(out, ".s a, .s b { top: 0 !important } @media (x) { .s c { top: 1 !important } } @keyframes k { from { top: 0 } }");
});
