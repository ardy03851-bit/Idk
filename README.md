# Draft — HTML Studio

A fast, beautifully engineered HTML studio that runs entirely in the browser.
Write large HTML documents with a live sandboxed preview, console capture,
Emmet-style expansion, ghost-text predictions, context-aware autocomplete,
AI-assisted edits, starter templates and a command palette — no build step,
no server, no CDN dependencies.

## Layout

Draft uses an **activity-rail layout** built for comfort and speed:

- **Left rail** — brand, command palette, import/export, open-in-tab,
  templates, preferences and the big Run button (thumb zone on touch).
- **Top bar** — file identity (click to rename) plus the clipboard &
  history cluster: *Undo · Redo · Select all · Copy · Replace with clipboard*.
- **Workspace** — source editor and live preview with a draggable splitter,
  cycling layouts (side-by-side / stacked / editor-only / preview-only).
- **Console dock** — captured `console.*`, warnings and runtime errors with
  level filters, counts, copy and jump-to-line.
- **Status bar** — cursor/selection info, document metrics, autosave state,
  auto-run and console toggles.

## Editor control

| Action | Shortcut |
| --- | --- |
| Select all source | `Ctrl/⌘ A` |
| Copy source | `Ctrl/⌘ C` |
| **Replace whole document with clipboard** | `Ctrl/⌘ ⇧ V` |
| Undo / redo | `Ctrl/⌘ Z` / `Ctrl/⌘ ⇧ Z` |
| Format document | `Ctrl/⌘ ⇧ F` |
| Find / replace in document | `Ctrl/⌘ F` |
| Duplicate / move / delete line | `Ctrl/⌘ D` · `Alt ↑↓` · `Ctrl/⌘ ⇧ K` |
| Toggle comment | `Ctrl/⌘ /` |
| Command palette | `Ctrl/⌘ K` |
| Run preview | `Ctrl/⌘ ↵` |
| Open in new tab | `Ctrl/⌘ ⇧ ↵` |
| Export file | `Ctrl/⌘ S` |
| AI edit prompt | `Ctrl/⌘ I` |
| Keyboard shortcuts sheet | `Ctrl/⌘ ⇧ ?` |

The clipboard toolbar also lives in the top bar, and every action is
searchable from the command palette.

## Preview engine

- **Content-hash rendering** — identical documents are never re-rendered.
- **Visibility-aware** — renders are deferred while the preview pane, the
  panel tab, or the browser tab is hidden, then flushed on return.
- **Sandboxed iframe** — scripts run in an isolated origin with a console
  bridge injected after the doctype (quirks mode is never triggered).
- **Device viewports** — desktop, tablet (834 px) and phone (390 px) with a
  **custom width field (240–6000 px)**, rotation, fit/percentage zoom and
  full-screen preview. Zoom uses transform scaling so the emulated viewport
  size stays accurate at every zoom level.
- **Large documents** — multi-megabyte documents switch to blob URLs and
  pause auto-run with a manual-render prompt.

## iPad & touch

- 44 px+ touch targets, `touch-action: manipulation` (no double-tap zoom),
  safe-area aware edges, and 16 px inputs so the software keyboard never
  auto-zooms the page.
- **Swipe horizontally** (outside the editor) to switch Source ⇄ Preview,
  or use the segmented panel tabs.
- `visualViewport` tracking keeps the app sized to the visible area while
  the keyboard is up and scrolls the focused field into view.
- Hardware-keyboard shortcuts work the same as desktop.

## Coding assist

- **Emmet expansion** with inline ghost-text preview — press `Tab` to accept.
  Supports `!`, nesting (`>`), siblings (`+`), climb (`^`), multiplication
  (`*n`), grouping, `#id`/`.class`/`[attr]`/`{text}` and `$` numbering.
- **Context-aware autocomplete** — HTML tags, attributes and values, CSS
  properties and values, JS/DOM members, custom properties and document
  words.
- Smart backspace for auto-closed pairs and tags, matching tag/bracket
  highlight, code folding, active-line highlight.

## AI edit

Describe a small change in plain English — Draft asks a chain of **10 free,
no-key models** (Pollinations) in order and applies targeted
search/replace patches. The whole document is never rewritten, and your
selection scopes the edit. Failures auto-switch to the next model.

## Templates

Blank document · Landing page · Canvas particles · CSS motion ·
Dashboard UI · Contact form — one click, zero setup.

## Preferences

Editor font size, indent width, accent theme (Spectral / Amber / Jade /
Rose), auto-run delay (Off / Snappy / Balanced / Calm), reduce motion,
word wrap, coding assist. Everything persists to `localStorage` and the
document autosaves as you type.

## Development

```bash
npm install     # dev dependency: jsdom for the smoke test
npm test        # boots the whole app in jsdom and exercises the UI
npm start       # serve on http://localhost:8080
```

Everything else is static: `index.html`, `assets/css/*`, `assets/js/*`
and the vendored CodeMirror 5 + beautify runtimes under `vendor/`.

## Repository structure

```
index.html               app shell + icon sprite + modals
assets/css/main.css      design tokens & components
assets/css/workspace.css app shell layout, responsive & iPad layer
assets/js/app.js         editor, preview engine, console, palette, settings
assets/js/ai-edit.js     AI edit chain (free models, no key)
assets/js/hints.js       context-aware completions
assets/js/emmet.js       Emmet expansion
vendor/                  CodeMirror 5 plugins + JS/HTML/CSS beautifiers
smoke-test.mjs           jsdom end-to-end smoke test
```
