// Multi-browser support
if (typeof browser === "undefined") {
  var browser = chrome;
}

// ---- DOM refs ----
const widthPx = document.getElementById("widthPx");
const slider = document.getElementById("slider");
const resetBtn = document.getElementById("reset");
const capEl = document.getElementById("capPx");
const modeEl = document.getElementById("mode");

const btnW = document.getElementById("bind-wider");
const btnN = document.getElementById("bind-narrower");
const btnR = document.getElementById("bind-native");
const resetShortcutsBtn = document.getElementById("reset-shortcuts");

// ---- Constants / state ----
const DEFAULT_PX = 768;
const MIN_PX = 600;
let capPx = 5000; // tightened by the content script
let bindingsCache = null;
const CAPTURE_TIMEOUT_MS = 6000;
let capturing = null; // "wider" | "narrower" | "native" | null

// Single source of truth for default chords (KeyboardEvent.code)
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

// =========================
// Utilities
// =========================

function setBoth(val) {
  widthPx.value = String(val);
  slider.value = String(val);
}

function setMode(native) {
  modeEl.textContent = native ? "Native" : "Override";
}

function isModifierCode(code) {
  return (
    code === "AltLeft" ||
    code === "AltRight" ||
    code === "ControlLeft" ||
    code === "ControlRight" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "MetaLeft" ||
    code === "MetaRight"
  );
}

function bindingsEqual(a, b) {
  if (!a || !b) return false;
  return (
    !!a.alt === !!b.alt &&
    !!a.ctrl === !!b.ctrl &&
    !!a.meta === !!b.meta &&
    !!a.shift === !!b.shift &&
    a.code === b.code
  );
}

// Pretty-print a binding for button labels
const IS_MAC = navigator.platform.toUpperCase().includes("MAC");

function bindingToText(b) {
  if (!b) return "Not set";

  const parts = [];
  if (b.ctrl) parts.push(IS_MAC ? "Ctrl" : "Ctrl");
  if (b.meta) parts.push(IS_MAC ? "Cmd" : "Win");
  if (b.alt) parts.push(IS_MAC ? "Option" : "Alt");
  if (b.shift) parts.push("Shift");

  const code = b.code || "";
  let key = code;
  const codeMap = {
    BracketLeft: "[",
    BracketRight: "]",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
    Period: ".",
    Comma: ",",
  };
  if (codeMap[code]) key = codeMap[code];
  else if (/^Digit([0-9])$/.test(code)) key = code.match(/^Digit([0-9])$/)[1];
  else if (/^Key([A-Z])$/.test(code)) key = code.match(/^Key([A-Z])$/)[1];
  else if (code.startsWith("Numpad")) key = code.replace("Numpad", "Num ");

  parts.push(key);
  return parts.join(" + ");
}

function setButtonLabel(btn, binding) {
  btn.textContent = bindingToText(binding);
}

function refreshAllLabels() {
  setButtonLabel(btnW, bindingsCache.wider);
  setButtonLabel(btnN, bindingsCache.narrower);
  setButtonLabel(btnR, bindingsCache.native);
}

// =========================
// Shortcuts: load + capture + reset
// =========================

async function loadBindingsUI() {
  const { fatgptBindings } = await browser.storage.local.get("fatgptBindings");
  bindingsCache = { ...DEFAULT_BINDINGS, ...(fatgptBindings || {}) };
  refreshAllLabels();
}

// Create an invisible input to keep focus in the popup during capture
function makeFocusTrap() {
  const el = document.createElement("input");
  el.type = "text";
  el.setAttribute("aria-hidden", "true");
  el.style.position = "fixed";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  el.style.width = "1px";
  el.style.height = "1px";
  document.body.appendChild(el);
  setTimeout(() => {
    el.focus({ preventScroll: true });
    try {
      el.select();
    } catch {}
  }, 0);
  return el;
}

function startCapture(which, btnEl) {
  if (capturing) return; // ignore if another capture is in flight

  capturing = which;
  const original = btnEl.textContent;
  btnEl.dataset.original = original;
  btnEl.textContent = "Press keys…";
  btnEl.setAttribute("aria-pressed", "true");

  const trap = makeFocusTrap();
  let timeoutId;

  const onKey = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      endCapture(false);
      return;
    }
    if (isModifierCode(e.code)) return; // wait for a real key

    const newBind = {
      alt: e.altKey,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      code: e.code,
    };

    // Ensure uniqueness: clear any other action that already uses this chord
    for (const k of ["wider", "narrower", "native"]) {
      if (k !== which && bindingsEqual(bindingsCache[k], newBind)) {
        bindingsCache[k] = null; // "Not set"
      }
    }

    // Save the new binding for this action
    bindingsCache[which] = newBind;
    await browser.storage.local.set({ fatgptBindings: bindingsCache });

    refreshAllLabels();
    endCapture(true);
  };

  function endCapture(committed) {
    if (!capturing) return;
    capturing = null;
    clearTimeout(timeoutId);
    window.removeEventListener("keydown", onKey, true);
    trap.remove();
    btnEl.removeAttribute("aria-pressed");
    if (!committed) {
      btnEl.textContent = btnEl.dataset.original || original;
    }
    delete btnEl.dataset.original;
  }

  window.addEventListener("keydown", onKey, true);
  timeoutId = setTimeout(() => endCapture(false), CAPTURE_TIMEOUT_MS);
}

// Use pointerdown + preventDefault to avoid synthesized keyboard activation
btnW.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  startCapture("wider", btnW);
});
btnN.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  startCapture("narrower", btnN);
});
btnR.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  startCapture("native", btnR);
});

// Reset all bindings to defaults
resetShortcutsBtn?.addEventListener("click", async () => {
  if (capturing) return; // ignore while capturing
  bindingsCache = { ...DEFAULT_BINDINGS };
  await browser.storage.local.set({ fatgptBindings: bindingsCache });
  refreshAllLabels();
});

// =========================
// Width state (query + save)
// =========================

async function queryActiveTabCap() {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    const resp = await browser.tabs.sendMessage(tab.id, {
      type: "fatgpt:get-cap",
    });
    if (resp?.capPx) {
      capPx = Math.max(MIN_PX, Math.floor(resp.capPx));
      slider.max = String(capPx);
      capEl.textContent = capPx.toString();
      setMode(resp.native);

      if (resp.native) {
        setBoth(Math.min(DEFAULT_PX, capPx));
      } else if (resp.currentWidth != null) {
        setBoth(Math.min(resp.currentWidth, capPx));
      }
    }
  } catch {
    capEl.textContent = "—";
    setMode(false);
  }
}

async function load() {
  await queryActiveTabCap();

  const { chatMaxWidthPx } = await browser.storage.local.get("chatMaxWidthPx");
  if (chatMaxWidthPx == null) {
    setBoth(Math.min(DEFAULT_PX, capPx));
    setMode(true);
  } else {
    const n = Math.min(
      capPx,
      Math.max(MIN_PX, Number(chatMaxWidthPx) || DEFAULT_PX)
    );
    setBoth(n);
    setMode(false);
  }
}

async function save(val) {
  const nNum = Math.min(capPx, Math.max(MIN_PX, Number(val) || DEFAULT_PX));
  await browser.storage.local.set({ chatMaxWidthPx: nNum });
  setBoth(nNum);
  setMode(false);
}

// Inputs → storage
widthPx.addEventListener("input", (e) => {
  slider.value = e.target.value;
});
widthPx.addEventListener("change", (e) => {
  void save(e.target.value);
});

slider.addEventListener("input", (e) => {
  widthPx.value = e.target.value;
});
slider.addEventListener("change", (e) => {
  void save(e.target.value);
});

// Reset → native (no override)
resetBtn.addEventListener("click", async () => {
  await browser.storage.local.set({ chatMaxWidthPx: null });
  setBoth(Math.min(DEFAULT_PX, capPx));
  setMode(true);
});

// =========================
// Boot
// =========================
loadBindingsUI();
load();
