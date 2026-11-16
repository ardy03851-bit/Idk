/* ═══════════════════════════════════════════════════════════════════
   Draft — HTML Studio · AI edit
   Describe a small change in plain English; the AI applies a targeted
   search/replace patch to your document — never a full rewrite.
   10 free, no-key models are tried in order; if one fails Draft
   automatically switches to the next until one works.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var Draft = window.Draft;
  var aiBar = document.getElementById("aiBar");
  if (!aiBar) return;                 // panel not mounted
  if (!Draft || !Draft.editor) {      // app failed to boot — leave the bar inert
    aiBar.setAttribute("aria-hidden", "true");
    aiBar.style.display = "none";
    var st0 = document.getElementById("aiStatus");
    if (st0) st0.style.display = "none";
    return;
  }

  /* ───────────────────────── model chain ─────────────────────────
     Every model here is free and needs no API key. Nine of them are
     served by the Pollinations OpenAI-compatible endpoint (anonymous,
     rate-limited per IP). The last is the Pollinations Classic text
     endpoint (GPT-OSS 20B), verified working with no signup at all.
     Order: fastest/most-capable editors first; automatic failover.   */
  var GEN_URL = "https://gen.pollinations.ai/v1/chat/completions";
  var CLASSIC_URL = "https://text.pollinations.ai/";

  var MODELS = [
    { id: "openai/gpt-5.4-nano",      label: "GPT-5.4 Nano",    vendor: "OpenAI · fast all-rounder",  ep: "gen" },
    { id: "openai/gpt-6-luna",        label: "GPT-6 Luna",      vendor: "OpenAI · efficient",         ep: "gen" },
    { id: "openai/gpt-5.3-codex",     label: "GPT-5.3 Codex",   vendor: "OpenAI · coding",            ep: "gen" },
    { id: "moonshotai/kimi-k3.1-pro", label: "Kimi K3.1 Pro",   vendor: "Moonshot · coding & agents", ep: "gen" },
    { id: "minimax/minimax-m3.1-flash", label: "MiniMax M3.1 Flash", vendor: "MiniMax · coding",        ep: "gen" },
    { id: "openai/gpt-6.1-terra",     label: "GPT-6.1 Terra",   vendor: "OpenAI · all-rounder",       ep: "gen" },
    { id: "openai/gpt-6.1-sol",       label: "GPT-6.1 Sol",     vendor: "OpenAI · coding",            ep: "gen" },
    { id: "openai/gpt-6-sol",         label: "GPT-6 Sol",       vendor: "OpenAI · coding",            ep: "gen" },
    { id: "meta/muse-spark-open",     label: "Muse Spark Open", vendor: "Meta · agentic coding",      ep: "gen" },
    { id: "openai-fast",              label: "GPT-OSS 20B",     vendor: "OpenAI open weights · classic", ep: "classic" }
  ];

  var LS_KEY = "draft-studio.ai.v1";
  var DOC_BUDGET_GEN = 22000;      // chars of document sent to chat models
  var DOC_BUDGET_CLASSIC = 1200;   // Classic is GET-based — keep the percent-encoded URL safely short
  var ATTEMPT_TIMEOUT_MS = 60000;

  function $(id) { return document.getElementById(id); }

  /* ───────────────────────── persistence ───────────────────────── */
  function loadUI() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var ui = raw ? JSON.parse(raw) : {};
      return { preferred: ui.preferred || "auto", lastGood: ui.lastGood || null };
    } catch (_) { return { preferred: "auto", lastGood: null }; }
  }
  function saveUI(ui) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(ui)); } catch (_) {}
  }

  function buildChain() {
    var ui = loadUI();
    var chain = MODELS.slice();
    if (ui.preferred !== "auto") {
      var jp = chain.findIndex(function (m) { return m.id === ui.preferred; });
      if (jp > 0) chain.unshift(chain.splice(jp, 1)[0]);
    } else if (ui.lastGood) {
      var jg = chain.findIndex(function (m) { return m.id === ui.lastGood; });
      if (jg > 0) chain.unshift(chain.splice(jg, 1)[0]);
    }
    return { chain: chain, ui: ui };
  }

  /* ───────────────────────── prompt ───────────────────────── */
  var SYSTEM_PROMPT = [
    "You are an expert front-end engineer making a SMALL, targeted edit to an HTML document open in a code editor.",
    "",
    "Reply with ONLY search/replace blocks in this exact format:",
    "",
    "<<<<<<< SEARCH",
    "(exact original text, copied verbatim including indentation and newlines)",
    "=======",
    "(replacement text)",
    ">>>>>>> REPLACE",
    "",
    "Rules:",
    "- Change as little as possible. Edit only what the user asked. Never reformat, restyle or rewrite unrelated code.",
    "- Every SEARCH block must appear EXACTLY ONCE in the document. Include 1–4 lines of surrounding context to make it unique.",
    "- Produce 1–6 blocks. Keep each block small.",
    "- Do not wrap the reply in markdown fences and do not add commentary.",
    "- If the edit cannot be done safely, reply with a single line starting with \"ERROR:\" and say why."
  ].join("\n");

  function buildExcerpt(doc, anchorIdx, budget) {
    if (doc.length <= budget) return { text: doc, truncated: false, offset: 0 };
    var half = budget >> 1;
    var start = Math.max(0, Math.min(anchorIdx - half, doc.length - budget));
    var end = Math.min(doc.length, start + budget);
    var text = (start > 0 ? "…[document truncated before this point]…\n" : "") +
               doc.slice(start, end) +
               (end < doc.length ? "\n…[document truncated after this point]…" : "");
    return { text: text, truncated: true, offset: start };
  }

  function buildUserPrompt(doc, sel, instruction, budget) {
    var anchor = sel && typeof sel.cursor === "number" ? sel.cursor : Math.floor(doc.length / 2);
    var excerpt = buildExcerpt(doc, anchor, budget);
    var parts = [
      "Document" + (excerpt.truncated ? " (excerpted — make your edit only inside what you can see)" : "") + ":\n```html\n" + excerpt.text + "\n```"
    ];
    if (sel && sel.text && sel.text.trim()) {
      parts.push("The user has this region selected — keep the edit inside it:\n```\n" + sel.text + "\n```");
    }
    parts.push("Request: " + instruction);
    return parts.join("\n\n");
  }

  /* ───────────────────── patch parsing & apply ───────────────────── */
  function PatchError(msg) { this.message = msg; this.name = "PatchError"; }
  PatchError.prototype = Object.create(Error.prototype);
  PatchError.prototype.constructor = PatchError;

  function parseBlocks(text) {
    var blocks = [];
    var re = /<{3,}\s*SEARCH\s*\r?\n([\s\S]*?)\r?\n?={3,}\s*\r?\n([\s\S]*?)\r?\n?>{3,}\s*REPLACE\b/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      blocks.push({ search: m[1], replace: m[2] });
    }
    return blocks;
  }

  function applyHunks(doc, blocks, selection) {
    var spans = [];
    for (var i = 0; i < blocks.length; i++) {
      var s = blocks[i].search, r = blocks[i].replace;
      if (!s || !s.trim()) throw new PatchError("patch #" + (i + 1) + " had an empty SEARCH block");
      var idx = doc.indexOf(s);
      if (idx === -1 && s.indexOf("\r") !== -1) {
        var sLF = s.replace(/\r\n/g, "\n");
        var j = doc.indexOf(sLF);
        if (j !== -1) { s = sLF; idx = j; }
      }
      if (idx === -1) throw new PatchError("patch #" + (i + 1) + " — text not found (the AI must copy the document exactly)");
      if (doc.indexOf(s, idx + 1) !== -1) throw new PatchError("patch #" + (i + 1) + " — matches several places; needs more context lines");
      spans.push({ start: idx, end: idx + s.length, replace: r });
    }
    spans.sort(function (a, b) { return a.start - b.start; });
    if (selection && selection.text && selection.text.trim()) {
      for (var si = 0; si < spans.length; si++) {
        if (spans[si].start < selection.from || spans[si].end > selection.to) {
          throw new PatchError("the selected text must be edited in place; the proposed patch extends outside your selection");
        }
      }
    }
    for (var k = 1; k < spans.length; k++) {
      if (spans[k].start < spans[k - 1].end) throw new PatchError("patches overlap — try a smaller, more specific request");
    }
    var out = "", last = 0;
    for (var n = 0; n < spans.length; n++) {
      out += doc.slice(last, spans[n].start) + spans[n].replace;
      last = spans[n].end;
    }
    return { doc: out + doc.slice(last), ranges: spans };
  }

  /* ───────────────────── provider calls ───────────────────── */
  function errSnippet(res) {
    return res.text().then(function (t) {
      t = (t || "").replace(/\s+/g, " ").trim();
      return t ? t.slice(0, 140) : "";
    }).catch(function () { return ""; });
  }

  function callGen(model, system, user, signal) {
    return fetch(GEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal,
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.1,
        max_tokens: 4096
      })
    }).then(function (res) {
      if (!res.ok) {
        return errSnippet(res).then(function (snip) {
          var e = new Error("HTTP " + res.status + (snip ? " — " + snip : ""));
          e.httpStatus = res.status;
          throw e;
        });
      }
      return res.json().then(function (data) {
        var choices = data && data.choices;
        var content = choices && choices[0] && choices[0].message && choices[0].message.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("the model returned an empty reply");
        return content;
      });
    });
  }

  function callClassic(model, system, user, signal) {
    var prompt = system + "\n\n" + user + "\n\nReply with ONLY the search/replace blocks, nothing else.";
    var url = CLASSIC_URL + encodeURIComponent(prompt) + "?model=openai-fast&temperature=0.1&referrer=draft-html-studio";
    return fetch(url, { signal: signal }).then(function (res) {
      if (!res.ok) {
        var e = new Error("HTTP " + res.status);
        e.httpStatus = res.status;
        throw e;
      }
      return res.text().then(function (text) {
        if (!text || !text.trim()) throw new Error("the model returned an empty reply");
        if (/^(sorry|error|i('m| am) (sorry|unable)|cannot assist)/i.test(text.trim()) && text.trim().length < 240) {
          throw new Error("the model declined the request");
        }
        return text;
      });
    });
  }

  function callModel(model, system, user, signal) {
    return model.ep === "classic" ? callClassic(model, system, user, signal) : callGen(model, system, user, signal);
  }

  /* ───────────────────── status UI ───────────────────── */
  var statusEl = $("aiStatus"), statusText = $("aiStatusText"),
      statusDot = $("aiStatusDot"), statusNote = aiBar.querySelector(".ai-status-note");
  var statusTimer = 0;

  if (statusNote) statusNote.textContent = MODELS.length + " free models · no key · auto-switch";

  function setLine(text, kind, sticky) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.setAttribute("data-state", kind || "busy");
    if (statusText) statusText.textContent = text;
    clearTimeout(statusTimer);
    if (!sticky) {
      statusTimer = setTimeout(function () { statusEl.hidden = true; }, kind === "error" ? 12000 : 7000);
    }
  }
  function hideLineSoon() { clearTimeout(statusTimer); statusTimer = setTimeout(function () { if (statusEl) statusEl.hidden = true; }, 5000); }

  /* ───────────────────── model picker menu ───────────────────── */
  var chip = $("aiModelChip"), chipText = $("aiModelChipText"), menu = $("aiModelMenu");

  function currentPreferred() { return loadUI().preferred; }

  function refreshChip() {
    var ui = loadUI();
    if (ui.preferred === "auto") { chipText.textContent = "Auto · chain"; return; }
    var m = MODELS.filter(function (x) { return x.id === ui.preferred; })[0];
    chipText.textContent = m ? m.label : "Auto · chain";
  }

  function buildMenu() {
    if (!menu) return;
    menu.innerHTML = "";
    var ui = loadUI();

    var head = document.createElement("div");
    head.className = "ai-menu-head";
    head.textContent = "AI models — free, no key";
    menu.appendChild(head);

    function addOption(value, title, sub) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ai-menu-item" + (ui.preferred === value ? " on" : "");
      b.setAttribute("role", "menuitemradio");
      b.setAttribute("aria-checked", String(ui.preferred === value));
      var t = document.createElement("span");
      t.className = "ai-menu-title";
      t.textContent = title;
      var s = document.createElement("span");
      s.className = "ai-menu-sub";
      s.textContent = sub;
      b.appendChild(t); b.appendChild(s);
      b.addEventListener("click", function () {
        var next = loadUI(); next.preferred = value; saveUI(next);
        refreshChip(); buildMenu(); closeMenu();
        Draft.toast(value === "auto" ? "AI: automatic model chain" : "AI: " + title);
      });
      menu.appendChild(b);
    }

    addOption("auto", "Auto — model chain (recommended)", "Tries the chain in order and switches automatically on failure");
    MODELS.forEach(function (m) { addOption(m.id, m.label, m.vendor + " · " + (m.ep === "classic" ? "classic endpoint" : "pollinations.ai")); });

    var foot = document.createElement("div");
    foot.className = "ai-menu-foot";
    foot.textContent = "The request sends your instruction and a document excerpt to Pollinations.ai (anonymous, rate-limited).";
    menu.appendChild(foot);
  }

  function openMenu() { menu.hidden = false; chip.setAttribute("aria-expanded", "true"); }
  function closeMenu() { if (!menu.hidden) { menu.hidden = true; chip.setAttribute("aria-expanded", "false"); } }
  function toggleMenu() { menu.hidden ? openMenu() : closeMenu(); }

  if (chip) chip.addEventListener("click", function (e) { e.stopPropagation(); menu.hidden ? (buildMenu(), openMenu()) : closeMenu(); });
  document.addEventListener("click", function (e) { if (menu && !menu.hidden && !menu.contains(e.target) && e.target !== chip) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* ───────────────────── apply flow ───────────────────── */
  var input = $("aiInput"), applyBtn = $("aiApplyBtn"), applyLbl = $("aiApplyLbl"),
      stopBtn = $("aiStopBtn");
  var busy = false, userStopped = false, currentController = null;

  function setBusyUI(on) {
    busy = on;
    if (input) input.disabled = on;
    if (applyBtn) { applyBtn.disabled = on; applyBtn.setAttribute("aria-busy", String(on)); }
    if (applyLbl) applyLbl.textContent = on ? "Working…" : "Apply";
    if (stopBtn) stopBtn.hidden = !on;
  }

  function failReason(err) {
    var m = err && err.message ? err.message : String(err);
    m = m.replace(/\s+/g, " ").trim();
    return m.length > 160 ? m.slice(0, 157) + "…" : m;
  }

  async function apply() {
    if (busy) return;
    var instruction = (input.value || "").trim();
    if (!instruction) {
      aiBar.classList.add("ai-shake");
      setTimeout(function () { aiBar.classList.remove("ai-shake"); }, 420);
      setLine("Type what you want changed — e.g. “make the heading white”.", "warn", false);
      input.focus();
      return;
    }

    userStopped = false;
    setBusyUI(true);
    closeMenu();

    var doc = Draft.editor.getValue();
    var sel = null;
    try { sel = Draft.getSelectionInfo ? Draft.getSelectionInfo() : null; } catch (_) {}

    if (!doc || !doc.trim()) {
      setBusyUI(false);
      setLine("The document is empty — nothing to edit.", "warn", false);
      return;
    }

    var built = buildChain();
    var chain = built.chain;
    var ui = built.ui;

    Draft.setStatus("AI edit — asking " + MODELS.length + " free models…", "busy");
    Draft.addLog("info", ["AI edit requested: " + instruction + (sel && sel.text ? " (with selection)" : "")]);

    var failures = [];
    var total = chain.length;

    for (var i = 0; i < total; i++) {
      if (userStopped) break;
      var model = chain[i];
      var budget = model.ep === "classic" ? DOC_BUDGET_CLASSIC : DOC_BUDGET_GEN;
      var user = buildUserPrompt(doc, sel, instruction, budget);
      var controller = new AbortController();
      currentController = controller;
      var timer = setTimeout(function () { controller.abort(); }, ATTEMPT_TIMEOUT_MS);

      setLine("Asking " + model.label + " (" + (i + 1) + "/" + total + ")…", "busy", true);

      var reply = null;
      try {
        reply = await callModel(model, SYSTEM_PROMPT, user, controller.signal);
      } catch (err) {
        clearTimeout(timer);
        if (userStopped) { Draft.addLog("warn", ["AI edit cancelled by user"]); break; }
        var reason = (err && err.name === "AbortError") ? "timed out after " + Math.round(ATTEMPT_TIMEOUT_MS / 1000) + "s" : failReason(err);
        failures.push({ label: model.label, reason: reason });
        Draft.addLog("warn", ["AI · " + model.id + " failed — " + reason]);
        if (i + 1 < total) {
          setLine(model.label + " failed (" + reason + ") → switching to " + chain[i + 1].label + "…", "warn", true);
        }
        continue;
      }
      clearTimeout(timer);

      /* the model itself signalled it can't do the edit */
      var errLine = reply.match(/^\s*ERROR\s*:\s*(.+)$/im);
      if (errLine && reply.trim().length < 400) {
        var why = failReason(errLine[1]);
        failures.push({ label: model.label, reason: why });
        Draft.addLog("warn", ["AI · " + model.id + " declined — " + why]);
        if (i + 1 < total) setLine(model.label + " declined → switching to " + chain[i + 1].label + "…", "warn", true);
        continue;
      }

      var blocks = parseBlocks(reply);
      if (!blocks.length) {
        failures.push({ label: model.label, reason: "no edit blocks in reply" });
        Draft.addLog("warn", ["AI · " + model.id + " failed — reply contained no search/replace blocks"]);
        if (i + 1 < total) setLine(model.label + " returned an unusable reply → switching to " + chain[i + 1].label + "…", "warn", true);
        continue;
      }

      var patch;
      try {
        patch = applyHunks(doc, blocks, sel);
      } catch (patchErr) {
        failures.push({ label: model.label, reason: patchErr.message });
        Draft.addLog("warn", ["AI · " + model.id + " patch rejected — " + patchErr.message]);
        if (i + 1 < total) setLine(model.label + " produced an unusable patch → switching to " + chain[i + 1].label + "…", "warn", true);
        continue;
      }

      if (patch.doc === doc) {
        failures.push({ label: model.label, reason: "patch changed nothing" });
        if (i + 1 < total) setLine(model.label + " changed nothing → switching to " + chain[i + 1].label + "…", "warn", true);
        continue;
      }

      /* Apply only the matched ranges; CodeMirror groups them into one undo step. */
      try {
        if (!Draft.editor.applyRanges) throw new Error("targeted editor patches are unavailable");
        Draft.editor.applyRanges(patch.ranges);
      } catch (applyErr) {
        failures.push({ label: model.label, reason: "could not write to the editor" });
        continue;
      }

      currentController = null;
      var ui2 = loadUI();
      ui2.lastGood = model.id;
      saveUI(ui2);

      var hunkWord = blocks.length === 1 ? "1 edit" : blocks.length + " edits";
      setLine("Applied " + hunkWord + " via " + model.label + (failures.length ? " (after " + failures.length + " switch" + (failures.length > 1 ? "es" : "") + ")" : ""), "ok", false);
      Draft.setStatus("AI edit applied · " + model.label, "");
      Draft.toast("AI edit applied · " + model.label, "ok");
      Draft.addLog("info", ["AI edit applied via " + model.id + " — " + blocks.length + " patch block(s)" + (failures.length ? " — recovered from: " + failures.map(function (f) { return f.label; }).join(", ") : "")]);
      try { if (Draft.run) Draft.run(); } catch (_) {}
      try { Draft.focusEditor(); } catch (_) {}
      setBusyUI(false);
      return;
    }

    /* every model failed (or user stopped) */
    setBusyUI(false);
    currentController = null;
    if (userStopped) {
      setLine("AI edit stopped.", "warn", false);
      Draft.setStatus("AI edit stopped", "");
      return;
    }
    var last = failures[failures.length - 1];
    var allRateLimited = failures.length > 0 && failures.every(function (f) { return /429|rate/i.test(f.reason); });
    var msg = "All " + failures.length + " free models failed" + (last ? " — last error: " + last.reason : "");
    if (allRateLimited) msg += " · the free anonymous tier is rate-limited — wait a minute and try again";
    else msg += " · check your connection, browser access to Pollinations, or the console for model errors";
    setLine(msg, "error", false);
    Draft.setStatus("AI edit failed — all models", "error");
    Draft.toast("AI edit failed — see console for details", "err");
    Draft.addLog("error", ["AI edit failed on all " + failures.length + " models:"].concat(
      failures.map(function (f) { return "    · " + f.label + " — " + f.reason; })
    ));
  }

  if (stopBtn) stopBtn.addEventListener("click", function () {
    userStopped = true;
    if (currentController) try { currentController.abort(); } catch (_) {}
  });
  if (applyBtn) applyBtn.addEventListener("click", apply);
  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); apply(); }
    });
  }

  /* ───────────────────── init ───────────────────── */
  refreshChip();
  if (statusEl) statusEl.hidden = true;
})();
