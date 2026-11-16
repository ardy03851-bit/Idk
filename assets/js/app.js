/* ═══════════════════════════════════════════════════════════════════
   Draft — HTML Studio · main application
   Liquid-glass shell · CodeMirror 5 editor · Emmet assist · console
   capture · device viewport preview · command palette · settings
   ═══════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

var $ = function (id) { return document.getElementById(id); };
var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || /Mac OS X/.test(navigator.userAgent || "");
var MOD = isMac ? "⌘" : "Ctrl";

/* ───────────────────────── helpers ───────────────────────── */
var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]; }); };
var fmtBytes = function (n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB"; };
var nowTime = function () { return new Date().toLocaleTimeString("en-GB", { hour12: false }); };

/* guarded storage (sandboxed iframes may block localStorage) */
var store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ───────────────────────── settings ───────────────────────── */
var DEFAULT_SETTINGS = { fontSize: 13, indent: 2, accent: "spectral", autorunDelay: 800, reduceMotion: false, wrap: false, assist: true };
var settings = Object.assign({}, DEFAULT_SETTINGS);
try { Object.assign(settings, JSON.parse(store.get("draft-studio.settings.v1") || "{}")); } catch (e) {}
var lastAutorunDelay = settings.autorunDelay > 0 ? settings.autorunDelay : 800;

function saveSettings() { store.set("draft-studio.settings.v1", JSON.stringify(settings)); }

function applyAccent(accent) {
  document.documentElement.setAttribute("data-accent", accent);
  document.querySelectorAll(".swatch[data-accent]").forEach(function (b) {
    var on = b.getAttribute("data-accent") === accent;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
}
function applyMotion() {
  if (settings.reduceMotion) document.documentElement.setAttribute("data-motion", "reduce");
  else document.documentElement.removeAttribute("data-motion");
  var mt = $("motionToggle"); if (mt) mt.checked = settings.reduceMotion;
  window.dispatchEvent(new Event("draft:motion"));
}
function applyFontSize() {
  document.documentElement.style.setProperty("--cm-font-size", settings.fontSize + "px");
  var fv = $("fontSizeVal"); if (fv) fv.textContent = settings.fontSize;
}
function applyIndent() {
  var i2 = $("indent2"), i4 = $("indent4");
  if (i2) i2.classList.toggle("on", settings.indent === 2);
  if (i4) i4.classList.toggle("on", settings.indent === 4);
  if (ed && ed.cm) { ed.cm.setOption("indentUnit", settings.indent); ed.cm.setOption("tabSize", settings.indent); }
}
function applyAutorunUI() {
  var on = settings.autorunDelay > 0;
  var ab = $("autorunBtn"); if (ab) { ab.classList.toggle("on", on); ab.setAttribute("aria-pressed", String(on)); }
  var sb = $("autorunSb"); if (sb) { sb.classList.toggle("on", on); sb.textContent = on ? "auto-run" : "manual"; }
  var chips = document.querySelectorAll(".sp-segment [data-delay]");
  chips.forEach(function (c) { var on2 = +c.getAttribute("data-delay") === settings.autorunDelay; c.classList.toggle("on", on2); c.setAttribute("aria-checked", String(on2)); });
}
function applyAssistUI() {
  var ab = $("assistBtn"); if (ab) { ab.classList.toggle("on", settings.assist); ab.setAttribute("aria-pressed", String(settings.assist)); }
}
function applyAllSettings() { applyAccent(settings.accent); applyMotion(); applyFontSize(); applyIndent(); applyAutorunUI(); applyAssistUI(); }

applyAllSettings();

/* ───────────────────────── toast ───────────────────────── */
var TOAST_ICONS = {
  ok: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  err: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5V13M12 16.5h.01"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5M12 7.5h.01"/></svg>'
};
function toast(message, kind) {
  var host = $("toasts");
  var t = document.createElement("div");
  t.className = "toast" + (kind === "err" ? " err" : "");
  t.innerHTML = '<span class="ic">' + (TOAST_ICONS[kind] || TOAST_ICONS.ok) + "</span><span>" + esc(message) + "</span>";
  host.appendChild(t);
  setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 220); }, kind === "err" ? 3400 : 2300);
  while (host.children.length > 4) host.removeChild(host.firstChild);
}

/* ───────────────────────── status ───────────────────────── */
function setStatus(msg, state) {
  var m = $("statusMsg"); if (m) m.textContent = msg;
  var d = $("statusDot"); if (d) d.className = "dot" + (state ? " " + state : "");
}

/* ───────────────────────── confirm dialog ───────────────────────── */
var confirmResolve = null;
function confirmDialog(title, body, okLabel) {
  $("confirmTitle").textContent = title;
  $("confirmBody").innerHTML = body;
  $("confirmYes").textContent = okLabel || "Confirm";
  $("confirmBd").classList.add("open");
  $("confirmYes").focus();
  return new Promise(function (res) { confirmResolve = res; });
}
function closeConfirm(v) {
  $("confirmBd").classList.remove("open");
  if (confirmResolve) { confirmResolve(v); confirmResolve = null; }
}
$("confirmYes").addEventListener("click", function () { closeConfirm(true); });
$("confirmNo").addEventListener("click", function () { closeConfirm(false); });
$("confirmBd").addEventListener("mousedown", function (e) { if (e.target === $("confirmBd")) closeConfirm(false); });

var filename = "untitled.html";
var ed = null;
var docChars = 0; // incremental document size, avoids O(n) getValue() per keystroke

/* ═════════════════════════ editor ═════════════════════════ */
var preview = $("preview"), frame = $("previewFrame"), workspace = $("workspace");

/* ---- ghost-text prediction (inline Emmet preview) ---- */
var ghost = { overlay: null, from: null, to: null, expansion: null, abbr: null };

function hideGhost() {
  if (ghost.overlay) { ghost.overlay.remove(); ghost.overlay = null; }
  ghost.from = null; ghost.to = null; ghost.expansion = null;
}
function currentAbbr(cm) {
  var cur = cm.getCursor();
  var line = cm.getLine(cur.line);
  var before = line.slice(0, cur.ch);
  var m = /(^|[\s(>+])([!a-zA-Z][\w.#\[\]{}*$+>^\-@]*)$/.exec(before);
  if (!m) return null;
  return { abbr: m[2], from: { line: cur.line, ch: cur.ch - m[2].length }, to: cur };
}
function assistContextOk(cm) {
  try {
    var ctx = window.DraftHints && window.DraftHints.contextOf ? window.DraftHints.contextOf(cm) : { area: "html-text" };
    return ctx.area === "html-text";
  } catch (e) { return true; }
}
function showGhostFor(cm) {
  hideGhost();
  if (!settings.assist || !window.Emmet) return;
  if (!assistContextOk(cm)) return;
  var hit = currentAbbr(cm);
  if (!hit) return;
  if (hit.abbr.length < 2 && hit.abbr !== "!") return;
  var indent = new Array(settings.indent + 1).join(" ");
  var res = window.Emmet.expand(hit.abbr, indent);
  if (!res) return;
  var coords = cm.cursorCoords(hit.to, "window");
  var firstLine = String(res.text).split("\n")[0];
  var previewText = firstLine.length > 52 ? firstLine.slice(0, 52) + "…" : firstLine;
  var el = document.createElement("div");
  el.className = "ghost-overlay";
  el.style.left = coords.left + "px";
  el.style.top = (coords.top - 1) + "px";
  el.textContent = previewText + (String(res.text).indexOf("\n") !== -1 ? "  ⏎" : "");
  var chip = document.createElement("span");
  chip.className = "ghost-tab";
  chip.textContent = "Tab";
  el.appendChild(chip);
  document.body.appendChild(el);
  ghost.overlay = el; ghost.from = hit.from; ghost.to = hit.to; ghost.expansion = res; ghost.abbr = hit.abbr;
}

/* smart Tab: accept ghost prediction, else expand Emmet, else indent */
function smartTab(cm) {
  if (ghost.overlay && ghost.expansion) return acceptGhost(cm);
  if (settings.assist && window.Emmet && assistContextOk(cm)) {
    var hit = currentAbbr(cm);
    if (hit && (hit.abbr.length >= 2 || hit.abbr === "!")) {
      if (insertExpansion(cm, hit.abbr, hit.from, hit.to)) return;
    }
  }
  cm.execCommand("insertSoftTab");
}
function insertExpansion(cm, abbr, from, to) {
  var indent = new Array(settings.indent + 1).join(" ");
  var res = window.Emmet.expand(abbr, indent);
  if (!res) return false;
  var line = cm.getLine(from.line);
  var baseIndent = /^\s*/.exec(line)[0];
  var parts = String(res.text).split("\n");
  var body = parts.map(function (l, i) { return i === 0 ? l : baseIndent + l; }).join("\n");
  var caret = res.caret;
  cm.replaceRange(body, from, to, "+emmet");
  var newLine, newCh;
  if (caret == null) {
    newLine = from.line + parts.length - 1;
    newCh = (parts.length === 1 ? from.ch : baseIndent.length) + parts[parts.length - 1].length;
  } else {
    var pre = String(res.text).slice(0, caret).split("\n");
    newLine = from.line + pre.length - 1;
    newCh = (pre.length === 1 ? from.ch : baseIndent.length) + pre[pre.length - 1].length;
  }
  cm.setCursor({ line: newLine, ch: newCh });
  cm.scrollIntoView({ line: newLine, ch: newCh }, 80);
  hideGhost();
  return true;
}
function acceptGhost(cm) {
  var g = ghost;
  hideGhost();
  if (g.abbr && g.from && g.to) return insertExpansion(cm, g.abbr, g.from, g.to);
  var hit = currentAbbr(cm);
  return hit ? insertExpansion(cm, hit.abbr, hit.from, hit.to) : false;
}

/* ---- smart Backspace: delete empty auto-closed pairs/tags ---- */
function smartBackspace(cm) {
  var cur = cm.getCursor();
  if (cm.somethingSelected()) { cm.execCommand("delCharBefore"); return; }
  var line = cm.getLine(cur.line);
  var before = line.slice(0, cur.ch), after = line.slice(cur.ch);
  // <tag>|</tag>
  var open = /<([a-zA-Z][\w-]*)(\s[^>]*)?>$/.exec(before);
  if (open) {
    var closeRe = new RegExp("^</" + open[1] + "\\s*>");
    var mClose = closeRe.exec(after);
    if (mClose) {
      cm.replaceRange("", { line: cur.line, ch: cur.ch - open[0].length }, { line: cur.line, ch: cur.ch + mClose[0].length }, "+pair");
      return;
    }
  }
  // (|) [|] {|} "|" '|' `|`
  var PAIRS = { ")": "(", "]": "[", "}": "{", '"': '"', "'": "'", "`": "`" };
  var b = before.slice(-1), a = after.slice(0, 1);
  if (b && a && PAIRS[a] === b) {
    cm.replaceRange("", { line: cur.line, ch: cur.ch - 1 }, { line: cur.line, ch: cur.ch + 1 }, "+pair");
    return;
  }
  cm.execCommand("delCharBefore");
}

/* ---- duplicate / move / delete lines ---- */
function duplicateLine(cm) {
  cm.operation(function () {
    var ranges = cm.listSelections().slice().reverse();
    ranges.forEach(function (r) {
      var from = { line: r.from().line, ch: 0 };
      var to = { line: r.to().line, ch: cm.getLine(r.to().line).length };
      var text = cm.getRange(from, to);
      cm.replaceRange(text + "\n", { line: to.line, ch: cm.getLine(to.line).length }, null, "+duplicate");
    });
  });
}
function moveLine(cm, dir) {
  var cur = cm.getCursor();
  var target = cur.line + dir;
  if (target < 0 || target >= cm.lineCount()) return;
  var lineText = cm.getLine(cur.line);
  cm.operation(function () {
    if (dir < 0) {
      var prev = cm.getLine(target);
      cm.replaceRange(lineText + "\n" + prev, { line: target, ch: 0 }, { line: cur.line, ch: lineText.length }, "+move");
    } else {
      var next = cm.getLine(target);
      cm.replaceRange(next + "\n" + lineText, { line: cur.line, ch: 0 }, { line: target, ch: next.length }, "+move");
    }
    cm.setCursor({ line: target, ch: cur.ch });
  });
}
function deleteLine(cm) {
  var cur = cm.getCursor();
  if (cm.lineCount() === 1) { cm.replaceRange("", { line: 0, ch: 0 }, { line: 0, ch: cm.getLine(0).length }); return; }
  var from = { line: cur.line, ch: 0 };
  var to = cur.line + 1 < cm.lineCount() ? { line: cur.line + 1, ch: 0 } : { line: cur.line, ch: cm.getLine(cur.line).length };
  cm.replaceRange("", from, to, "+delete");
}

/* ---- boot editor ---- */
function initEditor(initial) {
  var host = $("editorHost");
  if (typeof CodeMirror !== "undefined") {
    var cm = CodeMirror(host, {
      value: initial,
      mode: "htmlmixed",
      theme: "draft",
      lineNumbers: true,
      lineWrapping: !!settings.wrap,
      autoCloseTags: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      matchTags: { bothTags: true },
      styleActiveLine: true,
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
      indentUnit: settings.indent,
      tabSize: settings.indent,
      indentWithTabs: false,
      smartIndent: true,
      electricChars: true,
      spellcheck: false,
      autocorrect: false,
      autocapitalize: false,
      historyEventDelay: 250,
      viewportMargin: 40,
      maxHighlightLength: 20000,
      extraKeys: {
        "Tab": smartTab,
        "Shift-Tab": "indentLess",
        "Ctrl-Space": function (cm) { cm.showHint({ hint: window.DraftHints.hint, completeSingle: false, alignWithWord: true }); },
        "Cmd-Space": function (cm) { cm.showHint({ hint: window.DraftHints.hint, completeSingle: false, alignWithWord: true }); },
        "Backspace": smartBackspace,
        "Ctrl-D": duplicateLine,
        "Cmd-D": duplicateLine,
        "Alt-Up": function (cm) { moveLine(cm, -1); },
        "Alt-Down": function (cm) { moveLine(cm, 1); },
        "Ctrl-Shift-K": deleteLine,
        "Cmd-Shift-K": deleteLine,
        "Ctrl-/": "toggleComment",
        "Cmd-/": "toggleComment",
        "Ctrl-J": "toMatchingTag",
        "Cmd-J": "toMatchingTag",
        "Ctrl-Q": "toggleFold"
      }
    });

    cm.on("cursorActivity", function () { hideGhost(); updateSelectionInfo(); updateCursorPos(); });
    cm.on("scroll", function () { hideGhost(); });
    cm.on("blur", function () { hideGhost(); });
    cm.on("change", function (instance, change) {
      hideGhost();
      var added = 0, removed = 0, i;
      for (i = 0; i < change.text.length; i++) added += change.text[i].length;
      added += Math.max(0, change.text.length - 1);
      for (i = 0; i < change.removed.length; i++) removed += change.removed[i].length;
      removed += Math.max(0, change.removed.length - 1);
      docChars = Math.max(0, docChars + added - removed);
      scheduleRun(); scheduleSave(); updateMetricsSoon();
      clearTimeout(cm._ghostTimer);
      cm._ghostTimer = setTimeout(function () { showGhostFor(cm); }, 170);
    });
    /* soft, debounced autocomplete */
    cm.on("inputRead", function (instance, change) {
      if (!settings.assist || !window.DraftHints) return;
      if (change.origin !== "+input") return;
      var inserted = (change.text && change.text.join("")) || "";
      if (!/^[A-Za-z0-9!<":'-]$/.test(inserted)) return;
      if (inserted === "-" || inserted === "'" || inserted === "0" || inserted === "1" || inserted === "2" || inserted === "3" || inserted === "4" || inserted === "5" || inserted === "6" || inserted === "7" || inserted === "8" || inserted === "9") {
        // allow in css (values) and html (closing tags) but cheap-out elsewhere
      }
      clearTimeout(cm._hintTimer);
      cm._hintTimer = setTimeout(function () {
        if (cm.state && cm.state.completionActive) return;
        var result;
        try { result = window.DraftHints.hint(cm); } catch (e) { return; }
        if (result && result.list && result.list.length) {
          cm.showHint({ hint: window.DraftHints.hint, completeSingle: false, alignWithWord: true });
        }
      }, 150);
    });

    // apply saved font size
    document.documentElement.style.setProperty("--cm-font-size", settings.fontSize + "px");

    ed = {
      cm: cm,
      getValue: function () { return cm.getValue(); },
      setValue: function (v) { cm.setValue(v); docChars = v.length; },
      replaceDocument: function (v) {
        var lastLine = cm.lastLine();
        cm.replaceRange(v, { line: 0, ch: 0 }, { line: lastLine, ch: cm.getLine(lastLine).length }, "+doc");
        docChars = v.length;
      },
      getSize: function () { return docChars; },
      clearHistory: function () { cm.clearHistory(); },
      focus: function () { cm.focus(); },
      gotoLine: function (n) { cm.setCursor(Math.max(0, n - 1), 0); cm.scrollIntoView(null, 100); cm.focus(); },
      setWrap: function (on) { cm.setOption("lineWrapping", on); settings.wrap = on; saveSettings(); }
    };
  } else {
    var ta = document.createElement("textarea");
    ta.className = "fallback-editor";
    ta.spellcheck = false;
    ta.wrap = settings.wrap ? "soft" : "off";
    ta.value = initial;
    host.appendChild(ta);
    ed = {
      getValue: function () { return ta.value; },
      setValue: function (v) { ta.value = v; docChars = v.length; },
      replaceDocument: function (v) { ta.value = v; docChars = v.length; },
      getSize: function () { return ta.value.length; },
      clearHistory: function () {},
      focus: function () { ta.focus(); },
      gotoLine: function (n) {
        var pos = ta.value.split("\n").slice(0, n - 1).join("\n").length;
        ta.focus(); ta.setSelectionRange(pos, pos);
      },
      setWrap: function (on) { ta.wrap = on ? "soft" : "off"; settings.wrap = on; saveSettings(); }
    };
    ta.addEventListener("input", function () { docChars = ta.value.length; scheduleRun(); scheduleSave(); updateMetricsSoon(); });
    toast("CodeMirror failed to load — plain-text fallback active", "err");
  }
}

/* ═════════════════════════ console capture ═════════════════════════ */
var MAX_LOGS = 800;
var logTotal = 0, logErr = 0, logWarn = 0;
var consoleFilter = "all";

var BRIDGE = '<script>(function(){var P=function(m){try{parent.postMessage({draftBridge:1,payload:m},"*")}catch(e){}};var fmt=function(v){try{if(typeof v==="string")return v;if(v instanceof Error)return v.stack||String(v);if(typeof v==="function")return"[Function "+(v.name||"anonymous")+"]";var s=JSON.stringify(v);return s===undefined?String(v):s}catch(e){return String(v)}};["log","info","warn","error","debug"].forEach(function(m){var o=console[m];console[m]=function(){var a=[].slice.call(arguments).map(fmt).slice(0,20);P({type:m,args:a});try{o.apply(console,arguments)}catch(e){}}});addEventListener("error",function(e){P({type:"error",args:[String(e.message)],line:e.lineno||0})});addEventListener("unhandledrejection",function(e){var r=e.reason;var msg=r&&r.message?r.message:String(r);P({type:"error",args:["Unhandled promise rejection: "+msg],line:0})});P({type:"__ready"})})();<\/script>';

function applyConsoleFilter() {
  var body = $("consoleBody");
  var entries = body.querySelectorAll(".log");
  for (var i = 0; i < entries.length; i++) {
    var lvl = entries[i].getAttribute("data-level");
    var show = consoleFilter === "all" || lvl === consoleFilter || (consoleFilter === "warn" && lvl === "warn");
    entries[i].classList.toggle("filtered", !show);
  }
  var seg = $("consoleFilter");
  if (seg) seg.querySelectorAll("button").forEach(function (b) {
    var on = b.getAttribute("data-filter") === consoleFilter;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
}
function refreshConsoleCounts() {
  $("cntAll").textContent = logTotal;
  $("cntWarn").textContent = logWarn;
  $("cntErr").textContent = logErr;
}
function addLog(type, args, line) {
  var body = $("consoleBody");
  if (logTotal === 0) body.textContent = "";
  logTotal++;
  if (type === "error") logErr++;
  if (type === "warn") logWarn++;
  var div = document.createElement("div");
  div.className = "log log-" + type + (line ? " jump" : "") + ((consoleFilter !== "all" && type !== consoleFilter) ? " filtered" : "");
  div.setAttribute("data-level", type);
  var parts = (args || []).map(function (a) { var s = String(a); return esc(s.length > 2000 ? s.slice(0, 2000) + " …" : s); }).join(" ");
  div.innerHTML = '<span class="t">' + nowTime() + '</span><span class="msg">' + parts + "</span>" +
    (line ? '<span class="where">line ' + esc(String(line)) + ' — jump</span>' : "");
  if (line) div.addEventListener("click", function () { ed.gotoLine(line); toast("Jumped to line " + line); });
  body.appendChild(div);
  while (body.children.length > MAX_LOGS) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
  refreshConsoleCounts();
  if (type === "error") {
    setStatus("Preview error — see console", "error");
    if (!$("console").classList.contains("open")) $("consoleErrDot").hidden = false;
  }
}
function clearConsole() {
  $("consoleBody").innerHTML = '<div class="console-empty">Console output from your preview appears here — <code>console.log</code>, warnings and runtime errors are captured live.</div>';
  logTotal = 0; logErr = 0; logWarn = 0;
  refreshConsoleCounts();
  $("consoleErrDot").hidden = true;
}
function toggleConsole(force) {
  var c = $("console");
  var open = force !== undefined ? force : !c.classList.contains("open");
  c.classList.toggle("open", open);
  $("consoleSb").classList.toggle("on", open);
  if (open) { $("consoleErrDot").hidden = true; $("consoleBody").scrollTop = $("consoleBody").scrollHeight; }
}
$("consoleSb").addEventListener("click", function () { toggleConsole(); });
$("consoleClose").addEventListener("click", function () { toggleConsole(false); });
$("consoleClear").addEventListener("click", function () { clearConsole(); toast("Console cleared"); });
$("consoleCopy").addEventListener("click", function () {
  var lines = [];
  $("consoleBody").querySelectorAll(".log:not(.filtered)").forEach(function (el) {
    var msg = el.querySelector(".msg");
    if (msg) lines.push((el.getAttribute("data-level") || "log").toUpperCase() + " " + msg.textContent);
  });
  var text = lines.join("\n");
  var done = function () { toast(text ? "Console copied — " + lines.length + " lines" : "Console is empty"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast("Copy failed", "err"); });
  else fallbackCopy(text, done);
});
$("consoleFilter").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-filter]");
  if (!b) return;
  consoleFilter = b.getAttribute("data-filter");
  applyConsoleFilter();
});

window.addEventListener("message", function (e) {
  if (!preview || e.source !== preview.contentWindow) return;
  var data = e.data;
  if (!data || data.draftBridge !== 1) return;
  var p = data.payload || {};
  if (p.type === "__ready") return;
  if (!Array.isArray(p.args)) return;
  var type = ["log","info","warn","error","debug"].indexOf(p.type) !== -1 ? p.type : "log";
  addLog(type, p.args, p.line || 0);
});

/* ═════════════════════════ preview / run ═════════════════════════ */
var runTimer = 0, previewUrl = null;
var LARGE_DOC_BYTES = 1500000, HUGE_DOC_BYTES = 2500000;
var largeDocNotified = false;

function run() {
  clearTimeout(runTimer);
  var t0 = performance.now();
  setStatus("Rendering preview…", "busy");
  clearConsole();
  var source = ed.getValue();
  // inject the console bridge as early as possible — but never before the doctype,
  // which would flip the document into quirks mode and change how it renders
  if (/<\/head\s*[^>]*>/i.test(source)) source = source.replace(/<\/head\s*[^>]*>/i, BRIDGE + "</head>");
  else if (/<body[^>]*>/i.test(source)) source = source.replace(/<body[^>]*>/i, function (m) { return m + BRIDGE; });
  else if (/<html[^>]*>/i.test(source)) source = source.replace(/<html[^>]*>/i, function (m) { return m + BRIDGE; });
  else if (/<script/i.test(source)) source = source.replace(/<script/i, BRIDGE + "<script");
  else source = BRIDGE + source;

  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  if (source.length > HUGE_DOC_BYTES) {
    previewUrl = URL.createObjectURL(new Blob([source], { type: "text/html" }));
    preview.removeAttribute("srcdoc");
    preview.src = previewUrl;
  } else {
    preview.removeAttribute("src");
    preview.srcdoc = source;
  }
  var ms = performance.now() - t0;
  setStatus("Preview updated · " + ms.toFixed(1) + " ms");
}
function scheduleRun() {
  updateMetricsSoon();
  var size = ed && ed.getSize ? ed.getSize() : (ed ? ed.getValue().length : 0);
  var manual = settings.autorunDelay <= 0;
  if (!manual && size > LARGE_DOC_BYTES) {
    manual = true;
    if (!largeDocNotified) { largeDocNotified = true; toast("Large document — auto-run paused. Press " + MOD + " ↵ to render.", "info"); }
  }
  if (manual) { setStatus(size > LARGE_DOC_BYTES ? "Large document — manual run (" + MOD + " ↵)" : "Editing — press " + MOD + " ↵ to render", "busy"); return; }
  setStatus("Editing — pending run", "busy");
  clearTimeout(runTimer);
  runTimer = setTimeout(run, settings.autorunDelay);
}

/* ═════════════════════════ viewport / zoom ═════════════════════════ */
var VIEWPORTS = {
  desktop: { w: 0, h: 0 },
  tablet: { w: 834, h: 1112 },
  phone: { w: 390, h: 844 }
};
var viewport = "desktop";
var rotated = false;
var zoomMode = "fit";   // 'fit' | number-string

/* wrap the frame in a host that reserves layout space for scaled content */
var zoomHost = document.createElement("div");
zoomHost.className = "zoom-host";
frame.parentNode.insertBefore(zoomHost, frame);
zoomHost.appendChild(frame);

function viewportSize() {
  if (viewport === "desktop") return { w: 0, h: 0 };
  var base = VIEWPORTS[viewport];
  return rotated ? { w: base.h, h: base.w } : { w: base.w, h: base.h };
}
function applyViewport() {
  frame.classList.remove("viewport-desktop", "viewport-tablet", "viewport-phone", "rotated");
  frame.classList.add(viewport === "desktop" ? "viewport-desktop" : "viewport-" + viewport);
  if (rotated && viewport !== "desktop") frame.classList.add("rotated");
  var seg = $("viewportSeg");
  seg.querySelectorAll("button[data-vp]").forEach(function (b) {
    var on = b.getAttribute("data-vp") === viewport;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  $("rotateBtn").hidden = viewport === "desktop";
  $("zoomSelect").disabled = viewport === "desktop";
  $("zoomSelect").title = viewport === "desktop" ? "Zoom applies to device viewports" : "Preview zoom";
  applyZoom();
}
function applyZoom() {
  var stage = $("previewStage");
  if (viewport === "desktop") {
    zoomHost.style.width = "100%";
    zoomHost.style.height = "100%";
    frame.style.transform = "";
    frame.style.position = "";
    frame.style.left = ""; frame.style.top = "";
    frame.style.width = ""; frame.style.height = "";
    updateReadout();
    return;
  }
  var size = viewportSize();
  var scale;
  if (zoomMode === "fit") {
    scale = Math.min(1, (stage.clientWidth - 28) / size.w, (stage.clientHeight - 12) / size.h);
    if (!isFinite(scale) || scale <= 0) scale = 1;
  } else {
    scale = parseFloat(zoomMode) || 1;
  }
  zoomHost.style.width = Math.round(size.w * scale) + "px";
  zoomHost.style.height = Math.round(size.h * scale) + "px";
  frame.style.transform = "scale(" + scale + ")";
  frame.style.transformOrigin = "top left";
  frame.style.position = "absolute";
  frame.style.left = "0"; frame.style.top = "0";
  frame.style.width = size.w + "px";
  frame.style.height = size.h + "px";
  var zs = $("zoomSelect");
  if (zs) zs.value = zoomMode === "fit" ? "fit" : String(zoomMode);
  updateReadout(scale);
}
function updateReadout(scale) {
  var el = $("vpReadout");
  var stage = $("previewStage");
  if (viewport === "desktop") { el.textContent = Math.round(stage.clientWidth) + " px canvas"; return; }
  var size = viewportSize();
  el.textContent = size.w + " × " + size.h + (typeof scale === "number" && scale !== 1 ? "  ·  " + Math.round(scale * 100) + "%" : "");
}
$("viewportSeg").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-vp]");
  if (!b) return;
  viewport = b.getAttribute("data-vp");
  if (viewport === "desktop") rotated = false;
  applyViewport();
  toast("Viewport: " + (viewport === "desktop" ? "desktop" : viewport + (rotated ? " landscape" : " portrait")));
});
$("rotateBtn").addEventListener("click", function () { rotated = !rotated; applyViewport(); });
$("zoomSelect").addEventListener("change", function (e) { zoomMode = e.target.value; applyZoom(); });
$("fullscreenBtn").addEventListener("click", function () {
  var pane = $("previewPane");
  var doc = document;
  var fs = doc.fullscreenElement || doc.webkitFullscreenElement;
  try {
    if (!fs) { if (pane.requestFullscreen) pane.requestFullscreen(); else if (pane.webkitRequestFullscreen) pane.webkitRequestFullscreen(); }
    else { if (doc.exitFullscreen) doc.exitFullscreen(); else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen(); }
  } catch (err) { toast("Full screen not available here", "err"); }
});
$("refreshBtn").addEventListener("click", function () { run(); });

/* re-fit on container resize */
(function () {
  var stage = $("previewStage");
  var raf = 0;
  var ro = new ResizeObserver(function () {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      if (zoomMode === "fit" && viewport !== "desktop") applyZoom();
      else if (viewport === "desktop") updateReadout();
    });
  });
  ro.observe(stage);
})();

/* ═════════════════════════ metrics & autosave ═════════════════════════ */
var metricsTimer = 0, saveTimer = 0;

function updateSelectionInfo() {
  var chip = $("selInfo");
  if (!ed || !ed.cm) { chip.hidden = true; return; }
  var sel = ed.cm.getSelection();
  if (sel && sel.length) { chip.hidden = false; chip.textContent = fmtBytes(sel.length) + " selected"; }
  else chip.hidden = true;
}
function updateCursorPos() {
  if (!ed || !ed.cm) return;
  var c = ed.cm.getCursor();
  $("cursorPos").textContent = "Ln " + (c.line + 1) + ", Col " + (c.ch + 1);
}
function updateMetrics() {
  if (!ed) return;
  var chars = ed.getSize ? ed.getSize() : ed.getValue().length;
  var lines;
  if (ed.cm) lines = ed.cm.lineCount();
  else { var v = ed.getValue(); lines = 1; for (var i = 0; i < v.length; i = v.indexOf("\n", i) + 1) lines++; }
  $("lineCount").textContent = lines.toLocaleString() + (lines === 1 ? " line" : " lines");
  $("charCount").textContent = chars.toLocaleString() + " chars";
  $("docSize").textContent = fmtBytes(chars);
}
function updateMetricsSoon() { clearTimeout(metricsTimer); metricsTimer = setTimeout(updateMetrics, 280); }
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    var ok = store.set("draft-studio.doc.v2", JSON.stringify({ name: filename, source: ed.getValue(), time: Date.now() }));
    if (ok) $("savedAt").textContent = "saved " + nowTime();
  }, 750);
}
function restore() {
  try {
    var raw = store.get("draft-studio.doc.v2");
    if (!raw) return false;
    var doc = JSON.parse(raw);
    if (doc && typeof doc.source === "string") {
      if (doc.name) setName(doc.name);
      ed.setValue(doc.source);
      return true;
    }
  } catch (e) {}
  return false;
}

/* ═════════════════════════ files ═════════════════════════ */
function setName(name) {
  filename = /\.(html?|txt)$/i.test(name) ? name : name + ".html";
  var el = $("fileName");
  el.textContent = filename;
  el.title = filename;
  document.title = filename + " — Draft Studio";
}
function exportFile() {
  var blob = new Blob([ed.getValue()], { type: "text/html;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  setStatus("Exported " + filename);
  toast("Exported " + filename);
}
function openInNewTab() {
  try {
    var blob = new Blob([ed.getValue()], { type: "text/html;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast("Opened in a new tab");
  } catch (e) {
    setStatus("Could not open tab", "error");
    toast("Could not open tab — check pop-up settings", "err");
  }
}
async function importFile(file) {
  if (!file) return;
  if (!/\.(html?|txt)$/i.test(file.name)) { toast("Choose an .html, .htm or .txt file", "err"); return; }
  setStatus("Reading " + file.name + "…", "busy");
  await new Promise(function (r) { setTimeout(r, 30); });
  try {
    var text = await file.text();
    ed.replaceDocument(text);
    if (ed.clearHistory) ed.clearHistory();
    setName(file.name);
    updateMetrics();
    run();
    var mb = file.size / 1048576;
    toast("Imported " + file.name + " · " + fmtBytes(file.size) + (mb > 5 ? " — large document mode" : ""));
    if (mb > 5) setStatus("Loaded " + fmtBytes(file.size) + " — large document", "busy");
  } catch (err) {
    setStatus("Import failed", "error");
    toast("Could not read this file", "err");
  }
}
function copySource() {
  var v = ed.getValue();
  var done = function () { toast("Source copied to clipboard"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { fallbackCopy(v, done); });
  else fallbackCopy(v, done);
}
function fallbackCopy(v, done) {
  var ta = document.createElement("textarea");
  ta.value = v; ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.pointerEvents = "none";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed", "err"); }
  ta.remove();
}

/* ═════════════════════════ format ═════════════════════════ */
function formatDoc() {
  var v = ed.getValue();
  if (v.length > 3000000) { toast("Document too large to format safely", "err"); return; }
  if (typeof html_beautify !== "function") { toast("Formatter unavailable", "err"); return; }
  try {
    var before = v.slice(0, 200);
    var out = html_beautify(v, { indent_size: settings.indent, wrap_line_length: 0, preserve_newlines: true, max_preserve_newlines: 2, indent_inner_html: false, extra_liners: [] });
    if (out === v) { toast("Already formatted"); return; }
    ed.replaceDocument(out);
    scheduleRun();
    setStatus("Formatted");
    toast("Document formatted");
  } catch (e) {
    toast("Could not format this document", "err");
  }
}

/* ═════════════════════════ templates ═════════════════════════ */
var TPL = [
  { name: "Blank document", desc: "A clean, minimal HTML5 skeleton to start from scratch.", art: "blank", code: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Document</title>\n  <style>\n    body {\n      margin: 0;\n      font-family: system-ui, sans-serif;\n      color: #1a1d23;\n      background: #fafafa;\n    }\n  </style>\n</head>\n<body>\n  <main>\n    <h1>It works.</h1>\n    <p>Edit this document in the source editor — the preview updates live.</p>\n  </main>\n</body>\n</html>` },
  { name: "Landing page", desc: "Hero, feature grid and call to action on a dark modern layout.", art: "landing", code: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Aurora — landing page</title>\n  <style>\n    :root { --accent: #7c6cf0; --ink: #eef0f6; --muted: #9aa1b5; }\n    * { box-sizing: border-box; margin: 0; }\n    body { font-family: system-ui, sans-serif; background: #0d0f14; color: var(--ink); }\n    .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }\n    header { display: flex; align-items: center; justify-content: space-between; padding: 22px 0; }\n    .logo { font-weight: 800; letter-spacing: .12em; }\n    .logo span { color: var(--accent); }\n    nav a { color: var(--muted); text-decoration: none; margin-left: 26px; font-size: 14px; }\n    nav a:hover { color: var(--ink); }\n    .hero { text-align: center; padding: 90px 0 70px; }\n    .hero .pill { display: inline-block; padding: 6px 14px; border: 1px solid #262b3a; border-radius: 99px; color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }\n    .hero h1 { font-size: clamp(2.4rem, 6vw, 4.2rem); letter-spacing: -.03em; line-height: 1.05; margin: 26px 0 18px; }\n    .hero h1 em { font-style: normal; color: var(--accent); }\n    .hero p { color: var(--muted); max-width: 520px; margin: 0 auto 34px; font-size: 17px; line-height: 1.6; }\n    .cta { display: inline-block; padding: 14px 30px; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 700; text-decoration: none; }\n    .cta:hover { filter: brightness(1.12); }\n    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; padding: 40px 0 90px; }\n    .card { padding: 26px; border: 1px solid #1e2330; border-radius: 14px; background: #12151d; }\n    .card h3 { margin: 14px 0 8px; font-size: 16px; }\n    .card p { color: var(--muted); font-size: 14px; line-height: 1.55; }\n    .card .dot { width: 34px; height: 34px; border-radius: 9px; background: rgba(124,108,240,.16); }\n    footer { border-top: 1px solid #1a1f2a; padding: 26px 0; color: var(--muted); font-size: 13px; text-align: center; }\n  </style>\n</head>\n<body>\n  <div class="wrap">\n    <header>\n      <div class="logo">Aurora<span>.</span></div>\n      <nav>\n        <a href="#">Features</a><a href="#">Pricing</a><a href="#">Docs</a>\n      </nav>\n    </header>\n    <section class="hero">\n      <span class="pill">Now in open beta</span>\n      <h1>Ship your ideas <em>at lightspeed</em></h1>\n      <p>Aurora is the toolkit for teams who move fast — build, test and deploy from one place.</p>\n      <a class="cta" href="#">Get started free</a>\n    </section>\n    <section class="grid">\n      <div class="card"><div class="dot"></div><h3>Instant previews</h3><p>Every change is live in milliseconds, on every device your team tests on.</p></div>\n      <div class="card"><div class="dot"></div><h3>One-click deploys</h3><p>Push to production with a single command, rollbacks included.</p></div>\n      <div class="card"><div class="dot"></div><h3>Team-ready</h3><p>Roles, review flows and audit trails built in from day one.</p></div>\n    </section>\n    <footer>© 2026 Aurora Labs — built with Draft Studio.</footer>\n  </div>\n</body>\n</html>` },
  { name: "Canvas particles", desc: "Animated particle field with mouse interaction, pure canvas.", art: "canvas", code: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Particles</title>\n  <style>\n    html, body { margin: 0; height: 100%; overflow: hidden; background: #06080c; }\n    canvas { display: block; }\n  </style>\n</head>\n<body>\n  <canvas id="c"></canvas>\n  <script>\n    var canvas = document.getElementById("c"), ctx = canvas.getContext("2d");\n    var W, H, mouse = {x: -9999, y: -9999};\n    function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }\n    resize(); addEventListener("resize", resize);\n    addEventListener("mousemove", function(e) { mouse.x = e.clientX; mouse.y = e.clientY; });\n    var N = Math.min(160, Math.floor(innerWidth / 8));\n    var parts = [];\n    for (var i = 0; i < N; i++) {\n      parts.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight,\n        vx: (Math.random() - .5) * 1.4, vy: (Math.random() - .5) * 1.4, r: Math.random() * 2 + .8 });\n    }\n    (function tick() {\n      ctx.fillStyle = "rgba(6,8,12,.35)"; ctx.fillRect(0, 0, W, H);\n      for (var i = 0; i < parts.length; i++) {\n        var p = parts[i];\n        var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;\n        if (d2 < 22500) { var d = Math.sqrt(d2) || 1; p.vx += dx / d * .35; p.vy += dy / d * .35; }\n        p.vx *= .97; p.vy *= .97;\n        p.x += p.vx; p.y += p.vy;\n        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;\n        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;\n        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);\n        ctx.fillStyle = "rgba(120,190,255,.85)"; ctx.fill();\n        for (var j = i + 1; j < parts.length; j++) {\n          var q = parts[j], ex = p.x - q.x, ey = p.y - q.y, ed2 = ex * ex + ey * ey;\n          if (ed2 < 9000) {\n            ctx.strokeStyle = "rgba(110,140,240," + (0.16 * (1 - ed2 / 9000)) + ")";\n            ctx.lineWidth = 1;\n            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();\n          }\n        }\n      }\n      requestAnimationFrame(tick);\n    })();\n  <\/script>\n</body>\n</html>` },
  { name: "CSS motion", desc: "Gradient headline, floating cards and a shimmering button.", art: "motion", code: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Motion</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; }\n    body { min-height: 100vh; display: grid; place-items: center; background: #0b0d12;\n      font-family: system-ui, sans-serif; color: #eee; overflow-x: hidden; }\n    .stage { text-align: center; padding: 40px 20px; }\n    .grad { font-size: clamp(2.5rem, 8vw, 5rem); font-weight: 800; letter-spacing: -.04em;\n      background: linear-gradient(90deg, #f6a13c, #ee5f8a, #8f6af0, #f6a13c);\n      background-size: 300% 100%; -webkit-background-clip: text; background-clip: text;\n      color: transparent; animation: slide 6s linear infinite; }\n    @keyframes slide { to { background-position: 300% 0; } }\n    .float { display: flex; gap: 18px; justify-content: center; flex-wrap: wrap; margin: 54px 0; }\n    .card { width: 130px; height: 150px; border-radius: 16px; border: 1px solid #232838;\n      background: linear-gradient(160deg, #161a24, #10131b);\n      animation: bob 4s ease-in-out infinite; }\n    .card:nth-child(2) { animation-delay: .6s; }\n    .card:nth-child(3) { animation-delay: 1.2s; }\n    @keyframes bob { 50% { transform: translateY(-16px); } }\n    .shimmer { position: relative; padding: 15px 38px; border: 0; border-radius: 99px;\n      background: linear-gradient(100deg, #6f5cf0 40%, #9f8cff 50%, #6f5cf0 60%);\n      background-size: 200% 100%; color: #fff; font-size: 15px; font-weight: 700;\n      cursor: pointer; animation: shine 2.2s linear infinite; }\n    @keyframes shine { to { background-position: -200% 0; } }\n  </style>\n</head>\n<body>\n  <div class="stage">\n    <h1 class="grad">Motion in pure CSS</h1>\n    <div class="float"><div class="card"></div><div class="card"></div><div class="card"></div></div>\n    <button class="shimmer">Hover-free shimmer</button>\n  </div>\n</body>\n</html>` },
  { name: "Dashboard UI", desc: "Sidebar, KPI cards and a mini chart — admin-panel starter.", art: "dash", code: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Dashboard</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; }\n    body { font-family: system-ui, sans-serif; background: #f2f4f8; color: #22262e; display: flex; }\n    aside { width: 220px; background: #14171d; color: #aeb6c6; padding: 22px 16px; min-height: 100vh; }\n    aside h4 { color: #fff; font-size: 15px; margin-bottom: 26px; letter-spacing: .02em; }\n    aside a { display: block; padding: 10px 12px; border-radius: 8px; color: #aeb6c6;\n      text-decoration: none; font-size: 14px; margin-bottom: 4px; }\n    aside a.active, aside a:hover { background: #232837; color: #fff; }\n    main { flex: 1; padding: 28px 32px; }\n    h1 { font-size: 22px; margin-bottom: 4px; }\n    .sub { color: #7c8494; font-size: 13px; margin-bottom: 26px; }\n    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }\n    .kpi { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 18px; }\n    .kpi .label { font-size: 12px; color: #7c8494; text-transform: uppercase; letter-spacing: .07em; }\n    .kpi .value { font-size: 26px; font-weight: 750; margin: 8px 0 4px; }\n    .kpi .delta { font-size: 12px; font-weight: 650; }\n    .up { color: #178a50; } .down { color: #c0392b; }\n    .panel { margin-top: 20px; background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 20px; }\n    .bars { display: flex; align-items: flex-end; gap: 10px; height: 150px; padding-top: 8px; }\n    .bar { flex: 1; background: linear-gradient(180deg, #5b8def, #7fa7f2); border-radius: 6px 6px 2px 2px; }\n  </style>\n</head>\n<body>\n  <aside>\n    <h4>Acme Analytics</h4>\n    <a class="active" href="#">Overview</a>\n    <a href="#">Traffic</a>\n    <a href="#">Revenue</a>\n    <a href="#">Users</a>\n    <a href="#">Settings</a>\n  </aside>\n  <main>\n    <h1>Overview</h1>\n    <p class="sub">Last 30 days · updated just now</p>\n    <div class="kpis">\n      <div class="kpi"><div class="label">Visitors</div><div class="value">48,210</div><div class="delta up">▲ 12.4%</div></div>\n      <div class="kpi"><div class="label">Revenue</div><div class="value">€9,842</div><div class="delta up">▲ 6.1%</div></div>\n      <div class="kpi"><div class="label">Churn</div><div class="value">1.9%</div><div class="delta down">▼ 0.4%</div></div>\n    </div>\n    <div class="panel">\n      <strong style="font-size:14px">Weekly traffic</strong>\n      <div class="bars">\n        <div class="bar" style="height:45%"></div><div class="bar" style="height:70%"></div>\n        <div class="bar" style="height:52%"></div><div class="bar" style="height:88%"></div>\n        <div class="bar" style="height:64%"></div><div class="bar" style="height:97%"></div>\n        <div class="bar" style="height:80%"></div>\n      </div>\n    </div>\n  </main>\n</body>\n</html>` },
  { name: "Contact form", desc: "Accessible, styled form with validation feedback.", art: "form", code: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Contact</title>\n  <style>\n    * { box-sizing: border-box; }\n    body { min-height: 100vh; display: grid; place-items: center; margin: 0;\n      background: #eef1f6; font-family: system-ui, sans-serif; color: #232732; }\n    .card { width: min(420px, 92vw); background: #fff; border-radius: 18px; padding: 34px;\n      box-shadow: 0 18px 50px rgba(20,26,44,.12); }\n    h1 { font-size: 22px; margin: 0 0 6px; }\n    .sub { color: #6b7280; font-size: 14px; margin: 0 0 26px; }\n    label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 6px; }\n    input, textarea { width: 100%; padding: 11px 13px; border: 1.5px solid #d5dae3; border-radius: 10px;\n      font: inherit; font-size: 14px; transition: border-color .15s, box-shadow .15s; }\n    input:focus, textarea:focus { outline: 0; border-color: #4f6ef7; box-shadow: 0 0 0 4px rgba(79,110,247,.14); }\n    .row { display: flex; gap: 14px; } .row > div { flex: 1; }\n    button { margin-top: 24px; width: 100%; padding: 13px; border: 0; border-radius: 10px;\n      background: #4f6ef7; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }\n    button:hover { background: #3d5bf5; }\n    .note { margin-top: 14px; font-size: 13px; color: #178a50; min-height: 18px; }\n  </style>\n</head>\n<body>\n  <form class="card" onsubmit="event.preventDefault(); document.getElementById('note').textContent = 'Thanks — message sent (demo).';">\n    <h1>Get in touch</h1>\n    <p class="sub">We usually reply within one business day.</p>\n    <div class="row">\n      <div><label for="fn">First name</label><input id="fn" required placeholder="Ada"></div>\n      <div><label for="ln">Last name</label><input id="ln" required placeholder="Lovelace"></div>\n    </div>\n    <label for="em">Email</label>\n    <input id="em" type="email" required placeholder="ada@example.com">\n    <label for="ms">Message</label>\n    <textarea id="ms" rows="4" required placeholder="How can we help?"></textarea>\n    <button type="submit">Send message</button>\n    <p class="note" id="note"></p>\n  </form>\n</body>\n</html>` }
];

var ART = {
  blank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 7h16M4 12h10M4 17h7"/></svg>',
  landing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 9.5V20"/></svg>',
  canvas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="8" r="1.3"/><circle cx="16.5" cy="6" r="1.3"/><circle cx="12" cy="13" r="1.3"/><circle cx="18" cy="17" r="1.3"/><path d="M8.1 9l2.8 2.8M13 12l3.8 3.8M7.2 9.3l3.6 2.9"/></svg>',
  motion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 12c2.4-5.8 4.8-5.8 7.2 0s4.8 5.8 7.2 0 3.4-3.4 5.6 0"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18M13 8h5M13 12h5M13 16h3"/></svg>',
  form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M7 14.5h6"/></svg>'
};

function useTemplate(i) {
  var tpl = TPL[i];
  ed.replaceDocument(tpl.code);
  setName(tpl.name.toLowerCase().replace(/\s+/g, "-") + ".html");
  $("tplBd").classList.remove("open");
  updateMetrics();
  run();
  toast("Template loaded — " + MOD + " Z undoes");
}
function buildTemplates() {
  var grid = $("tplGrid");
  grid.innerHTML = "";
  TPL.forEach(function (tpl, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "tpl";
    b.innerHTML = '<div class="art">' + ART[tpl.art] + "</div><h4>" + esc(tpl.name) + "</h4><p>" + esc(tpl.desc) + "</p>";
    b.addEventListener("click", function () { useTemplate(i); });
    grid.appendChild(b);
  });
}

/* ═════════════════════════ command palette ═════════════════════════ */
function setViewport(v) { viewport = v; if (v === "desktop") rotated = false; applyViewport(); }
function setLayout(l) {
  workspace.dataset.layout = l;
  var sp = $("splitter");
  sp.setAttribute("aria-orientation", l === "split-v" ? "horizontal" : "vertical");
  if (ed && ed.cm) ed.cm.refresh();
}
var LAYOUTS = ["split-h", "split-v", "editor", "preview"];
var LAYOUT_LABEL = { "split-h": "Split side-by-side", "split-v": "Split stacked", "editor": "Editor only", "preview": "Preview only" };
function cycleLayout() {
  var next = LAYOUTS[(LAYOUTS.indexOf(workspace.dataset.layout) + 1) % LAYOUTS.length];
  setLayout(next);
  toast("Layout: " + LAYOUT_LABEL[next]);
}
function toggleWrap() {
  var on = !(ed && ed.cm && ed.cm.getOption("lineWrapping"));
  if (ed && ed.setWrap) ed.setWrap(on);
  $("wrapBtn").classList.toggle("on", on);
  $("wrapBtn").setAttribute("aria-pressed", String(on));
  toast("Word wrap " + (on ? "on" : "off"));
}
function toggleAutorun() {
  if (settings.autorunDelay > 0) { lastAutorunDelay = settings.autorunDelay; settings.autorunDelay = 0; }
  else settings.autorunDelay = lastAutorunDelay || 800;
  saveSettings();
  applyAutorunUI();
  toast(settings.autorunDelay > 0 ? "Auto-run on — renders " + settings.autorunDelay + " ms after you stop typing" : "Auto-run off — press " + MOD + " ↵ to render");
}
function toggleAssist() {
  settings.assist = !settings.assist;
  saveSettings();
  applyAssistUI();
  if (!settings.assist) hideGhost();
  toast("Coding assist " + (settings.assist ? "enabled — ghost text & Emmet on Tab" : "disabled"));
}

var ICONS = {
  run: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.86l10.5-6.86a1 1 0 0 0 0-1.72L9.56 4.28A1 1 0 0 0 8 5.14z"/></svg>',
  tab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  console: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  format: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h6"/><path d="m17 15 4 3-4 3"/></svg>',
  import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/></svg>',
  layout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 3v18"/></svg>',
  rows: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 12h18"/></svg>',
  pane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M12 18h.01"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M12 18h.01"/></svg>',
  wrap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4"/><path d="m16 15-3 3 3 3"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.9 5.7 5.7 1.9-5.7 1.9L12 18.2l-1.9-5.7-5.7-1.9 5.7-1.9L12 3z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  keys: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  motion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2.4"/><path d="M12 2a10 10 0 0 1 10 10" opacity=".6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.7 5.7 1.9-5.7 1.9L12 18.2l-1.9-5.7-5.7-1.9 5.7-1.9L12 3z"/><path d="M19 4v3M20.5 5.5h-3"/></svg>'
};

var COMMANDS = [
  { name: "Run preview", cat: "Run", keys: [MOD, "↵"], icon: ICONS.run, fn: function () { run(); } },
  { name: "Run in new tab", cat: "Run", keys: [MOD, "⇧", "↵"], icon: ICONS.tab, fn: openInNewTab },
  { name: "Toggle console", cat: "Run", keys: [MOD, "`"], icon: ICONS.console, fn: function () { toggleConsole(); } },
  { name: "Format document", cat: "Editor", keys: [MOD, "⇧", "F"], icon: ICONS.format, fn: formatDoc },
  { name: "Copy source to clipboard", cat: "Editor", icon: ICONS.copy, fn: copySource },
  { name: "Clear editor", cat: "Editor", icon: ICONS.trash, fn: function () { clearEditor(); } },
  { name: "Toggle word wrap", cat: "Editor", icon: ICONS.wrap, fn: toggleWrap },
  { name: "Toggle coding assist (ghost text & Emmet)", cat: "Assist", icon: ICONS.wand, fn: toggleAssist },
  { name: "Toggle auto-run preview", cat: "Run", keys: [], icon: ICONS.bolt, fn: toggleAutorun },
  { name: "Import HTML file…", cat: "File", icon: ICONS.import, fn: function () { $("fileInput").click(); } },
  { name: "Export HTML file", cat: "File", keys: [MOD, "S"], icon: ICONS.export, fn: exportFile },
  { name: "New from template…", cat: "File", icon: ICONS.grid, fn: function () { $("tplBd").classList.add("open"); } },
  { name: "Reload welcome document", cat: "File", icon: ICONS.reset, fn: function () { ed.replaceDocument(WELCOME); setName("welcome.html"); updateMetrics(); run(); } },
  { name: "Layout: split side-by-side", cat: "View", icon: ICONS.layout, fn: function () { setLayout("split-h"); } },
  { name: "Layout: split stacked", cat: "View", icon: ICONS.rows, fn: function () { setLayout("split-v"); } },
  { name: "Layout: editor only", cat: "View", icon: ICONS.pane, fn: function () { setLayout("editor"); } },
  { name: "Layout: preview only", cat: "View", icon: ICONS.pane, fn: function () { setLayout("preview"); } },
  { name: "Viewport: desktop", cat: "View", icon: ICONS.monitor, fn: function () { setViewport("desktop"); } },
  { name: "Viewport: tablet portrait", cat: "View", icon: ICONS.tablet, fn: function () { setViewport("tablet"); rotated = false; applyViewport(); } },
  { name: "Viewport: tablet landscape", cat: "View", icon: ICONS.tablet, fn: function () { setViewport("tablet"); rotated = true; applyViewport(); } },
  { name: "Viewport: phone portrait", cat: "View", icon: ICONS.phone, fn: function () { setViewport("phone"); rotated = false; applyViewport(); } },
  { name: "Viewport: phone landscape", cat: "View", icon: ICONS.phone, fn: function () { setViewport("phone"); rotated = true; applyViewport(); } },
  { name: "Preview zoom: fit", cat: "View", icon: ICONS.pane, fn: function () { zoomMode = "fit"; applyZoom(); } },
  { name: "Preview zoom: 100%", cat: "View", icon: ICONS.pane, fn: function () { zoomMode = "1"; applyZoom(); } },
  { name: "Preview zoom: 150%", cat: "View", icon: ICONS.pane, fn: function () { zoomMode = "1.5"; applyZoom(); } },
  { name: "Toggle reduce motion", cat: "View", icon: ICONS.motion, fn: function () { settings.reduceMotion = !settings.reduceMotion; saveSettings(); applyMotion(); toast("Reduce motion " + (settings.reduceMotion ? "on" : "off")); } },
  { name: "Keyboard shortcuts", cat: "Help", icon: ICONS.keys, fn: openShortcuts },
  { name: "Reset workspace to welcome page", cat: "File", icon: ICONS.reset, fn: resetWorkspace }
];

/* fuzzy match: subsequence with bonuses for prefix/word starts; returns {score, marks} */
function fuzzy(query, text) {
  if (!query) return { score: 1, marks: [] };
  var q = query.toLowerCase(), t = text.toLowerCase();
  var qi = 0, score = 0, streak = 0, marks = [], first = -1, prev = -2;
  if (t.indexOf(q) !== -1) {
    var idx = t.indexOf(q);
    score = 100 - idx + (idx === 0 ? 30 : 0);
    for (var i = 0; i < q.length; i++) marks.push(idx + i);
    return { score: score, marks: marks };
  }
  for (var ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      marks.push(ti);
      if (first === -1) first = ti;
      streak = (ti === prev + 1) ? streak + 1 : 1;
      score += 2 + streak * 3 + (ti === 0 || /\s|[-:·]/.test(t[ti - 1]) ? 6 : 0);
      prev = ti; qi++;
    }
  }
  if (qi < q.length) return null;
  return { score: score, marks: marks };
}
function highlightMarks(text, marks) {
  if (!marks || !marks.length) return esc(text);
  var set = {};
  marks.forEach(function (m) { set[m] = 1; });
  var out = "";
  for (var i = 0; i < text.length; i++) out += set[i] ? "<mark>" + esc(text[i]) + "</mark>" : esc(text[i]);
  return out;
}

var paletteSel = 0, paletteItems = [];
var lastPaletteFocus = null;

function openPalette() {
  lastPaletteFocus = document.activeElement;
  $("paletteBd").classList.add("open");
  var inp = $("paletteInput");
  inp.value = ""; paletteSel = 0;
  renderPalette("");
  inp.focus();
}
function closePalette() {
  $("paletteBd").classList.remove("open");
  if (lastPaletteFocus && lastPaletteFocus.focus) try { lastPaletteFocus.focus(); } catch (e) {}
}
function renderPalette(q) {
  var list = $("paletteList");
  paletteItems = [];
  COMMANDS.forEach(function (c) {
    var m = fuzzy(q || "", c.name);
    if (m) paletteItems.push({ cmd: c, score: m.score, marks: m.marks });
  });
  paletteItems.sort(function (a, b) { return b.score - a.score; });
  list.innerHTML = "";
  if (!paletteItems.length) {
    list.innerHTML = '<div class="palette-empty">No matching commands for “' + esc(q) + '”</div>';
    return;
  }
  if (paletteSel >= paletteItems.length) paletteSel = 0;
  paletteItems.forEach(function (entry, i) {
    var c = entry.cmd;
    var div = document.createElement("div");
    div.className = "cmd" + (i === paletteSel ? " sel" : "");
    div.setAttribute("role", "option");
    div.innerHTML = '<span class="glyph">' + (c.icon || ICONS.run) + '</span>' +
      '<span class="name">' + highlightMarks(c.name, entry.marks) + '</span>' +
      '<span class="cat">' + esc(c.cat) + '</span>' +
      '<span class="keys">' + (c.keys || []).map(function (k) { return '<span class="kbd">' + esc(k) + "</span>"; }).join("") + "</span>";
    div.addEventListener("click", function () { closePalette(); c.fn(); });
    div.addEventListener("mousemove", function () { if (paletteSel !== i) { paletteSel = i; paintSelection(); } });
    list.appendChild(div);
  });
}
function paintSelection() {
  var items = $("paletteList").querySelectorAll(".cmd");
  items.forEach(function (el, i) { el.classList.toggle("sel", i === paletteSel); });
  var sel = items[paletteSel];
  if (sel) sel.scrollIntoView({ block: "nearest" });
}
$("paletteInput").addEventListener("input", function (e) { paletteSel = 0; renderPalette(e.target.value); });
$("paletteInput").addEventListener("keydown", function (e) {
  var items = paletteItems.length;
  if (e.key === "ArrowDown") { e.preventDefault(); paletteSel = Math.min(paletteSel + 1, items - 1); paintSelection(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); paletteSel = Math.max(paletteSel - 1, 0); paintSelection(); }
  else if (e.key === "Enter") { e.preventDefault(); var c = paletteItems[paletteSel]; if (c) { closePalette(); c.cmd.fn(); } }
  else if (e.key === "Escape") { closePalette(); }
});
$("paletteBd").addEventListener("mousedown", function (e) { if (e.target === $("paletteBd")) closePalette(); });
$("paletteBtn").addEventListener("click", openPalette);

/* ═════════════════════════ keyboard shortcuts modal ═════════════════════════ */
var SHORTCUT_SECTIONS = [
  { section: "Run & files", rows: [
    ["Run preview", [MOD, "\u21b5"]],
    ["Run in new tab", [MOD, "\u21e7", "\u21b5"]],
    ["Command palette", [MOD, "K"]],
    ["Export HTML file", [MOD, "S"]],
    ["Toggle console", [MOD, "`"]],
    ["Import HTML file", ["(drop a file anywhere)"]]
  ]},
  { section: "Editing", rows: [
    ["Find in document", [MOD, "F"]],
    ["Find next / previous", [MOD, "G"]],
    isMac ? ["Replace all", ["\u21e7", "\u2318", "\u2325", "F"]] : ["Replace all", ["Ctrl", "\u21e7", "R"]],
    ["Go to line", ["Alt", "G"]],
    ["Format document", [MOD, "\u21e7", "F"]],
    ["Toggle comment", [MOD, "/"]],
    ["Duplicate line", [MOD, "D"]],
    ["Move line up / down", ["Alt", "\u2191 \u2193"]],
    ["Delete line", [MOD, "\u21e7", "K"]],
    ["Fold / unfold at cursor", ["Ctrl", "Q"]]
  ]},
  { section: "Coding assist", rows: [
    ["Accept prediction / expand Emmet", ["Tab"]],
    ["Autocomplete (always available)", [MOD, "Space"]],
    ["Jump to matching bracket / tag", [MOD, "J"]],
    ["Close autocomplete / dismiss", ["Esc"]]
  ]},
  { section: "Interface", rows: [
    ["Keyboard shortcuts", ["(status bar button)"]],
    ["Cycle layout split \u2192 stacked \u2192 panes", ["(layout button)"]],
    ["Preview full screen", ["(expand button)"]],
    ["Close dialogues", ["Esc"]]
  ]}
];
function buildShortcuts() {
  var grid = $("keysGrid");
  grid.innerHTML = "";
  SHORTCUT_SECTIONS.forEach(function (group) {
    var h = document.createElement("div");
    h.className = "keys-section";
    h.textContent = group.section;
    grid.appendChild(h);
    group.rows.forEach(function (row) {
      var div = document.createElement("div");
      div.className = "key-row";
      div.innerHTML = '<span class="what">' + esc(row[0]) + '</span><span class="keys">' + row[1].map(function (k) { return '<span class="kbd">' + esc(k) + "</span>"; }).join("") + "</span>";
      grid.appendChild(div);
    });
  });
}
var keysLastFocus = null;
function openShortcuts() {
  keysLastFocus = document.activeElement;
  buildShortcuts();
  $("keysBd").classList.add("open");
  $("keysClose").focus();
}
function closeShortcuts() {
  $("keysBd").classList.remove("open");
  if (keysLastFocus && keysLastFocus.focus) try { keysLastFocus.focus(); } catch (e) {}
}
$("keysClose").addEventListener("click", closeShortcuts);
$("keysBd").addEventListener("mousedown", function (e) { if (e.target === $("keysBd")) closeShortcuts(); });
$("shortcutsBtn").addEventListener("click", openShortcuts);
$("shortcutsBtn2").addEventListener("click", function () { closeSettings(); openShortcuts(); });

/* ═════════════════════════ settings popover ═════════════════════════ */
function openSettings() { $("settingsPop").hidden = false; $("settingsBtn").setAttribute("aria-expanded", "true"); }
function closeSettings() { $("settingsPop").hidden = true; $("settingsBtn").setAttribute("aria-expanded", "false"); }
$("settingsBtn").addEventListener("click", function (e) {
  e.stopPropagation();
  if ($("settingsPop").hidden) openSettings(); else closeSettings();
});
document.addEventListener("pointerdown", function (e) {
  var pop = $("settingsPop");
  if (!pop.hidden && !pop.contains(e.target) && e.target !== $("settingsBtn") && !$("settingsBtn").contains(e.target)) closeSettings();
});
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSettings(); });

$("fontMinus").addEventListener("click", function () { settings.fontSize = Math.max(10, settings.fontSize - 1); applyFontSize(); saveSettings(); });
$("fontPlus").addEventListener("click", function () { settings.fontSize = Math.min(20, settings.fontSize + 1); applyFontSize(); saveSettings(); });
$("indent2").addEventListener("click", function () { settings.indent = 2; applyIndent(); saveSettings(); });
$("indent4").addEventListener("click", function () { settings.indent = 4; applyIndent(); saveSettings(); });
$("motionToggle").addEventListener("change", function () { settings.reduceMotion = $("motionToggle").checked; applyMotion(); saveSettings(); });
document.querySelectorAll(".swatch[data-accent]").forEach(function (b) {
  b.addEventListener("click", function () { settings.accent = b.getAttribute("data-accent"); applyAccent(settings.accent); saveSettings(); });
});
document.querySelectorAll(".sp-segment [data-delay]").forEach(function (b) {
  b.addEventListener("click", function () {
    settings.autorunDelay = +b.getAttribute("data-delay");
    if (settings.autorunDelay > 0) lastAutorunDelay = settings.autorunDelay;
    saveSettings(); applyAutorunUI();
  });
});
function resetWorkspace() {
  confirmDialog("Reset workspace", "This clears the autosaved document and restores the welcome page. This can't be undone.", "Reset").then(function (ok) {
    if (!ok) return;
    store.del("draft-studio.doc.v2");
    ed.replaceDocument(WELCOME);
    setName("welcome.html");
    updateMetrics(); run();
    toast("Workspace reset");
  });
}
$("resetWorkspace").addEventListener("click", function () { closeSettings(); resetWorkspace(); });

/* ═════════════════════════ editor overflow menu ═════════════════════════ */
var overflowMenu = $("editorOverflowMenu");
function closeOverflow() { overflowMenu.hidden = true; $("editorOverflowBtn").setAttribute("aria-expanded", "false"); }
$("editorOverflowBtn").addEventListener("click", function (e) {
  e.stopPropagation();
  var willOpen = overflowMenu.hidden;
  overflowMenu.hidden = !willOpen;
  $("editorOverflowBtn").setAttribute("aria-expanded", String(willOpen));
});
document.addEventListener("pointerdown", function (e) { if (!overflowMenu.hidden && !overflowMenu.contains(e.target)) closeOverflow(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeOverflow(); });
overflowMenu.addEventListener("click", function (e) {
  var b = e.target.closest("button[data-act]");
  if (!b) return;
  closeOverflow();
  var act = b.getAttribute("data-act");
  if (act === "templates") $("tplBd").classList.add("open");
  else if (act === "format") formatDoc();
  else if (act === "wrap") toggleWrap();
  else if (act === "assist") toggleAssist();
  else if (act === "autorun") toggleAutorun();
  else if (act === "clear") clearEditor();
});

/* ═════════════════════════ layout / wrap / autorun buttons ═════════════════════════ */
$("layoutBtn").addEventListener("click", cycleLayout);
$("wrapBtn").addEventListener("click", toggleWrap);
$("assistBtn").addEventListener("click", toggleAssist);
$("autorunBtn").addEventListener("click", toggleAutorun);
$("tplBtn").addEventListener("click", function () { $("tplBd").classList.add("open"); });
$("tplClose").addEventListener("click", function () { $("tplBd").classList.remove("open"); });
$("tplBd").addEventListener("mousedown", function (e) { if (e.target === $("tplBd")) $("tplBd").classList.remove("open"); });
$("formatBtn").addEventListener("click", formatDoc);
$("clearBtn").addEventListener("click", function () { clearEditor(); });

function clearEditor() {
  if (!ed.getValue()) { toast("Editor is already empty"); return; }
  confirmDialog("Clear editor", "This will remove all source code. You can undo with <strong>" + MOD + "&nbsp;Z</strong> right after.", "Clear").then(function (ok) {
    if (!ok) return;
    ed.replaceDocument("");
    updateMetrics(); run(); ed.focus();
    toast("Editor cleared");
  });
}

/* ═════════════════════════ splitter (both orientations) ═════════════════════════ */
(function initSplitter() {
  var sp = $("splitter");
  var dragging = false;
  function orientation() { return workspace.dataset.layout === "split-v" ? "y" : "x"; }
  function applyFromEvent(e) {
    var rect = workspace.getBoundingClientRect();
    var frac;
    if (orientation() === "y") frac = (e.clientY - rect.top) / (rect.height || 1);
    else frac = (e.clientX - rect.left) / (rect.width || 1);
    frac = Math.min(0.85, Math.max(0.15, frac));
    workspace.style.setProperty("--split", (frac * 100).toFixed(2) + "%");
  }
  sp.addEventListener("pointerdown", function (e) {
    if (workspace.dataset.layout !== "split-h" && workspace.dataset.layout !== "split-v") return;
    dragging = true;
    if (typeof hideGhost === "function") hideGhost();
    sp.classList.add("active");
    try { sp.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  sp.addEventListener("pointermove", function (e) { if (dragging) applyFromEvent(e); });
  function stop() { dragging = false; sp.classList.remove("active"); if (ed && ed.cm) { try { ed.cm.refresh(); } catch (e) {} } }
  sp.addEventListener("pointerup", stop);
  sp.addEventListener("pointercancel", stop);
  sp.addEventListener("keydown", function (e) {
    var isY = orientation() === "y";
    var step = e.shiftKey ? 0.08 : 0.02;
    var cur = parseFloat(getComputedStyle(workspace).getPropertyValue("--split")) || 50;
    var delta = 0;
    if (isY) { if (e.key === "ArrowUp") delta = -step; else if (e.key === "ArrowDown") delta = step; }
    else { if (e.key === "ArrowLeft") delta = -step; else if (e.key === "ArrowRight") delta = step; }
    if (delta) {
      e.preventDefault();
      var next = Math.min(85, Math.max(15, cur + delta * 100));
      workspace.style.setProperty("--split", next.toFixed(2) + "%");
      if (ed && ed.cm) ed.cm.refresh();
    }
  });
})();

/* ═════════════════════════ mobile tabs ═════════════════════════ */
$("tabEditor").addEventListener("click", function () { setMobileTab("editor"); });
$("tabPreview").addEventListener("click", function () { setMobileTab("preview"); });
function setMobileTab(t) {
  workspace.dataset.mtab = t;
  $("tabEditor").classList.toggle("on", t === "editor");
  $("tabPreview").classList.toggle("on", t === "preview");
  $("tabEditor").setAttribute("aria-selected", String(t === "editor"));
  $("tabPreview").setAttribute("aria-selected", String(t === "preview"));
}

/* ═════════════════════════ wire up global actions ═════════════════════════ */
$("runBtn").addEventListener("click", run);
$("openTabBtn").addEventListener("click", openInNewTab);
$("exportBtn").addEventListener("click", exportFile);
$("importBtn").addEventListener("click", function () { $("fileInput").click(); });
$("fileInput").addEventListener("change", async function (e) {
  var f = e.target.files && e.target.files[0];
  e.target.value = "";
  await importFile(f);
});

/* drag & drop anywhere */
var dragDepth = 0;
window.addEventListener("dragenter", function (e) {
  if (!e.dataTransfer || [].indexOf.call(e.dataTransfer.types || [], "Files") === -1) return;
  dragDepth++;
  $("dropVeil").classList.add("show");
});
window.addEventListener("dragleave", function () { if (--dragDepth <= 0) { dragDepth = 0; $("dropVeil").classList.remove("show"); } });
window.addEventListener("dragover", function (e) { e.preventDefault(); });
window.addEventListener("drop", async function (e) {
  e.preventDefault();
  dragDepth = 0;
  $("dropVeil").classList.remove("show");
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  await importFile(f);
});

/* global shortcuts (capture before the editor sees them) */
window.addEventListener("keydown", function (e) {
  var mod = e.ctrlKey || e.metaKey;
  if (e.key === "Escape") {
    closePalette();
    $("tplBd").classList.remove("open");
    closeShortcuts();
    closeSettings();
    closeOverflow();
    return;
  }
  if (!mod) return;
  var k = (e.key || "").toLowerCase();
  if (k === "enter" && e.shiftKey) { e.preventDefault(); e.stopPropagation(); openInNewTab(); }
  else if (k === "enter") { e.preventDefault(); e.stopPropagation(); run(); }
  else if (k === "s") { e.preventDefault(); e.stopPropagation(); exportFile(); }
  else if (k === "k") { e.preventDefault(); e.stopPropagation(); if ($("paletteBd").classList.contains("open")) closePalette(); else openPalette(); }
  else if (k === "`") { e.preventDefault(); e.stopPropagation(); toggleConsole(); }
  else if (k === "f" && e.shiftKey) { e.preventDefault(); e.stopPropagation(); formatDoc(); }
}, true);

/* platform-specific kbd labels */
(function () {
  var pk = $("paletteKbd"); if (pk) pk.textContent = MOD + " K";
  var sk = $("shortcutsKbd"); if (sk) sk.textContent = MOD + " /";
})();

/* ═════════════════════════ welcome document ═════════════════════════ */
var WELCOME = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to Draft</title>
  <style>
    * { box-sizing: border-box; margin: 0; }
    body {
      min-height: 100vh; display: grid; place-items: center;
      background: radial-gradient(1200px 700px at 70% -10%, #16213a 0%, transparent 55%), #0b0e14;
      color: #e9edf4;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .card { text-align: center; padding: 48px 36px; max-width: 640px; }
    .mark {
      width: 58px; height: 58px; margin: 0 auto 28px; border-radius: 17px;
      display: grid; place-items: center;
      background: linear-gradient(150deg, #8df1ff 0%, #7aa2ff 48%, #c49bff 100%);
      box-shadow: 0 12px 40px rgba(122, 162, 255, .35), inset 0 1px 1px rgba(255, 255, 255, .65);
    }
    .mark svg { width: 26px; height: 26px; stroke: #0b1020; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    h1 { font-size: clamp(1.8rem, 5vw, 2.5rem); letter-spacing: -.03em; font-weight: 750; }
    h1 em { font-style: normal; background: linear-gradient(120deg, #8df1ff, #7aa2ff 50%, #c49bff); -webkit-background-clip: text; background-clip: text; color: transparent; }
    p { color: #99a3b6; margin: 16px auto 30px; line-height: 1.65; font-size: 16px; max-width: 48ch; }
    .hints { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    .hint {
      padding: 9px 15px; border: 1px solid #1f2735; border-radius: 99px;
      background: rgba(255, 255, 255, .03); color: #aeb8c9; font-size: 13px;
    }
    .hint b { color: #e9edf4; font-weight: 650; font-family: ui-monospace, monospace; font-size: 12px; }
    footer { margin-top: 40px; color: #6d7789; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
  </style>
</head>
<body>
  <main class="card">
    <div class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>
    </div>
    <h1>Write it. <em>Watch it.</em></h1>
    <p>Draft is a calm, fast HTML studio. The preview keeps pace with your typing, errors land in the console, and the editor thinks ahead with ghost-text predictions and Emmet expansion.</p>
    <div class="hints">
      <span class="hint"><b>Tab</b> expand Emmet</span>
      <span class="hint"><b>Ctrl Space</b> autocomplete</span>
      <span class="hint"><b>Ctrl K</b> commands</span>
      <span class="hint"><b>Ctrl Enter</b> run</span>
    </div>
    <footer>Autosaves as you work · Sandboxed preview</footer>
  </main>
</body>
</html>`;

/* ═════════════════════════ boot ═════════════════════════ */
initEditor("");
var restored = restore();
if (!restored) {
  ed.setValue(WELCOME);
} else if (ed.clearHistory) {
  ed.clearHistory();
}
buildTemplates();

/* reflect persisted UI state on the toolbar */
$("wrapBtn").classList.toggle("on", !!settings.wrap);
$("wrapBtn").setAttribute("aria-pressed", String(!!settings.wrap));
applyAutorunUI();
applyAssistUI();
applyAccent(settings.accent);
applyMotion();
applyFontSize();

updateCursorPos();
updateSelectionInfo();
updateMetrics();
applyViewport();
run();
setStatus(restored ? "Restored your last session" : "Ready — press Ctrl Enter to run");
if (restored) toast("Restored your last session");
ed.focus();

/* live preview of settings while interacting */
window.Draft = { run: run, settings: settings };

})();
