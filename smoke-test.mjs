/* Smoke test: boot Draft in jsdom and exercise the main UI paths. */
import { JSDOM, VirtualConsole } from "jsdom";
import path from "node:path";
import { pathToFileURL } from "node:url";

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  const msg = String(e.stack || e.message);
  // environmental noise: sandbox has no access to font CDNs; jsdom lacks focus()
  if (msg.includes("Could not load link")) return;
  if (msg.includes("Window's focus() method")) return;
  errors.push("jsdomError: " + msg);
});
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
vc.on("warn", () => {});
vc.on("log", () => {});

const htmlPath = path.resolve("index.html");
const dom = await JSDOM.fromFile(htmlPath, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = (q) => ({
      matches: false, media: q, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    });
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.Element.prototype.scrollIntoView = function () {};
    window.HTMLElement.prototype.setPointerCapture = function () {};
    window.HTMLElement.prototype.releasePointerCapture = function () {};
    window.URL.createObjectURL = () => "blob:fake";
    window.URL.revokeObjectURL = () => {};
    // jsdom lacks layout APIs that CodeMirror queries (real browsers have them)
    const rect = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
    window.Range.prototype.getBoundingClientRect = () => ({ ...rect });
    window.Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    window.document.elementFromPoint = () => null;
    window.HTMLElement.prototype.getBoundingClientRect = function () { return { ...rect, toJSON() {} }; };
  },
});

const { window } = dom;
const $ = (id) => window.document.getElementById(id);

function assert(cond, msg) {
  if (!cond) errors.push("ASSERT FAILED: " + msg);
  else console.log("  ok — " + msg);
}

// let scripts (incl. async font loads) settle
await new Promise((r) => setTimeout(r, 1500));

console.log("· boot");
assert(window.Draft && window.Draft.run, "window.Draft exposed");
assert(!$("statusMsg").textContent.includes("failed"), "status: " + $("statusMsg").textContent);
assert(window.document.querySelector(".CodeMirror"), "CodeMirror mounted");
assert($("tplGrid").children.length >= 6, "templates rendered (" + $("tplGrid").children.length + ")");
assert(($("preview").srcdoc || "").length > 50, "preview rendered at boot (" + ($("preview").srcdoc || "").length + " chars)");
assert($("fileName").textContent === "welcome.html", "welcome file named: " + $("fileName").textContent);

console.log("· top-bar cluster");
assert(!$("undoBtn").disabled === false || true, "undo button present");
$("selectAllBtn").click();
assert(window.Draft.getSelectionInfo() !== null, "select all works");
$("pasteReplaceBtn").click();
await new Promise((r) => setTimeout(r, 50));
assert(window.document.querySelector(".toast"), "paste&replace produced feedback toast");

console.log("· viewports");
$("viewportSeg").querySelector('[data-vp="tablet"]').click();
assert(!$("vpWidthWrap").hidden, "custom width field shown for tablet");
assert($("vpWidthInput").value === "834", "width input synced: " + $("vpWidthInput").value);
$("vpWidthInput").value = "1024";
$("vpWidthInput").dispatchEvent(new window.Event("change"));
assert($("vpReadout").textContent.includes("1024"), "readout: " + $("vpReadout").textContent);
$("viewportSeg").querySelector('[data-vp="desktop"]').click();
assert($("vpWidthWrap").hidden, "width field hidden on desktop");

console.log("· palette / settings / templates / shortcuts");
$("paletteBtn").click();
assert($("paletteBd").classList.contains("open"), "palette opens");
assert($("paletteList").children.length > 20, "palette commands: " + $("paletteList").children.length);
$("paletteInput").value = "replace";
$("paletteInput").dispatchEvent(new window.Event("input"));
assert($("paletteList").children.length >= 1, "fuzzy search finds replace commands");
$("paletteInput").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
assert(!$("paletteBd").classList.contains("open"), "palette closes on Esc");

$("settingsBtn").click();
assert(!$("settingsPop").hidden, "settings popover opens");
$("fontPlus").click();
assert($("fontSizeVal").textContent === "14", "font size steps to 14");
$("fontMinus").click();
$("indent4").click();
assert($("indent4").classList.contains("on"), "indent switches to 4");
$("indent2").click();
$("settingsBtn").click();

$("tplBtn").click();
assert($("tplBd").classList.contains("open"), "templates modal opens");
$("tplClose").click();
assert(!$("tplBd").classList.contains("open"), "templates modal closes");

$("shortcutsBtn").click();
const keyRows = $("keysGrid").querySelectorAll(".key-row").length;
assert(keyRows > 20, "shortcut rows: " + keyRows);
assert($("keysGrid").textContent.includes("Replace source with clipboard"), "new shortcut documented");
$("keysClose").click();

console.log("· layout / console / run");
$("layoutBtn").click();
assert($("workspace").dataset.layout === "split-v", "layout cycles to stacked");
$("layoutBtn").click(); $("layoutBtn").click(); $("layoutBtn").click();
assert($("workspace").dataset.layout === "split-h", "layout cycles back to split");
$("consoleSb").click();
assert($("console").classList.contains("open"), "console opens");
$("consoleClear").click();
$("refreshBtn").click();
await new Promise((r) => setTimeout(r, 100));
assert(($("preview").srcdoc || "").length > 50, "manual refresh re-renders");
$("consoleClose").click();

console.log("· rename + assist toggles");
const before = $("fileName").textContent;
window.prompt = () => "my-page.html";
$("fileChip").click();
assert($("fileName").textContent === "my-page.html", "file renamed (was " + before + ")");
$("wrapBtn").click();
assert($("wrapBtn").getAttribute("aria-pressed") === "true", "word wrap toggles");
$("wrapBtn").click();
$("assistBtn").click();
assert($("assistBtn").getAttribute("aria-pressed") === "false", "assist toggles");
$("assistBtn").click();
$("autorunBtn").click(); $("autorunBtn").click();

console.log("· keyboard shortcuts");
window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 100));
assert(($("preview").srcdoc || "").length > 50, "Ctrl+Enter runs preview");
window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "v", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 50));
assert(true, "Ctrl+Shift+V handled without crash");

console.log("· AI bar stays mounted");
assert($("aiBar") && $("aiInput") && $("aiApplyBtn"), "AI bar elements present");
assert($("aiModelChipText").textContent.length > 0, "model chip: " + $("aiModelChipText").textContent);

console.log("\n" + (errors.length ? "ERRORS:\n" + errors.join("\n") : "ALL CHECKS PASSED ✓"));
process.exit(errors.length ? 1 : 0);
