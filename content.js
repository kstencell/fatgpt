// content.js — FatGPT
const STYLE_ID = "fatgpt-style";
const DEFAULT_PX = 768; // used when enabling from native via shortcuts
const MIN_PX = 600;
const MAX_PX = 5000; // global upper bound; real cap comes from the page
const STEP_PX = 100;
const EPS = 4; // px tolerance for floating rounding
const RESERVED_UI_PX = 400; // space for model bar + buttons (tweak as you like)

let currentWidth = null; // null = native (no override)
let effectiveCapPx = null; // inner cap we actually clamp to
let effectiveOuterCapPx = null; // optional debugging/info

const cssFor = (px) => `
  :root { --fatgpt-max-width: ${px}px; }

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

  main [style*="max-width"] {
    max-width: var(--fatgpt-max-width) !important;
  }
`;

// Create/update style, or remove it entirely when px === null
function ensureStyle(px) {
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

async function applyFromStorage() {
  const { chatMaxWidthPx = null } = await browser.storage.local.get(
    "chatMaxWidthPx"
  );
  currentWidth =
    chatMaxWidthPx == null ? null : Number(chatMaxWidthPx) || DEFAULT_PX;
  ensureStyle(currentWidth);
  //   console.log(
  //     `[FatGPT] mode: ${
  //       currentWidth == null ? "native" : `override ${currentWidth}px`
  //     }`
  //   );
}

function watchForDomChurn() {
  const mo = new MutationObserver(() => ensureStyle(currentWidth));
  mo.observe(document.documentElement, { childList: true, subtree: true });

  const _pushState = history.pushState;
  history.pushState = function () {
    const r = _pushState.apply(this, arguments);
    ensureStyle(currentWidth);
    return r;
  };
  window.addEventListener("popstate", () => ensureStyle(currentWidth));
}

// Save + apply. Pass null to return to native mode.
async function setAndSave(pxOrNull) {
  const n =
    pxOrNull == null
      ? null
      : Math.min(MAX_PX, Math.max(MIN_PX, Number(pxOrNull) || DEFAULT_PX));
  await browser.storage.local.set({ chatMaxWidthPx: n });
  currentWidth = n;
  ensureStyle(n);
  //   console.log(`[FatGPT] set: ${n == null ? "native" : `${n}px`}`);
}

// Ignore when typing in fields
function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || el.isContentEditable)
    return true;
  const role = el.getAttribute && el.getAttribute("role");
  return role === "textbox";
}

// Shortcuts: Alt+[ (−STEP), Alt+] (+STEP), Alt+0 (native reset)
window.addEventListener("keydown", (e) => {
  if (isTypingTarget(document.activeElement)) return;
  if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;

  if (e.key === "[") {
    e.preventDefault();
    const base = currentWidth == null ? DEFAULT_PX : currentWidth;
    setAndSave(base - STEP_PX);
  } else if (e.key === "]") {
    e.preventDefault();
    const base = currentWidth == null ? DEFAULT_PX : currentWidth;
    setAndSave(base + STEP_PX);
  } else if (e.key === "0") {
    e.preventDefault();
    setAndSave(null); // truly native: remove our CSS
  }
});

// Live update when popup saves
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "chatMaxWidthPx" in changes) {
    const v = changes.chatMaxWidthPx.newValue;
    currentWidth = v == null ? null : Number(v) || DEFAULT_PX;
    ensureStyle(currentWidth);
    // console.log(
    //   `[FatGPT] changed: ${
    //     currentWidth == null ? "native" : `${currentWidth}px`
    //   }`
    // );
  }
});

function pickCapContainer() {
  // Use a full-width container, NOT the clamped max-w column
  return (
    document.querySelector("main") ||
    document.getElementById("__next") ||
    document.documentElement
  );
}

// Compute caps based on the full-width container. We use 'functionalCapPx' for clamping.
function computeCaps() {
  const el = pickCapContainer();
  const rectW = Math.floor(el.getBoundingClientRect().width || 0);
  const cs = getComputedStyle(el);
  const padX =
    (parseFloat(cs.paddingLeft || "0") || 0) +
    (parseFloat(cs.paddingRight || "0") || 0);

  const inner = Math.max(0, Math.floor(el.clientWidth - padX)); // inner content box

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
    if (currentWidth != null && currentWidth > effectiveCapPx + EPS) {
      currentWidth = effectiveCapPx;
      ensureStyle(currentWidth);
      browser.storage.local.set({ chatMaxWidthPx: currentWidth });
      //   console.log(
      //     `[FatGPT] snapped to functional cap: ${currentWidth}px (outer=${outerCapPx})`
      //   );
    }
  }
}

// Call this early and keep it fresh
refreshEffectiveCap();
window.addEventListener("resize", () => refreshEffectiveCap());

// In your MutationObserver callback (where you already re-ensure style), also update the cap:
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

// Save + apply. Pass null to go native.
// ⬇️ clamp to the live cap so values never drift past what’s visible.
async function setAndSave(pxOrNull) {
  let n = null;
  if (pxOrNull == null) {
    n = null; // native
  } else {
    const cap = effectiveCapPx ?? computeCaps().functionalCapPx;
    n = Math.min(cap, Math.max(MIN_PX, Number(pxOrNull) || DEFAULT_PX));
  }
  await browser.storage.local.set({ chatMaxWidthPx: n });
  currentWidth = n;
  ensureStyle(n);
  //   console.log(
  //     `[FatGPT] set: ${
  //       n == null ? "native" : `${n}px`
  //     } (innerCap=${effectiveCapPx}, outerCap=${effectiveOuterCapPx})`
  //   );
}

// Live update from popup: also clamp to cap before applying
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "chatMaxWidthPx" in changes) {
    const v = changes.chatMaxWidthPx.newValue;
    if (v == null) {
      currentWidth = null;
      ensureStyle(null);
    } else {
      const cap = effectiveCapPx ?? computeCaps().functionalCapPx;
      currentWidth = Math.min(cap, Math.max(MIN_PX, Number(v) || DEFAULT_PX));
      ensureStyle(currentWidth);
    }
    // console.log(
    //   `[FatGPT] changed → ${
    //     currentWidth == null ? "native" : `${currentWidth}px`
    //   } (cap=${effectiveCapPx})`
    // );
  }
});

// Respond to popup with the current cap and mode
browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "fatgpt:get-cap") {
    const { outerCapPx, innerCapPx, functionalCapPx } = computeCaps();
    return Promise.resolve({
      capPx: functionalCapPx, // popup uses this as slider max
      innerCapPx,
      outerCapPx,
      native: currentWidth == null,
      currentWidth,
    });
  }
});

// Boot
applyFromStorage().then(watchForDomChurn);
// console.log("[FatGPT] content script loaded at:", location.href);
