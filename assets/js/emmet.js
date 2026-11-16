/* ═══════════════════════════════════════════════════════════════════
   Emmet — a compact, correct-enough Emmet implementation for Draft
   Supports: !  ·  tag  ·  #id  ·  .classes  ·  [attrs]  ·  {text}
             >  +  ^  *n  ( grouping )  ·  $ $$ $@n numbering
   Expands with correct nesting, caret placement and indentation.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
"use strict";

var VOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, param:1, source:1, track:1, wbr:1 };
var CARET = "\u0001";

function number(str, idx) {
  return String(str).replace(/(\$+)(@(-?\d+))?/g, function (m, dollars, _at, at) {
    var n = idx;
    if (at !== undefined) n = idx + (parseInt(at, 10) - 1);
    return String(n).padStart(dollars.length, "0");
  });
}
function escAttr(v) { return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function escText(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

function findClosing(src, openIdx, open, close) {
  var depth = 0, quote = null;
  for (var j = openIdx; j < src.length; j++) {
    var ch = src[j];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return j; }
  }
  return -1;
}

function parseAttrs(body, node) {
  var re = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g, m;
  while ((m = re.exec(body))) {
    var name = m[1];
    var hadEq = /(^|[^=])=($|[^=])/.test(m[0]) || m[0].indexOf("=") !== -1;
    var value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ""));
    node.attrs.push({ name: name, value: value, bare: !hadEq });
  }
}

function parse(src) {
  var i = 0;
  function parseSequence() {
    var items = [];
    while (i < src.length) {
      var ch = src[i];
      if (ch === ")") break;
      if (ch === "+") { i++; continue; }
      if (ch === ">") {
        i++;
        var children = parseSequence();
        var last = items[items.length - 1];
        if (last && children) {
          last.children = (last.children || []).concat(children);
        } else if (children) {
          for (var k = 0; k < children.length; k++) items.push(children[k]);
        }
        continue;
      }
      if (ch === "^") { i++; break; }
      if (ch === "(") {
        i++;
        var groupChildren = parseSequence();
        if (src[i] === ")") i++;
        var group = { group: true, tag: null, attrs: [], classes: [], children: groupChildren, text: null, id: null, count: 1 };
        readPostfix(group);
        items.push(group);
        continue;
      }
      var node = parseNode();
      if (!node) return null;
      readPostfix(node);
      items.push(node);
    }
    return items;
  }
  function parseNode() {
    var rest = src.slice(i), m;
    var tag = null;
    if (rest[0] === "!") { tag = "!"; i += 1; }
    else {
      m = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(rest);
      if (!m) return null;
      tag = m[0]; i += m[0].length;
    }
    var node = { group: false, tag: tag, attrs: [], classes: [], children: [], text: null, id: null, count: 1 };
    while (i < src.length) {
      var ch = src[i];
      if (ch === "#") {
        i++; var mid = /^[\w$@-]+/.exec(src.slice(i));
        if (!mid) break; node.id = mid[0]; i += mid[0].length;
      } else if (ch === ".") {
        i++; var mcl = /^[\w$@-]+/.exec(src.slice(i));
        if (!mcl) break; node.classes.push(mcl[0]); i += mcl[0].length;
      } else if (ch === "[") {
        var end = findClosing(src, i, "[", "]");
        var body = src.slice(i + 1, end === -1 ? src.length : end);
        parseAttrs(body, node);
        i = end === -1 ? src.length : end + 1;
      } else if (ch === "{") {
        var endT = findClosing(src, i, "{", "}");
        node.text = src.slice(i + 1, endT === -1 ? src.length : endT);
        i = endT === -1 ? src.length : endT + 1;
      } else break;
    }
    return node;
  }
  function readPostfix(node) {
    while (src[i] === "*") {
      i++;
      var m = /^\d{1,2}/.exec(src.slice(i));
      node.count = m ? Math.max(1, Math.min(99, parseInt(m[0], 10) || 1)) : 1;
      node.countSet = !!m;
      i += m ? m[0].length : 0;
    }
    // Emmet also allows {text} after a multiplier, e.g. li*3{Item $}
    if (src[i] === "{" && node.text == null) {
      var endT = findClosing(src, i, "{", "}");
      node.text = src.slice(i + 1, endT === -1 ? src.length : endT);
      i = endT === -1 ? src.length : endT + 1;
    }
  }
  var tree = parseSequence();
  return tree;
}

function renderAttrs(node, idx) {
  var out = [];
  if (node.id) out.push(' id="' + escAttr(number(node.id, idx)) + '"');
  if (node.classes.length) out.push(' class="' + escAttr(node.classes.map(function (c) { return number(c, idx); }).join(" ")) + '"');
  for (var a = 0; a < node.attrs.length; a++) {
    var at = node.attrs[a];
    if (at.bare) out.push(" " + at.name);
    else out.push(" " + at.name + '="' + escAttr(number(at.value, idx)) + '"');
  }
  return out.join("");
}

function skeleton(indent) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "  <title>Document</title>",
    "</head>",
    "<body>",
    "  " + CARET,
    "</body>",
    "</html>"
  ];
}

function expandNodes(nodes, depth, out, state, inheritIdx) {
  var indentUnit = state.indent;
  var pad = function (d) { var s = ""; for (var k = 0; k < d; k++) s += indentUnit; return s; };
  for (var ni = 0; ni < nodes.length; ni++) {
    var node = nodes[ni];
    var count = node.count || 1;
    for (var n = 1; n <= count; n++) {
      var idx = node.countSet ? n : (inheritIdx || 1);
      if (node.group) { expandNodes(node.children, depth, out, state, idx); continue; }
      if (node.tag === "!") { var sk = skeleton(indentUnit); for (var s = 0; s < sk.length; s++) out.push(pad(depth) + sk[s]); continue; }
      var tag = node.tag;
      var attrs = renderAttrs(node, idx);
      var open = "<" + tag + attrs + ">";
      var text = node.text != null ? number(node.text, idx) : null;
      if (VOID[tag]) { out.push(pad(depth) + open); continue; }
      if (node.children && node.children.length) {
        out.push(pad(depth) + open);
        expandNodes(node.children, depth + 1, out, state);
        out.push(pad(depth) + "</" + tag + ">");
      } else if (text != null) {
        if (text.indexOf("\n") !== -1) {
          out.push(pad(depth) + open);
          var parts = text.split("\n");
          for (var pi = 0; pi < parts.length; pi++) out.push(pad(depth + 1) + escText(parts[pi]));
          out.push(pad(depth) + "</" + tag + ">");
        } else {
          out.push(pad(depth) + open + escText(text) + "</" + tag + ">");
        }
      } else {
        var marker = state.caretDone ? "" : CARET;
        state.caretDone = true;
        out.push(pad(depth) + open + marker + "</" + tag + ">");
      }
    }
  }
}

/**
 * Expand an Emmet abbreviation.
 * @param {string} abbr
 * @param {string} [indent] indent unit string (default two spaces)
 * @returns {{text:string, caret:number|null}|null} text with caret index, or null when invalid
 */
function expand(abbr, indent) {
  if (!abbr || /^\s*$/.test(abbr)) return null;
  var tree;
  try { tree = parse(abbr); } catch (e) { return null; }
  if (!tree || !tree.length) return null;
  var state = { indent: indent == null ? "  " : indent, caretDone: false };
  var out = [];
  expandNodes(tree, 0, out, state);
  var text = out.join("\n");
  var idx = text.indexOf(CARET);
  return { text: text.replace(CARET, ""), caret: idx === -1 ? null : idx };
}

/** A quick gate: does this string look like something worth trying to expand? */
var ABBR_RE = /^(!|[a-zA-Z][a-zA-Z0-9-]*([#.\[{>+^*$-][^\s]*)*)$/;
function looksLikeAbbreviation(str) {
  if (!str) return false;
  var trimmed = str.trim();
  if (!trimmed || trimmed.length > 400) return false;
  return ABBR_RE.test(trimmed);
}

global.Emmet = { expand: expand, parse: parse, looksLikeAbbreviation: looksLikeAbbreviation, VOID: VOID };

})(typeof window !== "undefined" ? window : this);
