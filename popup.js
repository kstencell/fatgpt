const widthPx = document.getElementById("widthPx");
const slider = document.getElementById("slider");
const resetBtn = document.getElementById("reset");
const capEl = document.getElementById("capPx");
const modeEl = document.getElementById("mode");

const DEFAULT_PX = 768;
const MIN_PX = 600;
let capPx = 5000; // tightened via content script

function setBoth(val) {
  widthPx.value = String(val);
  slider.value = String(val);
}

function setMode(native) {
  modeEl.textContent = native ? "Native" : "Override";
}

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
  } catch (_) {
    // Not on ChatGPT? Keep defaults.
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

widthPx.addEventListener("input", (e) => (slider.value = e.target.value));
widthPx.addEventListener("change", (e) => save(e.target.value));

slider.addEventListener("input", (e) => (widthPx.value = e.target.value));
slider.addEventListener("change", (e) => save(e.target.value));

resetBtn.addEventListener("click", async () => {
  await browser.storage.local.set({ chatMaxWidthPx: null });
  setBoth(Math.min(DEFAULT_PX, capPx));
  setMode(true);
});

load();
