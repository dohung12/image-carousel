const DEFAULTS = {
  showContextMenu: true,
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (v) => resolve({ ...DEFAULTS, ...v }));
  });
}

const MENU_ID = "image-carousel-open";

async function ensureContextMenu() {
  const { showContextMenu } = await getSettings();
  if (!chrome.contextMenus) return;
  await new Promise((resolve) =>
    chrome.contextMenus.removeAll(() => resolve())
  );
  if (showContextMenu) {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Open Image Carousel",
      contexts: ["page", "image"],
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenu();
});

chrome.runtime.onStartup?.addListener?.(() => {
  ensureContextMenu();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "open-carousel" });
  } catch (_err) {
    // If content script isn't injected yet, only attempt dynamic injection if the API exists
    if (chrome.scripting && chrome.scripting.executeScript) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/carousel.js"],
        });
        await chrome.tabs.sendMessage(tab.id, { type: "open-carousel" });
      } catch (e) {
        console.error("Failed to open carousel:", e);
      }
    } else {
      console.error("chrome.scripting API is unavailable in this context.");
    }
  }
});

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "open-carousel" });
  } catch (_) {
    if (chrome.scripting && chrome.scripting.executeScript) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/carousel.js"],
        });
        await chrome.tabs.sendMessage(tab.id, { type: "open-carousel" });
      } catch (e) {
        console.error("Failed to open from context menu:", e);
      }
    }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.showContextMenu) {
    ensureContextMenu();
  }
});
