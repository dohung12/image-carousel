const DEFAULTS = {
  minWidth: 150,
  minHeight: 150,
  autoplay: true,
  intervalMs: 3000,
  loop: true,
  rotateOnClick: false,
  twoUp: false,
  showContextMenu: false,
};

function getEl(id) {
  return document.getElementById(id);
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    getEl("minWidth").value = cfg.minWidth;
    getEl("minHeight").value = cfg.minHeight;
    getEl("autoplay").checked = !!cfg.autoplay;
    getEl("intervalMs").value = cfg.intervalMs;
    getEl("loop").checked = !!cfg.loop;
    getEl("rotateOnClick").checked = !!cfg.rotateOnClick;
    const twoUpEl = getEl("twoUp");
    if (twoUpEl) twoUpEl.checked = !!cfg.twoUp;
    const cmEl = getEl("showContextMenu");
    if (cmEl) cmEl.checked = !!cfg.showContextMenu;
  });
}

function save(e) {
  e.preventDefault();
  const cfg = {
    minWidth: Number(getEl("minWidth").value) || DEFAULTS.minWidth,
    minHeight: Number(getEl("minHeight").value) || DEFAULTS.minHeight,
    autoplay: !!getEl("autoplay").checked,
    intervalMs: Math.max(
      250,
      Number(getEl("intervalMs").value) || DEFAULTS.intervalMs
    ),
    loop: !!getEl("loop").checked,
    rotateOnClick: !!getEl("rotateOnClick").checked,
    twoUp: !!getEl("twoUp").checked,
    showContextMenu: !!getEl("showContextMenu").checked,
  };
  chrome.storage.sync.set(cfg, () => {
    const status = getEl("status");
    status.textContent = "Saved";
    setTimeout(() => (status.textContent = ""), 1200);
  });
}

function resetDefaults() {
  chrome.storage.sync.set(DEFAULTS, load);
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  document.getElementById("options-form").addEventListener("submit", save);
  document.getElementById("reset").addEventListener("click", resetDefaults);
  // Show current version from manifest
  const v = chrome.runtime.getManifest().version;
  const verEl = document.getElementById("version");
  if (verEl) verEl.textContent = `Version ${v}`;
});
