// Adds !important to every declaration. Agent sheets only beat the app's own
// author rules when the declaration is !important, so the source stays readable
// and this runs at build time.
//
// Handles: comments, strings, url()/function parens containing ';', nested
// @media/@supports/@-moz-document blocks. Skips @keyframes and @font-face bodies.
// Does NOT support CSS nesting (`&`): sources are written flat on purpose.

const GROUP_AT = /^@(media|supports|-moz-document|layer|container)\b/i;
const SKIP_AT = /^@(keyframes|font-face|-moz-keyframes|namespace|property)\b/i;

// Splits a selector list on top-level commas (commas inside :is(), :not(), [attr="a,b"] are kept).
export function splitSelectors(list) {
  const parts = [];
  let depth = 0, quote = null, cur = "";
  for (const ch of list) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

// Prefixes every selector with `prefix `, except those that already start with :root
// (those are written explicitly by the author, e.g. design tokens or root-element rules).
export function scopeSelectors(list, prefix) {
  return splitSelectors(list)
    .map((sel) => {
      const t = sel.trim();
      return t.startsWith(":root") ? t : `${prefix} ${t}`;
    })
    .join(",\n");
}

export function addImportant(input, { scope = null } = {}) {
  const css = input.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  const stack = []; // 'rules' | 'decl' | 'skip'
  let prelude = ""; // text since last { } ;  while in a rules context
  let decl = ""; // current declaration chunk in a decl context
  let paren = 0;
  let quote = null;

  const ctx = () => stack[stack.length - 1] ?? "rules";

  const flushDecl = (terminator) => {
    if (ctx() === "decl" && decl.trim()) {
      const body = decl.replace(/\s+$/, "");
      const trail = decl.slice(body.length);
      const bang = /!\s*important\s*$/i.test(body) || !body.includes(":") ? "" : " !important";
      out += body + bang + trail;
    } else {
      out += decl;
    }
    decl = "";
    out += terminator;
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const inDecl = ctx() === "decl";

    if (quote) {
      (inDecl ? (decl += ch) : (prelude += ch));
      if (ch === "\\") { const n = css[++i] ?? ""; inDecl ? (decl += n) : (prelude += n); }
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inDecl ? (decl += ch) : (prelude += ch);
      continue;
    }
    if (ch === "(") paren++;
    if (ch === ")") paren = Math.max(0, paren - 1);

    if (ch === "{" && paren === 0) {
      const head = (inDecl ? decl : prelude).trim();
      if (inDecl) {
        throw new Error("CSS nesting is not supported: " + head.slice(0, 60));
      }
      const isAt = head.startsWith("@");
      const outerCtx = ctx();
      out += (scope && outerCtx === "rules" && !isAt && head ? prelude.match(/^\s*/)[0] + scopeSelectors(head, scope) + " " : prelude) + "{";
      stack.push(ctx() === "skip" || SKIP_AT.test(head) ? "skip" : GROUP_AT.test(head) ? "rules" : "decl");
      prelude = "";
      continue;
    }
    if (ch === "}" && paren === 0) {
      if (inDecl) flushDecl("");
      else out += prelude;
      prelude = "";
      stack.pop();
      out += "}";
      continue;
    }
    if (ch === ";" && paren === 0) {
      if (inDecl) flushDecl(";");
      else { out += prelude + ";"; prelude = ""; }
      continue;
    }
    if (inDecl) decl += ch;
    else if (ctx() === "skip") out += ch;
    else prelude += ch;
  }
  if (stack.length) throw new Error("Unbalanced braces");
  return out + prelude;
}
