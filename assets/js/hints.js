/* ═══════════════════════════════════════════════════════════════════
   Draft Hints — context-aware coding assistance
   HTML tags · attributes · attribute values · CSS properties & values
   JS/DOM members · CSS custom properties · document words fallback
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
"use strict";

/* ───────────────────────── data sets ───────────────────────── */

var HTML_TAGS = [
  // text & sections
  ["html","document root"],["head","metadata container"],["body","document body"],["title","document title"],
  ["base","document base URL"],["link","external resource"],["meta","metadata"],["style","embedded CSS"],
  ["h1","heading 1"],["h2","heading 2"],["h3","heading 3"],["h4","heading 4"],["h5","heading 5"],["h6","heading 6"],
  ["p","paragraph"],["a","hyperlink"],["abbr","abbreviation"],["address","contact info"],["blockquote","quoted block"],
  ["cite","citation title"],["code","inline code"],["pre","preformatted text"],["em","emphasis"],["strong","importance"],
  ["small","fine print"],["s","struck through"],["cite","work title"],["q","inline quote"],["sub","subscript"],["sup","superscript"],
  ["mark","highlight"],["b","bold"],["i","italic"],["u","underline"],["wbr","word break opportunity"],["br","line break"],
  ["hr","thematic break"],["time","date/time"],["data","machine-readable value"],["del","deleted text"],["ins","inserted text"],["kbd","keyboard input"],["samp","sample output"],["var","variable"],
  // sections
  ["header","page/section header"],["footer","page/section footer"],["main","main content"],["nav","navigation"],
  ["section","thematic section"],["article","self-contained composition"],["aside","tangential content"],
  ["div","generic container"],["span","generic inline"],["figure","figure with caption"],["figcaption","figure caption"],
  ["details","disclosure widget"],["summary","disclosure summary"],["dialog","dialog box"],["hgroup","heading group"],["search","search region"],
  // lists
  ["ul","unordered list"],["ol","ordered list"],["li","list item"],["dl","description list"],["dt","description term"],["dd","description details"],["menu","menu list"],
  // tables
  ["table","table"],["thead","table header group"],["tbody","table body group"],["tfoot","table footer group"],
  ["tr","table row"],["td","table cell"],["th","header cell"],["caption","table caption"],["colgroup","column group"],["col","column"],
  // forms
  ["form","form"],["input","input control"],["button","button"],["select","select menu"],["option","select option"],
  ["optgroup","option group"],["textarea","multi-line input"],["label","control label"],["fieldset","control group"],
  ["legend","fieldset legend"],["datalist","predefined options"],["output","calculation output"],["progress","progress bar"],
  ["meter","scalar gauge"],["output","calculation output"],
  // media
  ["img","image"],["picture","responsive image"],["source","media source"],["video","video player"],["audio","audio player"],
  ["track","text track"],["canvas","bitmap canvas"],["svg","vector graphics"],["iframe","embedded browsing context"],
  // scripting/embed
  ["script","executable script"],["noscript","fallback content"],["template","inert template"],["slot","shadow DOM slot"],
  ["object","external object"],["embed","embedded content"],["picture","art direction"],
  // svg basics
  ["defs","SVG definitions"],["path","SVG path"],["circle","SVG circle"],["rect","SVG rectangle"],["line","SVG line"],["polyline","SVG polyline"],["polygon","SVG polygon"],
  ["g","SVG group"],["text","SVG text"],["tspan","SVG text span"],["linearGradient","SVG gradient"],["radialGradient","SVG gradient"],["stop","gradient stop"],["use","SVG reference"],["symbol","SVG symbol"],
  ["foreignObject","foreign content in SVG"],["clipPath","SVG clip path"],["mask","SVG mask"],["ellipse","SVG ellipse"]
];

var GLOBAL_ATTRS = [
  "id","class","style","title","hidden","tabindex","role","dir","lang","accesskey","draggable","contenteditable","spellcheck","inputmode","enterkeyhint","autocapitalize","translate",
  "aria-label","aria-labelledby","aria-describedby","aria-description","aria-hidden","aria-expanded","aria-controls","aria-current","aria-pressed","aria-selected","aria-checked","aria-disabled","aria-invalid","aria-live","aria-atomic","aria-haspopup","aria-owns","aria-required","aria-autocomplete","aria-orientation","aria-valuemin","aria-valuemax","aria-valuenow","aria-valuetext","aria-modal","aria-multiline","aria-multiselectable","aria-placeholder","aria-readonly","aria-relevant","aria-sort","aria-busy","aria-colcount","aria-rowcount","aria-colindex","aria-rowindex"
];

var ATTRS_BY_TAG = {
  input:["type","name","value","placeholder","required","disabled","checked","min","max","step","minlength","maxlength","pattern","autocomplete","autofocus","list","multiple","readonly","accept","size","capture","formaction","formnovalidate"],
  button:["type","name","value","disabled","autofocus","form","formaction","formmethod","formnovalidate","formtarget"],
  a:["href","target","rel","download","hreflang","type","referrerpolicy","ping"],
  link:["rel","href","type","as","media","integrity","crossorigin","referrerpolicy","sizes","color","imagesrcset","imagesizes","fetchpriority"],
  img:["src","srcset","alt","width","height","loading","decoding","sizes","fetchpriority","crossorigin","referrerpolicy","usemap","ismap"],
  source:["src","srcset","type","media","sizes"],
  form:["action","method","enctype","novalidate","autocomplete","target","name","rel","accept-charset"],
  meta:["name","content","property","charset","http-equiv","media","scheme"],
  script:["src","type","defer","async","nomodule","integrity","crossorigin","referrerpolicy","fetchpriority"],
  html:["lang"],
  select:["name","multiple","required","disabled","size","autofocus","autocomplete"],
  option:["value","selected","disabled","label"],
  optgroup:["label","disabled"],
  label:["for"],
  textarea:["rows","cols","name","placeholder","required","maxlength","minlength","wrap","readonly","disabled","autocomplete","autofocus","spellcheck"],
  iframe:["src","sandbox","allow","allowfullscreen","width","height","loading","name","referrerpolicy","srcdoc","title"],
  canvas:["width","height"],
  td:["colspan","rowspan","headers"],
  th:["colspan","rowspan","headers","scope"],
  ol:["start","reversed","type"],
  li:["value"],
  ul:[],dl:[],
  details:["open","name"],
  video:["src","controls","autoplay","loop","muted","preload","poster","width","height","playsinline","crossorigin"],
  audio:["src","controls","autoplay","loop","muted","preload","crossorigin"],
  track:["kind","src","srclang","label","default"],
  area:["href","alt","shape","coords","target","rel","download"],
  col:["span"],
  time:["datetime"],
  data:["value"],
  progress:["value","max"],
  meter:["value","min","max","low","high","optimum"],
  fieldset:["disabled","name"],
  output:["for","name"],
  object:["data","type","width","height","name"],
  embed:["src","type","width","height"],
  svg:["viewBox","width","height","fill","stroke","xmlns","role","aria-hidden"],
  circle:["cx","cy","r","fill","stroke","stroke-width","opacity"],
  rect:["x","y","width","height","rx","ry","fill","stroke","stroke-width","opacity"],
  path:["d","fill","stroke","stroke-width","stroke-linecap","stroke-linejoin","opacity","fill-opacity","stroke-opacity"],
  line:["x1","y1","x2","y2","stroke","stroke-width"],
  polyline:["points","fill","stroke","stroke-width"],
  polygon:["points","fill","stroke","stroke-width"],
  linearGradient:["x1","y1","x2","y2","gradientUnits","gradientTransform"],
  radialGradient:["cx","cy","r","fx","fy","gradientUnits"],
  stop:["offset","stop-color","stop-opacity"],
  use:["href","xlink:href","x","y","width","height"]
};

var ATTR_VALUES = {
  "input.type":["text","email","password","number","search","tel","url","date","datetime-local","time","week","month","color","range","checkbox","radio","file","hidden","submit","button","reset","image"],
  "button.type":["button","submit","reset"],
  "ol.type":["1","A","a","I","i"],
  "embed.type":["text/html","application/pdf","image/svg+xml","video/mp4"],
  "script.type":["module","text/javascript","application/ld+json"],
  "object.type":["text/html","application/pdf","image/svg+xml"],
  target:["_self","_blank","_parent","_top"],
  method:["get","post","dialog"],
  enctype:["application/x-www-form-urlencoded","multipart/form-data","text/plain"],
  charset:["utf-8","iso-8859-1","windows-1252"],
  crossorigin:["anonymous","use-credentials"],
  loading:["lazy","eager"],
  decoding:["async","sync","auto"],
  autocomplete:["on","off","name","honorific-prefix","given-name","family-name","honorific-suffix","nickname","username","new-password","current-password","one-time-code","email","organization","street-address","address-line1","address-line2","address-level2","address-level1","postal-code","country","country-name","bday","sex","tel","tel-national","url","photo","cc-name","cc-number","cc-exp","cc-csc","transaction-currency","transaction-amount"],
  inputmode:["none","text","decimal","numeric","tel","search","email","url"],
  enterkeyhint:["enter","done","go","next","previous","search","send"],
  referrerpolicy:["no-referrer","no-referrer-when-downgrade","origin","origin-when-cross-origin","same-origin","strict-origin","strict-origin-when-cross-origin","unsafe-url"],
  rel:["noopener","noreferrer","nofollow","author","license","tag","bookmark","stylesheet","icon","shortcut icon","preconnect","dns-prefetch","preload","modulepreload","canonical","manifest","alternate","search","help","next","prev","apple-touch-icon","mask-icon","webmention"],
  as:["fetch","style","script","font","image","audio","video","track","document","embed","object","worker","sharedworker"],
  accept:["image/*","audio/*","video/*",".pdf",".png",".jpg",".jpeg",".gif",".svg",".webp",".zip",".doc",".docx",".txt","text/plain","application/pdf"],
  scope:["col","row","colgroup","rowgroup"],
  shape:["rect","circle","poly","default"],
  wrap:["soft","hard"],
  kind:["subtitles","captions","descriptions","chapters","metadata"],
  fetchpriority:["high","low","auto"],
  preload:["none","metadata","auto"],
  "meta.name":["viewport","description","keywords","author","generator","theme-color","color-scheme","format-detection","robots","application-name","referrer","renderer","mobile-web-app-capable","apple-mobile-web-app-capable","apple-mobile-web-app-status-bar-style","apple-mobile-web-app-title"],
  "meta.http-equiv":["refresh","content-type","content-security-policy","x-ua-compatible","cache-control","default-style"],
  "meta.property":["og:title","og:description","og:image","og:url","og:type","og:site_name","og:locale","twitter:card","twitter:title","twitter:description","twitter:image","article:published_time","music:song","product:price:amount"],
  "link.rel":["stylesheet","icon","shortcut icon","apple-touch-icon","manifest","canonical","alternate","author","search","preconnect","dns-prefetch","preload","modulepreload","next","prev","help","sitemap","license"],
  "a.rel":["noopener","noreferrer","nofollow","author","license","tag","bookmark","me"],
  "area.rel":["noopener","noreferrer","nofollow"],
  crossorigin:["anonymous","use-credentials"],
  "iframe.sandbox":["allow-scripts","allow-same-origin","allow-forms","allow-popups","allow-modals","allow-downloads","allow-pointer-lock","allow-top-navigation","allow-presentation","allow-orientation-lock"]
};

var CSS_PROPS = [
  "display","position","top","right","bottom","left","inset","z-index","float","clear","overflow","overflow-x","overflow-y","overscroll-behavior","visibility","opacity",
  "box-sizing","width","min-width","max-width","height","min-height","max-height","aspect-ratio","margin","margin-top","margin-right","margin-bottom","margin-left","margin-inline","margin-block",
  "padding","padding-top","padding-right","padding-bottom","padding-left","padding-inline","padding-block","border","border-width","border-style","border-color","border-radius","border-top","border-right","border-bottom","border-left","border-top-left-radius","border-top-right-radius","border-bottom-left-radius","border-bottom-right-radius","border-image","outline","outline-offset","outline-color",
  "background","background-color","background-image","background-size","background-position","background-repeat","background-attachment","background-origin","background-clip","background-blend-mode",
  "color","font","font-family","font-size","font-weight","font-style","font-variant","font-stretch","font-optical-sizing","line-height","letter-spacing","word-spacing","text-align","text-transform","text-decoration","text-decoration-color","text-decoration-thickness","text-underline-offset","text-indent","white-space","word-break","overflow-wrap","text-overflow","word-wrap","text-shadow","vertical-align","writing-mode","tab-size","hyphens",
  "list-style","list-style-type","list-style-position","list-style-image","content","counter-reset","counter-increment","quotes",
  "cursor","user-select","pointer-events","touch-action","resize","caret-color","accent-color","appearance",
  "transition","transition-property","transition-duration","transition-timing-function","transition-delay","animation","animation-name","animation-duration","animation-timing-function","animation-delay","animation-iteration-count","animation-direction","animation-fill-mode","animation-play-state",
  "transform","transform-origin","transform-style","perspective","perspective-origin","backface-visibility","rotate","scale","translate","filter","backdrop-filter","mix-blend-mode","isolation","clip-path","mask","mask-image",
  "box-shadow","object-fit","object-position","object-view-box",
  "grid","grid-template","grid-template-columns","grid-template-rows","grid-template-areas","grid-auto-columns","grid-auto-rows","grid-auto-flow","grid-column","grid-row","grid-area","grid-gap",
  "flex","flex-direction","flex-wrap","flex-flow","flex-grow","flex-shrink","flex-basis","order",
  "justify-content","justify-items","justify-self","align-content","align-items","align-self","place-content","place-items","place-self",
  "gap","row-gap","column-gap",
  "columns","column-count","column-width","column-gap","column-span","break-inside","break-before","break-after","orphans","widows",
  "fill","stroke","stroke-width","stroke-linecap","stroke-linejoin","stroke-dasharray",
  "scroll-behavior","scroll-snap-type","scroll-snap-align","scroll-snap-stop","scrollbar-width","scrollbar-color",
  "color-scheme","accent-color","forced-color-adjust","print-color-adjust"
];

var CSS_VALUES = {
  display:["block","inline","inline-block","flex","inline-flex","grid","inline-grid","none","contents","flow-root","table","inline-table","list-item"],
  position:["static","relative","absolute","fixed","sticky"],
  overflow:["visible","hidden","auto","scroll","clip"],
  "overflow-x":["visible","hidden","auto","scroll","clip"],
  "overflow-y":["visible","hidden","auto","scroll","clip"],
  visibility:["visible","hidden","collapse"],
  float:["left","right","none","inline-start","inline-end"],
  clear:["left","right","both","none","inline-start","inline-end"],
  "box-sizing":["border-box","content-box"],
  "flex-direction":["row","row-reverse","column","column-reverse"],
  "flex-wrap":["nowrap","wrap","wrap-reverse"],
  "flex-flow":["row nowrap","row wrap","column nowrap","column wrap"],
  "grid-auto-flow":["row","column","dense","row dense","column dense"],
  "justify-content":["flex-start","flex-end","center","space-between","space-around","space-evenly","stretch","start","end","normal"],
  "align-content":["flex-start","flex-end","center","space-between","space-around","space-evenly","stretch","start","end","normal","baseline"],
  "justify-items":["stretch","start","end","center","baseline"],
  "align-items":["stretch","flex-start","flex-end","center","baseline","start","end"],
  "align-self":["auto","stretch","flex-start","flex-end","center","baseline","start","end"],
  "justify-self":["auto","stretch","start","end","center","baseline"],
  "place-items":["center","stretch","start","end","baseline flex-start","center center"],
  "place-content":["center","space-between","space-around","space-evenly","stretch","start","end"],
  cursor:["pointer","default","text","move","grab","grabbing","not-allowed","wait","crosshair","zoom-in","zoom-out","help","none","alias","cell","copy","context-menu","progress","vertical-text","col-resize","row-resize","ew-resize","ns-resize"],
  "white-space":["normal","nowrap","pre","pre-wrap","pre-line","break-spaces"],
  "text-transform":["none","uppercase","lowercase","capitalize","full-width"],
  "text-decoration":["none","underline","line-through","overline"],
  "text-align":["left","right","center","justify","start","end"],
  "text-overflow":["ellipsis","clip"],
  "vertical-align":["baseline","middle","top","bottom","text-top","text-bottom","sub","super"],
  "object-fit":["cover","contain","fill","none","scale-down"],
  "object-position":["center","top","bottom","left","right","50% 50%","top left","top right","bottom left","bottom right"],
  "pointer-events":["auto","none"],
  "user-select":["auto","none","text","all"],
  "appearance":["none","auto","textfield","button","menulist-button"],
  "background-size":["cover","contain","auto","100% 100%"],
  "background-position":["center","top","bottom","left","right","50% 50%","top left","top right","bottom left","bottom right"],
  "background-repeat":["no-repeat","repeat","repeat-x","repeat-y","space","round"],
  "background-attachment":["scroll","fixed","local"],
  "font-style":["normal","italic","oblique"],
  "font-weight":["normal","bold","bolder","lighter","100","200","300","400","500","600","700","800","900"],
  "font-variant":["normal","small-caps"],
  "font-stretch":["normal","condensed","expanded","semi-condensed","semi-expanded","extra-condensed","extra-expanded","ultra-condensed","ultra-expanded"],
  "border-style":["none","hidden","solid","dashed","dotted","double","groove","ridge","inset","outset"],
  "text-decoration-style":["solid","double","dotted","dashed","wavy"],
  "transform-origin":["center","top","bottom","left","right","50% 50%","top left","top right","bottom left","bottom right"],
  "animation-timing-function":["ease","ease-in","ease-out","ease-in-out","linear","cubic-bezier(0.4, 0, 0.2, 1)","steps(4)"],
  "transition-timing-function":["ease","ease-in","ease-out","ease-in-out","linear","cubic-bezier(0.4, 0, 0.2, 1)","cubic-bezier(0.2, 1.15, 0.32, 1.08)"],
  "animation-fill-mode":["none","forwards","backwards","both"],
  "animation-direction":["normal","reverse","alternate","alternate-reverse"],
  "animation-iteration-count":["1","2","3","infinite"],
  "animation-play-state":["running","paused"],
  "mix-blend-mode":["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity","plus-lighter"],
  "background-blend-mode":["normal","multiply","screen","overlay","darken","lighten","color-dodge","hard-light","soft-light","difference"],
  "break-inside":["auto","avoid","avoid-page","avoid-column"],
  "list-style-type":["disc","circle","square","decimal","decimal-leading-zero","lower-alpha","upper-alpha","lower-roman","upper-roman","none"],
  "hyphens":["none","manual","auto"],
  "writing-mode":["horizontal-tb","vertical-rl","vertical-lr"],
  "word-break":["normal","break-all","keep-all","break-word"],
  "overflow-wrap":["normal","break-word","anywhere"],
  "isolation":["auto","isolate"],
  "scroll-behavior":["auto","smooth"],
  "scroll-snap-type":["x mandatory","y mandatory","x proximity","y proximity","both mandatory","none"],
  "scroll-snap-align":["start","center","end"],
  "touch-action":["auto","none","pan-x","pan-y","pan-left","pan-right","pan-up","pan-down","manipulation","pinch-zoom"],
  "overscroll-behavior":["auto","contain","none"],
  "object-position ":["center"],
  "stroke-linecap":["butt","round","square"],
  "stroke-linejoin":["miter","round","bevel"],
  "text-wrap":["wrap","nowrap","balance","pretty","stable"]
};

var JS_MEMBERS = [
  "addEventListener","removeEventListener","dispatchEvent","querySelector","querySelectorAll","getElementById","getElementsByClassName","getElementsByTagName","getElementsByName","createElement","createTextNode","createDocumentFragment","appendChild","removeChild","insertBefore","replaceChild","closest","matches","contains","dataset","innerHTML","outerHTML","textContent","innerText","classList","className","id","style","value","checked","disabled","hidden","tagName","parentNode","parentElement","children","firstChild","lastChild","nextSibling","previousSibling","nextElementSibling","previousElementSibling","offsetHeight","offsetWidth","clientHeight","clientWidth","scrollHeight","scrollWidth","scrollTop","scrollLeft","getBoundingClientRect","getAttribute","setAttribute","removeAttribute","hasAttribute","focus","blur","click","submit","reset","select","setSelectionRange","setPointerCapture","requestAnimationFrame","cancelAnimationFrame","setTimeout","clearTimeout","setInterval","clearInterval","queueMicrotask","fetch","FormData","URLSearchParams","URL","Blob","FileReader","localStorage","sessionStorage","navigator","location","history","performance","console","document","window","innerWidth","innerHeight","devicePixelRatio","screen","matchMedia","getComputedStyle","requestIdleCallback","structuredClone","crypto","Intl","ResizeObserver","MutationObserver","IntersectionObserver","customElements","ShadowRoot","template","import","importScripts","open","close","alert","confirm","prompt","postMessage","onload","onclick","onsubmit","oninput","onchange","onkeydown","onkeyup","onmousemove","preventDefault","stopPropagation","stopImmediatePropagation","target","currentTarget","key","keyCode","clientX","clientY","pageX","pageY","button","altKey","ctrlKey","metaKey","shiftKey","composedPath","detail","deltaY","touches","changedTouches","clipboardData","dataTransfer","files","length",
  "parse","stringify","keys","values","entries","assign","freeze","from","isArray","of","fromEntries","getItem","setItem","removeItem","clear","all","race","allSettled","resolve","reject","then","catch","finally","now","random","floor","ceil","round","trunc","sign","abs","max","min","pow","sqrt","sin","cos","tan","atan2","PI","E","log","warn","error","info","debug","table","group","groupEnd","time","timeEnd","count","trace","dir","assert","clear",
  "push","pop","shift","unshift","slice","splice","concat","join","map","filter","reduce","reduceRight","forEach","find","findIndex","some","every","includes","indexOf","lastIndexOf","sort","reverse","flat","flatMap","fill","copyWithin",
  "split","trim","trimStart","trimEnd","replace","replaceAll","toLowerCase","toUpperCase","toString","toFixed","padStart","padEnd","startsWith","endsWith","repeat","charAt","charCodeAt","codePointAt","normalize","localeCompare"
];

var JS_KEYWORDS = ["const","let","var","function","return","if","else","for","of","in","while","do","switch","case","default","break","continue","try","catch","finally","throw","new","typeof","instanceof","class","extends","super","import","export","from","as","default","async","await","yield","static","get","set","true","false","null","undefined","this","void","delete","in","of"];

var CSS_KEYWORDS = ["important","inherit","initial","unset","revert","auto","none","normal","currentColor","transparent","inherit","initial","unset"];

/* ─────────────── document word index (cached) ─────────────── */
var wordCache = { key: "", words: [] };
function documentWords(text) {
  var key = text.length + ":" + text.slice(0, 120) + ":" + text.slice(-120);
  if (wordCache.key === key) return wordCache.words;
  var seen = Object.create(null), words = [];
  var re = /[A-Za-z_$][\w$-]{2,}/g, m;
  while ((m = re.exec(text))) {
    if (!seen[m[0]]) { seen[m[0]] = 1; words.push(m[0]); if (words.length > 3000) break; }
  }
  wordCache = { key: key, words: words };
  return words;
}

/* ─────────────── context detection ─────────────── */

function contextOf(cm) {
  var cur = cm.getCursor();
  var upto = cm.getRange({ line: 0, ch: 0 }, cur);
  var line = cm.getLine(cur.line);
  var lineBefore = line.slice(0, cur.ch);

  // comments?
  var cOpen = upto.lastIndexOf("<!--"), cClose = upto.lastIndexOf("-->");
  if (cOpen > cClose) return { area: "comment", lineBefore: lineBefore, cur: cur };

  // style/script regions?
  var styleOpen = upto.lastIndexOf("<style"), styleClose = upto.lastIndexOf("</style");
  var scriptOpen = upto.lastIndexOf("<script"), scriptClose = upto.lastIndexOf("</script");
  var inStyle = styleOpen > styleClose;
  var inScript = scriptOpen > scriptClose;

  // inside a tag?
  var lt = upto.lastIndexOf("<"), gt = upto.lastIndexOf(">");
  if (lt > gt && !inStyle && !inScript) {
    var inside = upto.slice(lt);
    var closeM = /^<\/\s*([\w-]*)$/.exec(inside);
    if (closeM) return { area: "html-close", prefix: closeM[1] || "", lineBefore: lineBefore, cur: cur, upto: upto };
    var openM = /^<([\w-]*)/.exec(inside);
    if (openM) {
      var tag = openM[1];
      var rest = inside.slice(openM[0].length);
      // attribute value context? last unmatched quote in rest
      var q = -1, quote = null;
      for (var i = 0; i < rest.length; i++) {
        var ch = rest[i];
        if (quote) { if (ch === quote) { quote = null; q = -1; } }
        else if (ch === '"' || ch === "'") { quote = ch; q = i; }
      }
      if (quote) {
        var beforeQuote = rest.slice(0, q);
        var attrM = /([\w-]+)\s*=\s*$/.exec(beforeQuote);
        return { area: "html-attr-value", tag: tag.toLowerCase(), attr: attrM ? attrM[1].toLowerCase() : "", prefix: rest.slice(q + 1), lineBefore: lineBefore, cur: cur, upto: upto };
      }
      var attrNameM = /([\w-]*)$/.exec(rest);
      var attrName = attrNameM ? attrNameM[1] : "";
      // are we right after a bare value (e.g. type=email )? then empty attr prefix
      var endsWithValue = /=\s*[\w-]+\s*$/.test(rest);
      if (endsWithValue) attrName = "";
      return { area: "html-attr", tag: tag.toLowerCase(), prefix: endsWithValue ? "" : attrName, lineBefore: lineBefore, cur: cur, upto: upto };
    }
    return { area: "html-tag", prefix: "", lineBefore: lineBefore, cur: cur, upto: upto };
  }

  if (inStyle) return { area: "css", lineBefore: lineBefore, cur: cur, upto: upto };
  if (inScript) return { area: "js", lineBefore: lineBefore, cur: cur, upto: upto };
  return { area: "html-text", lineBefore: lineBefore, cur: cur, upto: upto };
}

/** Open-tag stack for </ completion (best-effort, ignores script/style contents) */
function openTagStack(upto) {
  // strip script/style bodies so comparisons don't confuse the stack
  var cleaned = upto.replace(/<script[\s\S]*?(<\/script>|$)/gi, "").replace(/<style[\s\S]*?(<\/style>|$)/gi, "").replace(/<!--[\s\S]*?(-->|$)/g, "");
  var VOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, param:1, source:1, track:1, wbr:1 };
  var stack = [];
  var re = /<(\/)?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, m;
  while ((m = re.exec(cleaned))) {
    var isClose = !!m[1], tag = m[2].toLowerCase();
    var selfClose = /\/\s*$/.test(m[3] || "");
    if (isClose) {
      for (var i = stack.length - 1; i >= 0; i--) if (stack[i] === tag) { stack.splice(i, 1); break; }
    } else if (!VOID[tag] && !selfClose && tag !== "!doctype") {
      stack.push(tag);
    }
  }
  return stack;
}

/* ─────────────── hint construction ─────────────── */

function kindDot(kind) { return kind; }

function makeHint(text, kind, detail, insert) {
  return {
    text: text,
    displayText: text,
    kind: kind,
    detail: detail || "",
    className: "hint-item",
    render: function (el) {
      el.innerHTML = "";
      var dot = document.createElement("span");
      dot.className = "hint-swatch hint-kind-" + kind;
      var label = document.createElement("span");
      label.className = "hint-text";
      label.textContent = text;
      el.appendChild(dot); el.appendChild(label);
      if (detail) {
        var d = document.createElement("span");
        d.className = "hint-detail";
        d.textContent = detail;
        el.appendChild(d);
      }
      var k = document.createElement("span");
      k.className = "hint-kind";
      k.textContent = kindLabel(kind);
      el.appendChild(k);
    },
    hint: function (cm, self, data) {
      var from = data.from, to = data.to;
      var after = cm.getLine(to.line).slice(to.ch);
      var out = insert ? insert.text : text;
      var caretOffset = insert && insert.caretOffset != null ? insert.caretOffset : out.length;
      // avoid doubling an existing closing quote/paren right after the caret
      if (out.endsWith('"') && after.charAt(0) === '"') { out = out.slice(0, -1); caretOffset = Math.min(caretOffset, out.length); }
      cm.replaceRange(out, from, to, "complete");
      cm.setCursor({ line: from.line, ch: from.ch + caretOffset });
    }
  };
}
function kindLabel(kind) {
  return { tag: "tag", attr: "attr", value: "value", prop: "css", cssvar: "var", member: "js", keyword: "js", word: "text" }[kind] || kind;
}

function prefixScore(prefix, text) {
  if (!prefix) return 1;
  var p = prefix.toLowerCase(), t = text.toLowerCase();
  if (t === p) return 100;
  if (t.indexOf(p) === 0) return 80 - (t.length - p.length) * 0.5;
  var idx = t.indexOf(p);
  if (idx > 0) return 40 - idx;
  // subsequence
  var ti = 0, score = 0, streak = 0;
  for (var pi = 0; pi < p.length; pi++) {
    var found = t.indexOf(p[pi], ti);
    if (found === -1) return -1;
    streak = found === ti ? streak + 1 : 0;
    score += 1 + streak * 2;
    ti = found + 1;
  }
  return Math.min(30, score);
}
function rank(prefix, items) {
  var scored = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var s = prefixScore(prefix, item.text);
    if (s >= 0) scored.push({ item: item, s: s });
  }
  scored.sort(function (a, b) { return b.s - a.s || a.item.text.length - b.item.text.length || (a.item.text < b.item.text ? -1 : 1); });
  return scored.slice(0, 40).map(function (x) { return x.item; });
}

/** Insert attr as name="" with caret inside quotes (skips eq for bare/boolean) */
function attrInsert(name) {
  var BARE = /^(required|disabled|checked|multiple|readonly|hidden|novalidate|reversed|open|autoplay|controls|loop|muted|default|playsinline|allowfullscreen|async|defer|nomodule|draggable)$/;
  if (BARE.test(name)) return { text: name, caretOffset: name.length };
  return { text: name + '=""', caretOffset: name.length + 2 };
}

/** The single entry point used by CodeMirror's show-hint addon */
function draftHints(cm) {
  var cur = cm.getCursor();
  var ctx = contextOf(cm);
  var list = [], from, to, mode = ctx.area;

  function wordToken() {
    var line = cm.getLine(cur.line);
    var m = /[\w-]*$/.exec(line.slice(0, cur.ch));
    var start = cur.ch - (m ? m[0].length : 0);
    return { from: { line: cur.line, ch: start }, to: { line: cur.line, ch: cur.ch }, prefix: m ? m[0] : "" };
  }

  if (ctx.area === "html-tag") {
    var tok = wordToken();
    var tags = [];
    var seenTag = {};
    for (var i = 0; i < HTML_TAGS.length; i++) {
      var t = HTML_TAGS[i][0];
      if (seenTag[t]) continue; seenTag[t] = 1;
      tags.push(makeHint(t, "tag", HTML_TAGS[i][1]));
    }
    list = rank(tok.prefix, tags);
    return { list: list, from: tok.from, to: tok.to };
  }

  if (ctx.area === "html-close") {
    var tokC = { from: { line: cur.line, ch: cur.ch - ctx.prefix.length }, to: cur, prefix: ctx.prefix };
    var stack = openTagStack(ctx.upto || cm.getRange({ line: 0, ch: 0 }, cur));
    var closeList = [];
    for (var s = stack.length - 1; s >= 0; s--) closeList.push(makeHint(stack[s], "tag", "close tag"));
    if (!closeList.length) closeList = HTML_TAGS.slice(0, 24).map(function (t) { return makeHint(t[0], "tag", t[1]); });
    list = rank(tokC.prefix, closeList);
    return { list: list, from: tokC.from, to: tokC.to };
  }

  if (ctx.area === "html-attr") {
    var tokA = { from: { line: cur.line, ch: cur.ch - ctx.prefix.length }, to: cur, prefix: ctx.prefix };
    var names = [];
    var used = {};
    var reUsed = /([\w-]+)(?==|\s|$|\/)/g, mu;
    var upto = ctx.upto || cm.getRange({ line: 0, ch: 0 }, cur);
    var tagStart = upto.lastIndexOf("<");
    var tagText = upto.slice(tagStart);
    while ((mu = reUsed.exec(tagText.slice(0, tagText.length - ctx.prefix.length)))) used[mu[1].toLowerCase()] = 1;
    var seen = {};
    function pushAttr(name) {
      if (seen[name] || used[name.toLowerCase()]) return;
      seen[name] = 1;
      var hasValues = !!(ATTR_VALUES[name] || ATTR_VALUES[ctx.tag + "." + name]);
      names.push(makeHint(name, "attr", hasValues ? "attribute · has values" : "attribute", attrInsert(name)));
    }
    var specific = ATTRS_BY_TAG[ctx.tag] || [];
    for (var a = 0; a < specific.length; a++) pushAttr(specific[a]);
    for (var g = 0; g < GLOBAL_ATTRS.length; g++) pushAttr(GLOBAL_ATTRS[g]);
    list = rank(tokA.prefix, names);
    return { list: list, from: tokA.from, to: tokA.to };
  }

  if (ctx.area === "html-attr-value") {
    var tokV = { from: { line: cur.line, ch: cur.ch - ctx.prefix.length }, to: cur, prefix: ctx.prefix };
    var values = ATTR_VALUES[ctx.tag + "." + ctx.attr] || ATTR_VALUES[ctx.attr] || [];
    list = rank(tokV.prefix, values.map(function (v) { return makeHint(v, "value", "attribute value"); }));
    return { list: list, from: tokV.from, to: tokV.to };
  }

  if (ctx.area === "css") {
    var tokCss = wordToken();
    var uptoCss = ctx.upto || cm.getRange({ line: 0, ch: 0 }, cur);
    var before = uptoCss;
    // value position? (after "prop:" on this rule chunk)
    var chunk = before.slice(Math.max(before.lastIndexOf("{"), before.lastIndexOf(";") > -1 ? before.lastIndexOf(";") : 0));
    var propM = /([\w-]+)\s*:\s*[\w#().,%\- ]*$/.exec(chunk);
    if (propM) {
      var prop = propM[1].toLowerCase();
      var vals = CSS_VALUES[prop] || [];
      list = rank(tokCss.prefix, vals.map(function (v) { return makeHint(v, "value", prop); }));
      return { list: list, from: tokCss.from, to: tokCss.to };
    }
    var props = CSS_PROPS.map(function (p) { return makeHint(p, "prop", "css property"); });
    var cssVars = [];
    var varRe = /--([\w-]+)\s*:/g, mv;
    while ((mv = varRe.exec(before))) { cssVars.push(makeHint("var(--" + mv[1] + ")", "cssvar", "custom property")); cssVars.push(makeHint("--" + mv[1], "cssvar", "custom property")); }
    list = rank(tokCss.prefix, props.concat(cssVars, CSS_KEYWORDS.map(function (k) { return makeHint(k, "keyword", "keyword"); })));
    return { list: list, from: tokCss.from, to: tokCss.to };
  }

  if (ctx.area === "js") {
    var tokJs = wordToken();
    var uptoJs = ctx.upto || cm.getRange({ line: 0, ch: 0 }, cur);
    var members = JS_MEMBERS.map(function (m2) { return makeHint(m2, "member", "js / dom"); });
    var keywords = JS_KEYWORDS.map(function (k) { return makeHint(k, "keyword", "keyword"); });
    var words = documentWords(uptoJs).filter(function (w) { return !/^\d/.test(w); }).map(function (w) { return makeHint(w, "word", "from document"); });
    list = rank(tokJs.prefix, members.concat(keywords, words));
    return { list: list, from: tokJs.from, to: tokJs.to };
  }

  // html-text: offer document words + tags caught mid-typing? Only words; tags come via "<"
  var tokT = wordToken();
  if (!tokT.prefix) return { list: [], from: tokT.from, to: tokT.to };
  var uptoT = ctx.upto || cm.getRange({ line: 0, ch: 0 }, cur);
  var docWords = documentWords(uptoT).map(function (w) { return makeHint(w, "word", "from document"); });
  list = rank(tokT.prefix, docWords);
  return { list: list, from: tokT.from, to: tokT.to };
}

global.DraftHints = {
  hint: draftHints,
  contextOf: contextOf,
  openTagStack: openTagStack,
  documentWords: documentWords
};

})(typeof window !== "undefined" ? window : this);
