// bg.js — shared for Chrome MV3 (service worker) and Firefox MV2 (background script)
/* global chrome, browser */
const api = typeof browser !== "undefined" ? browser : chrome;

api.commands.onCommand.addListener(async (command) => {
  try {
    const tabs = await new Promise((res) =>
      api.tabs.query({ active: true, currentWindow: true }, res)
    );
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;

    const url = tab.url || "";
    if (!/https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url)) return;

    let msg = null;
    if (command === "fatgpt-wider") msg = { type: "fatgpt:cmd", cmd: "wider" };
    if (command === "fatgpt-narrower")
      msg = { type: "fatgpt:cmd", cmd: "narrower" };
    if (command === "fatgpt-native")
      msg = { type: "fatgpt:cmd", cmd: "native" };
    if (msg) api.tabs.sendMessage(tab.id, msg);
  } catch (_) {
    /* no-op */
  }
});
