// ---- PERF DEBUG ----
const FG_PERF = {
  ensureStyleCalls: 0,
  computeCapsCalls: 0,
  storageWrites: 0,
  storageOnChanged: 0,
  messagesCmd: 0,
  messagesGetCap: 0,
};
setInterval(() => {
  // 2s snapshot
  const s = FG_PERF;
  console.log(
    "[FatGPT:perf/2s]",
    "ensureStyle:",
    s.ensureStyleCalls,
    "computeCaps:",
    s.computeCapsCalls,
    "writes:",
    s.storageWrites,
    "onChanged:",
    s.storageOnChanged,
    "msgCmd:",
    s.messagesCmd,
    "msgGetCap:",
    s.messagesGetCap
  );
  // reset counters
  FG_PERF.ensureStyleCalls = 0;
  FG_PERF.computeCapsCalls = 0;
  FG_PERF.storageWrites = 0;
  FG_PERF.storageOnChanged = 0;
  FG_PERF.messagesCmd = 0;
  FG_PERF.messagesGetCap = 0;
}, 2000);

// Multi-browser support
if (typeof browser === "undefined") {
  var browser = chrome;
}

// ---- constants ----
const STYLE_ID = "fatgpt-style";
const DEFAULT_PX = 768; // used when enabling from native via shortcuts
const MIN_PX = 600;
const MAX_PX = 5000; // global upper bound; real cap comes from the page
const STEP_PX = 100;
const EPS = 4; // px tolerance for rounding/jitter when capping
const RESERVED_UI_PX = 400; // space for model bar / buttons (tweak to taste)

// ---- state ----
let currentWidth = null; // null = native (no override)
let effectiveCapPx = null; // functional inner cap we clamp to
let effectiveOuterCapPx = null; // debug/info only

// ---- user-shortcut bindings (layout-agnostic via KeyboardEvent.code) ----
const DEFAULT_BINDINGS = {
  wider: { alt: true, ctrl: false, meta: false, shift: false, code: "Period" },
  narrower: {
    alt: true,
    ctrl: false,
    meta: false,
    shift: false,
    code: "Comma",
  },
  native: { alt: true, ctrl: false, meta: false, shift: false, code: "Digit0" },
};
let bindings = { ...DEFAULT_BINDINGS };

// =====================
// helpers
// =====================

function sameBinding(e, b) {
  return (
    !!b &&
    e.code === b.code &&
    e.altKey === !!b.alt &&
    e.ctrlKey === !!b.ctrl &&
    e.metaKey === !!b.meta &&
    e.shiftKey === !!b.shift
  );
}

function isEditable(el) {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    el.isContentEditable ||
    (el.getAttribute && el.getAttribute("role") === "textbox")
  );
}

// Inject/replace our CSS, or remove it entirely in native mode
function ensureStyle(px) {
  FG_PERF.ensureStyleCalls++;
  const existing = document.getElementById(STYLE_ID);
  if (px == null) {
    if (existing) existing.remove();
    return;
  }
  let el = existing;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.documentElement.appendChild(el);
  }
  el.textContent = cssFor(px);
}

const cssFor = (px) => `
  :root { --fatgpt-max-width: ${px}px; }

  /* Override common Tailwind max-w clamps inside the main app container */
  main .mx-auto[class*="max-w-"],
  main [class*="max-w-"][class*="mx-auto"],
  main [data-testid="conversation-turns"] > div[class*="max-w-"],
  main [data-testid="chat-scroll-container"] > div[class*="max-w-"],
  main [class*="prose"][class*="max-w-"],
  main [class*="max-w-"][class*="px-"] {
    max-width: var(--fatgpt-max-width) !important;
    width: 100% !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  /* Soften any incidental inline max-width caps */
  main [style*="max-width"] {
    max-width: var(--fatgpt-max-width) !important;
  }
`;

// =====================
// storage (width + bindings)
// =====================

async function applyFromStorage() {
  const { chatMaxWidthPx = null } = await browser.storage.local.get(
    "chatMaxWidthPx"
  );
  currentWidth =
    chatMaxWidthPx == null ? null : Number(chatMaxWidthPx) || DEFAULT_PX;
  ensureStyle(currentWidth);
}

async function loadBindings() {
  const { fatgptBindings } = await browser.storage.local.get("fatgptBindings");
  bindings = { ...DEFAULT_BINDINGS, ...(fatgptBindings || {}) };
}

// React to changes from popup/other tabs
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.fatgptBindings) {
    bindings = {
      ...DEFAULT_BINDINGS,
      ...(changes.fatgptBindings.newValue || {}),
    };
  }

  if ("chatMaxWidthPx" in changes) {
    const v = changes.chatMaxWidthPx.newValue;
    if (v == null) {
      currentWidth = null;
      ensureStyle(null);
    } else {
      const cap = effectiveCapPx ?? computeCaps().functionalCapPx;
      currentWidth = Math.min(cap, Math.max(MIN_PX, Number(v) || DEFAULT_PX));
      ensureStyle(currentWidth);
    }
  }
});

// =====================
// cap computation
// =====================

function pickCapContainer() {
  // Choose a full-width container, NOT a clamped column
  return (
    document.querySelector("main") ||
    document.getElementById("__next") ||
    document.documentElement
  );
}

// Compute outer + inner content width; use a "functional" inner cap with reserved UI gutter
function computeCaps() {
  FG_PERF.computeCapsCalls++;
  const el = pickCapContainer();
  const rectW = Math.floor(el.getBoundingClientRect().width || 0);

  const cs = getComputedStyle(el);
  const padX =
    (parseFloat(cs.paddingLeft || "0") || 0) +
    (parseFloat(cs.paddingRight || "0") || 0);

  const inner = Math.max(0, Math.floor(el.clientWidth - padX));

  const outerCapPx = Math.max(MIN_PX, Math.min(rectW, MAX_PX));
  const innerCapPx = Math.max(MIN_PX, Math.min(inner, outerCapPx));
  const functionalCapPx = Math.max(
    MIN_PX,
    Math.min(innerCapPx - RESERVED_UI_PX, outerCapPx)
  );

  return { outerCapPx, innerCapPx, functionalCapPx };
}

function refreshEffectiveCap() {
  const { outerCapPx, functionalCapPx } = computeCaps();
  effectiveOuterCapPx = outerCapPx;
  const newCap = functionalCapPx;

  if (newCap !== effectiveCapPx) {
    effectiveCapPx = newCap;

    // If we're overriding and overshot the (new) cap (e.g., window got smaller), snap and persist
    if (currentWidth != null && currentWidth > effectiveCapPx + EPS) {
      currentWidth = effectiveCapPx;
      ensureStyle(currentWidth);
      browser.storage.local.set({ chatMaxWidthPx: currentWidth });
    }
  }
}

// =====================
// set + save (single source of truth)
// =====================

async function setAndSave(pxOrNull) {
  FG_PERF.storageWrites++;
  let n = null;
  if (pxOrNull == null) {
    n = null; // native mode
  } else {
    const cap = effectiveCapPx ?? computeCaps().functionalCapPx;
    n = Math.min(cap, Math.max(MIN_PX, Number(pxOrNull) || DEFAULT_PX));
  }
  await browser.storage.local.set({ chatMaxWidthPx: n });
  currentWidth = n;
  ensureStyle(n);
}

// =====================
// DOM churn + SPA nav
// =====================

function watchForDomChurn() {
  const mo = new MutationObserver(() => {
    refreshEffectiveCap();
    ensureStyle(currentWidth);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  const _pushState = history.pushState;
  history.pushState = function () {
    const r = _pushState.apply(this, arguments);
    refreshEffectiveCap();
    ensureStyle(currentWidth);
    return r;
  };
  window.addEventListener("popstate", () => {
    refreshEffectiveCap();
    ensureStyle(currentWidth);
  });
}

refreshEffectiveCap();
window.addEventListener("resize", refreshEffectiveCap);

// ===== de-dupe + unified invoker =====
let _lastInvokeAt = 0;
function invoke(cmd) {
  const now = performance.now();
  if (now - _lastInvokeAt < 60) return; // prevent double-fire (commands + keydown)
  _lastInvokeAt = now;

  const base = currentWidth == null ? DEFAULT_PX : currentWidth;
  if (cmd === "wider") setAndSave(base + STEP_PX);
  else if (cmd === "narrower") setAndSave(base - STEP_PX);
  else if (cmd === "native") setAndSave(null);
}

// =====================
// shortcuts (in-page)
// =====================

window.addEventListener("keydown", (e) => {
  if (isEditable(document.activeElement)) return;

  if (sameBinding(e, bindings.wider)) {
    e.preventDefault();
    invoke("wider");
  } else if (sameBinding(e, bindings.narrower)) {
    e.preventDefault();
    invoke("narrower");
  } else if (sameBinding(e, bindings.native)) {
    e.preventDefault();
    invoke("native");
  }
});

// ===== accept browser-managed commands from bg.js =====
browser.runtime.onMessage.addListener((msg) => {
  FG_PERF.storageOnChanged++;
  if (!msg || msg.type !== "fatgpt:cmd") {
    FG_PERF.messagesCmd++;
    return;
  }
  invoke(msg.cmd); // "wider" | "narrower" | "native"
});

// =====================
// popup messaging
// =====================

// Accept browser-managed commands and answer popup queries (Chrome/Firefox safe)
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "fatgpt:cmd") {
    // "wider" | "narrower" | "native"
    invoke(msg.cmd);
    // No response needed
    return;
  }

  if (msg.type === "fatgpt:get-cap") {
    const { outerCapPx, innerCapPx, functionalCapPx } = computeCaps();
    FG_PERF.messagesGetCap++;
    // Use callback style so it works with chrome.* and browser.* alike
    sendResponse({
      capPx: functionalCapPx, // popup slider max
      innerCapPx,
      outerCapPx,
      native: currentWidth == null,
      currentWidth,
    });
    return true; // keep channel open if the engine treats this as async
  }
});

// =====================
// boot
// =====================
Promise.all([applyFromStorage(), loadBindings()]).then(watchForDomChurn);
