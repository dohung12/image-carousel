(function () {
  const DEFAULTS = {
    minWidth: 150,
    minHeight: 150,
    autoplay: true,
    intervalMs: 10000,
    loop: true,
    rotateOnClick: false,
    twoUp: false,
    previewCount: 3,
  };

  let isOpen = false;
  let state = {
    images: [],
    index: 0,
    autoplay: true,
    intervalMs: 3000,
    loop: true,
    timer: null,
    lastActiveElement: null,
    rotationsByIndex: {},
    twoUp: false,
    previewCount: 3,
  };

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (items) => {
        resolve({ ...DEFAULTS, ...items });
      });
    });
  }

  function pickSrcFromSrcset(srcset) {
    if (!srcset) return null;
    const parts = srcset
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;
    // Prefer the last candidate (often the largest descriptor)
    const last = parts[parts.length - 1];
    const url = last.split(/\s+/)[0];
    return url || null;
  }

  function pickBestImgUrl(img) {
    // Skip placeholder images (common lazy load placeholders)
    const currentSrc = img.currentSrc || img.src;
    const placeholderPatterns = [
      /lazy[_-]?placeholder/i,
      /blank\.(gif|png|jpg)/i,
      /transparent\.(gif|png|jpg)/i,
      /1x1\.(gif|png|jpg)/i,
      /spacer\.(gif|png|jpg)/i,
    ];

    // If current src looks like a placeholder, ignore it
    if (currentSrc) {
      const isPlaceholder = placeholderPatterns.some((pattern) =>
        pattern.test(currentSrc)
      );
      if (isPlaceholder) {
        // Force use data attributes instead
        const dataSrc =
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy") ||
          img.getAttribute("data-lazy-src") ||
          img.getAttribute("data-original") ||
          img.getAttribute("data-url");
        if (dataSrc) return dataSrc;
      } else if (!img.hasAttribute("data-lazy-type")) {
        // If not a placeholder and not explicitly lazy, use current src
        return currentSrc;
      }
    }

    // Priority: data-src → data-lazy-src → data-lazy → data-original → srcset → src
    const dataAttrs = [
      "data-src",
      "data-lazy-src",
      "data-lazy",
      "data-original",
      "data-url",
    ];
    for (const a of dataAttrs) {
      const v = img.getAttribute(a);
      if (v && !placeholderPatterns.some((pattern) => pattern.test(v))) {
        return v;
      }
    }

    const fromSrcset = pickSrcFromSrcset(
      img.srcset || img.getAttribute("data-srcset")
    );
    if (fromSrcset) return fromSrcset;

    // Last resort: use src if it's not a placeholder
    if (
      currentSrc &&
      !placeholderPatterns.some((pattern) => pattern.test(currentSrc))
    ) {
      return currentSrc;
    }

    return null;
  }

  function meetsSizeThreshold(img, minWidth, minHeight) {
    const rect = img.getBoundingClientRect();
    const byRect = rect.width >= minWidth && rect.height >= minHeight;
    if (byRect) return true;
    const attrW = parseInt(img.getAttribute("width") || "0", 10);
    const attrH = parseInt(img.getAttribute("height") || "0", 10);
    if (attrW >= minWidth && attrH >= minHeight) return true;
    const cs = window.getComputedStyle(img);
    const styleW = parseFloat(cs.width || "0");
    const styleH = parseFloat(cs.height || "0");
    if (styleW >= minWidth && styleH >= minHeight) return true;
    return false;
  }

  function findImages(minWidth, minHeight) {
    const imgs = Array.from(document.images || []);
    const seen = new Set();
    const list = [];

    // Also check images inside <a> tags that might be lazy loaded
    const linkImgs = Array.from(document.querySelectorAll("a img") || []);

    // Combine all image sources (document.images already includes most, but double-check links)
    const allImgs = [...new Set([...imgs, ...linkImgs])];

    for (const img of allImgs) {
      if (!meetsSizeThreshold(img, minWidth, minHeight)) continue;
      const src = pickBestImgUrl(img);
      if (!src) continue;
      if (seen.has(src)) continue;
      seen.add(src);
      list.push({ src, alt: img.alt || "" });
    }
    return list;
  }

  async function forceLoadLazyImages(minWidth, minHeight) {
    const imgs = Array.from(document.images || []);
    const tasks = [];
    const placeholderPatterns = [
      /lazy[_-]?placeholder/i,
      /blank\.(gif|png|jpg)/i,
      /transparent\.(gif|png|jpg)/i,
      /1x1\.(gif|png|jpg)/i,
      /spacer\.(gif|png|jpg)/i,
    ];

    for (const img of imgs) {
      // Skip tiny/hidden images to avoid wasting work
      if (!meetsSizeThreshold(img, minWidth, minHeight)) continue;

      const currentSrc = img.currentSrc || img.src;
      const isPlaceholder =
        currentSrc &&
        placeholderPatterns.some((pattern) => pattern.test(currentSrc));
      const hasLazyAttrs =
        img.getAttribute("loading") === "lazy" ||
        img.hasAttribute("data-src") ||
        img.hasAttribute("data-srcset") ||
        img.hasAttribute("data-lazy") ||
        img.hasAttribute("data-lazy-src") ||
        img.hasAttribute("data-original") ||
        img.hasAttribute("data-lazy-type");

      const hasLoaded = img.complete && img.naturalWidth > 0 && !isPlaceholder;

      // Skip if already loaded (not a placeholder) and has src
      if (hasLoaded && currentSrc && !isPlaceholder) continue;
      // Skip if not lazy and not a placeholder
      if (!hasLazyAttrs && currentSrc && !isPlaceholder) continue;
      // Skip if no lazy attributes at all
      if (!hasLazyAttrs && isPlaceholder) continue;

      tasks.push(
        (async () => {
          try {
            // Prefer upgrading attributes to eager
            img.setAttribute("loading", "eager");
            // If data-srcset exists, promote it
            const dataSrcset = img.getAttribute("data-srcset");
            if (!img.srcset && dataSrcset) img.srcset = dataSrcset;

            // Get data-src with priority order
            const dataSrc =
              img.getAttribute("data-src") ||
              img.getAttribute("data-lazy-src") ||
              img.getAttribute("data-lazy") ||
              img.getAttribute("data-original") ||
              img.getAttribute("data-url");

            // If has placeholder or data-lazy-type, force replace src
            if (isPlaceholder || img.hasAttribute("data-lazy-type")) {
              if (dataSrc) {
                img.setAttribute("src", dataSrc);
                img.removeAttribute("data-lazy-type");
              }
            } else if (!img.getAttribute("src") && dataSrc) {
              img.setAttribute("src", dataSrc);
            }

            // Also kick off a manual preload of the best URL we can detect
            const url = pickBestImgUrl(img);
            if (
              url &&
              !placeholderPatterns.some((pattern) => pattern.test(url))
            ) {
              const preload = new Image();
              preload.decoding = "async";
              preload.referrerPolicy = img.referrerPolicy || "";
              preload.crossOrigin = img.crossOrigin || null;
              const done = new Promise((resolve, reject) => {
                preload.onload = resolve;
                preload.onerror = reject;
              });
              preload.src = url;
              // Wait a bounded time so we don't block forever
              await Promise.race([
                done.catch(() => {}),
                new Promise((r) => setTimeout(r, 800)),
              ]);
            }

            // Attempt to decode the inline <img> if possible
            if (typeof img.decode === "function") {
              await Promise.race([
                img.decode().catch(() => {}),
                new Promise((r) => setTimeout(r, 500)),
              ]);
            }
          } catch (_) {
            // ignore individual failures
          }
        })()
      );
    }
    if (tasks.length) {
      await Promise.allSettled(tasks);
    }
  }

  function removeOverlay() {
    const overlay = document.getElementById("image-carousel-overlay");
    if (overlay) overlay.remove();
    document.documentElement.style.scrollbarGutter = "";
    document.body.style.overflow = "";
    isOpen = false;
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.lastActiveElement && state.lastActiveElement.focus) {
      state.lastActiveElement.focus();
    }
  }

  function preloadNeighbors(idx) {
    const neighborIndexes = [idx + 1, idx - 1];
    for (const ni of neighborIndexes) {
      const j = normalizeIndex(ni);
      if (j === null) continue;
      const img = new Image();
      img.src = state.images[j]?.src;
    }
  }

  function normalizeIndex(i) {
    if (state.images.length === 0) return null;
    if (i >= 0 && i < state.images.length) return i;
    if (state.loop) {
      if (i < 0) return state.images.length - 1;
      if (i >= state.images.length) return 0;
    }
    return null;
  }

  function renderPreviewThumbnails() {
    const previewRow = document.querySelector(
      "#image-carousel-overlay .carousel-preview-row"
    );
    if (!previewRow) return;

    // Clear existing thumbnails
    previewRow.innerHTML = "";

    let count = state.previewCount;
    let indices = [];
    const seen = new Set();

    if (state.twoUp) {
      // In 2-up mode: count represents number of couples, so multiply by 2
      // Center around the current couple (current and next image)
      const couples = count;
      const targetCount = couples * 2;
      const halfCouples = Math.floor(couples / 2);

      // Generate indices for couples (each step is 2 images)
      for (let c = -halfCouples; c <= halfCouples; c++) {
        const baseIdx = state.index + c * 2;
        const idx1 = normalizeIndex(baseIdx);
        const idx2 = normalizeIndex(baseIdx + 1);

        if (idx1 !== null && !seen.has(idx1)) {
          seen.add(idx1);
          indices.push(idx1);
        }
        if (idx2 !== null && !seen.has(idx2)) {
          seen.add(idx2);
          indices.push(idx2);
        }
      }

      // Limit to target count
      if (indices.length > targetCount) {
        const extra = indices.length - targetCount;
        const trimStart = Math.floor(extra / 2);
        const trimEnd = Math.ceil(extra / 2);
        indices.splice(0, trimStart);
        indices.splice(indices.length - trimEnd, trimEnd);
      }
    } else {
      // Single image mode: normal preview
      const half = Math.floor(count / 2);
      for (let i = -half; i <= half; i++) {
        const idx = normalizeIndex(state.index + i);
        if (idx !== null && !seen.has(idx)) {
          seen.add(idx);
          indices.push(idx);
        }
      }

      // Limit to exactly 'count' thumbnails
      if (indices.length > count) {
        const extra = indices.length - count;
        const trimStart = Math.floor(extra / 2);
        const trimEnd = Math.ceil(extra / 2);
        indices.splice(0, trimStart);
        indices.splice(indices.length - trimEnd, trimEnd);
      }
    }

    // Create thumbnails
    if (state.twoUp && indices.length > 0) {
      // In 2-up mode: group into couples with borders
      for (let i = 0; i < indices.length; i += 2) {
        const coupleGroup = document.createElement("div");
        coupleGroup.className = "carousel-preview-couple";

        const idx1 = indices[i];
        const idx2 = indices[i + 1];
        const isCurrentCouple = idx1 === state.index || idx2 === state.index;

        if (isCurrentCouple) {
          coupleGroup.classList.add("active-couple");
        }

        // Create first thumbnail
        const thumb1 = document.createElement("div");
        thumb1.className = "carousel-preview-thumb";
        if (idx1 === state.index) {
          thumb1.classList.add("active");
        }
        const thumbImg1 = document.createElement("img");
        thumbImg1.src = state.images[idx1].src;
        thumbImg1.alt = state.images[idx1].alt || "";
        thumbImg1.loading = "lazy";
        thumb1.appendChild(thumbImg1);
        thumb1.addEventListener("click", () => {
          renderToIndex(idx1);
          if (state.autoplay) startAutoplay();
        });
        coupleGroup.appendChild(thumb1);

        // Create second thumbnail if available
        if (idx2 !== undefined) {
          const thumb2 = document.createElement("div");
          thumb2.className = "carousel-preview-thumb";
          const thumbImg2 = document.createElement("img");
          thumbImg2.src = state.images[idx2].src;
          thumbImg2.alt = state.images[idx2].alt || "";
          thumbImg2.loading = "lazy";
          thumb2.appendChild(thumbImg2);
          thumb2.addEventListener("click", () => {
            renderToIndex(idx2);
            if (state.autoplay) startAutoplay();
          });
          coupleGroup.appendChild(thumb2);
        }

        previewRow.appendChild(coupleGroup);
      }
    } else {
      // Single image mode: individual thumbnails
      indices.forEach((idx) => {
        const thumb = document.createElement("div");
        thumb.className = "carousel-preview-thumb";
        if (idx === state.index) {
          thumb.classList.add("active");
        }
        const thumbImg = document.createElement("img");
        thumbImg.src = state.images[idx].src;
        thumbImg.alt = state.images[idx].alt || "";
        thumbImg.loading = "lazy";
        thumb.appendChild(thumbImg);
        thumb.addEventListener("click", () => {
          renderToIndex(idx);
          if (state.autoplay) startAutoplay();
        });
        previewRow.appendChild(thumb);
      });
    }
  }

  function renderToIndex(i) {
    const next = normalizeIndex(i);
    if (next === null) return;
    state.index = next;
    const overlayEl = document.getElementById("image-carousel-overlay");
    const imgEl = document.querySelector(
      "#image-carousel-overlay .carousel-image"
    );
    const imgEl2 = document.querySelector(
      "#image-carousel-overlay .carousel-image.secondary"
    );
    const counterEl = document.querySelector(
      "#image-carousel-overlay .carousel-counter"
    );
    const captionEl = document.querySelector(
      "#image-carousel-overlay .carousel-caption"
    );
    const { src, alt } = state.images[state.index];
    if (imgEl) imgEl.src = src;
    if (state.twoUp && imgEl2) {
      const nextIdx = normalizeIndex(state.index + 1);
      if (nextIdx !== null) {
        imgEl2.src = state.images[nextIdx].src;
        imgEl2.removeAttribute("hidden");
      } else {
        imgEl2.setAttribute("hidden", "");
      }
    }
    if (counterEl) {
      if (state.twoUp) {
        const a = state.index + 1;
        const b = Math.min(state.images.length, state.index + 2);
        counterEl.textContent = `${a}-${b} / ${state.images.length}`;
      } else {
        counterEl.textContent = `${state.index + 1} / ${state.images.length}`;
      }
    }
    if (captionEl) captionEl.textContent = alt || "";
    // Apply current rotation for this index
    if (imgEl) {
      const deg = state.rotationsByIndex[state.index] || 0;
      imgEl.style.transform = `rotate(${deg}deg)`;
    }
    if (state.twoUp && imgEl2) {
      const deg2 = state.rotationsByIndex[normalizeIndex(state.index + 1)] || 0;
      imgEl2.style.transform = `rotate(${deg2}deg)`;
    }
    preloadNeighbors(state.index);
    renderPreviewThumbnails();
  }

  function startAutoplay() {
    stopAutoplay();
    if (!state.autoplay) return;
    state.timer = setInterval(() => {
      const step = state.twoUp ? 2 : 1;
      const ni = normalizeIndex(state.index + step);
      if (ni === null) {
        stopAutoplay();
        return;
      }
      renderToIndex(ni);
    }, state.intervalMs);
  }

  function stopAutoplay() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function toggleAutoplay(button) {
    state.autoplay = !state.autoplay;
    button.textContent = state.autoplay ? "⏸" : "▶";
    button.setAttribute(
      "title",
      state.autoplay ? "Pause autoplay (Space/P)" : "Play autoplay (Space/P)"
    );
    if (state.autoplay) startAutoplay();
    else stopAutoplay();
  }

  function trapFocus(e) {
    const overlay = document.getElementById("image-carousel-overlay");
    if (!overlay) return;
    const focusable = overlay.querySelectorAll("button");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  async function openCarousel() {
    if (isOpen) {
      const root = document.getElementById("image-carousel-overlay");
      if (root) root.removeAttribute("hidden");
      return;
    }
    isOpen = true;
    state.lastActiveElement = document.activeElement;

    const settings = await getSettings();
    // Proactively try to load lazy images before we collect
    await forceLoadLazyImages(settings.minWidth, settings.minHeight);
    const images = findImages(settings.minWidth, settings.minHeight);
    state.images = images;
    state.autoplay = !!settings.autoplay;
    // Check localStorage for saved interval and preview count
    const savedInterval = localStorage.getItem("imageCarousel_intervalMs");
    const savedPreviewCount = localStorage.getItem(
      "imageCarousel_previewCount"
    );
    state.intervalMs = savedInterval
      ? Number(savedInterval)
      : Number(settings.intervalMs) || DEFAULTS.intervalMs;
    state.loop = !!settings.loop;
    state.rotateOnClick = !!settings.rotateOnClick;
    state.twoUp = !!settings.twoUp;
    state.previewCount = savedPreviewCount
      ? Number(savedPreviewCount)
      : Number(settings.previewCount) || DEFAULTS.previewCount;

    if (!images || images.length === 0) {
      isOpen = false;
      alert(
        "No images found for carousel. Try lowering size threshold in Options."
      );
      return;
    }

    // Build overlay
    const overlay = document.createElement("div");
    overlay.id = "image-carousel-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const root = document.createElement("div");
    root.className = "carousel-root";

    const topbar = document.createElement("div");
    topbar.className = "carousel-topbar";
    const title = document.createElement("div");
    title.textContent = document.title || "Image Carousel";
    title.title = document.title || "Image Carousel";
    const counter = document.createElement("div");
    counter.className = "carousel-counter";
    const topClose = document.createElement("button");
    topClose.className = "carousel-button carousel-topbar-close";
    topClose.type = "button";
    topClose.setAttribute("aria-label", "Close carousel");
    topClose.setAttribute("title", "Close carousel (Esc)");
    topClose.textContent = "✕";
    const topbarRight = document.createElement("div");
    topbarRight.className = "carousel-topbar-right";
    topbarRight.appendChild(counter);
    topbarRight.appendChild(topClose);
    topbar.appendChild(title);
    topbar.appendChild(topbarRight);

    const stage = document.createElement("div");
    stage.className = state.twoUp ? "carousel-stage two-up" : "carousel-stage";
    const img = document.createElement("img");
    img.className = "carousel-image";
    img.alt = "";
    stage.appendChild(img);
    const img2 = document.createElement("img");
    img2.className = "carousel-image secondary";
    img2.alt = "";
    if (!state.twoUp) img2.setAttribute("hidden", "");
    stage.appendChild(img2);

    const caption = document.createElement("div");
    caption.className = "carousel-caption";

    const previewRow = document.createElement("div");
    previewRow.className = "carousel-preview-row";

    const navPrevWrap = document.createElement("div");
    navPrevWrap.className = "carousel-nav carousel-prev";
    const btnPrev = document.createElement("button");
    btnPrev.className = "carousel-button";
    btnPrev.type = "button";
    btnPrev.setAttribute("aria-label", "Previous image");
    btnPrev.setAttribute("title", "Previous image (←)");
    btnPrev.textContent = "←";
    navPrevWrap.appendChild(btnPrev);

    const navNextWrap = document.createElement("div");
    navNextWrap.className = "carousel-nav carousel-next";
    const btnNext = document.createElement("button");
    btnNext.className = "carousel-button";
    btnNext.type = "button";
    btnNext.setAttribute("aria-label", "Next image");
    btnNext.setAttribute("title", "Next image (→)");
    btnNext.textContent = "→";
    navNextWrap.appendChild(btnNext);

    const controls = document.createElement("div");
    controls.className = "carousel-controls";
    const btnPlayPause = document.createElement("button");
    btnPlayPause.className = "carousel-button";
    btnPlayPause.type = "button";
    btnPlayPause.setAttribute("aria-label", "Toggle autoplay");
    btnPlayPause.setAttribute(
      "title",
      settings.autoplay ? "Pause autoplay (Space/P)" : "Play autoplay (Space/P)"
    );
    btnPlayPause.textContent = settings.autoplay ? "⏸" : "▶";

    const btnRotate = document.createElement("button");
    btnRotate.className = "carousel-button";
    btnRotate.type = "button";
    btnRotate.setAttribute("aria-label", "Rotate current image 90 degrees");
    btnRotate.setAttribute("title", "Rotate image 90° (R)");
    btnRotate.textContent = "↻";

    const selectInterval = document.createElement("select");
    selectInterval.className = "carousel-select";
    selectInterval.setAttribute("aria-label", "Autoplay interval");
    selectInterval.setAttribute("title", "Autoplay interval");
    const intervals = [
      { value: 1000, label: "1s" },
      { value: 2000, label: "2s" },
      { value: 3000, label: "3s" },
      { value: 5000, label: "5s" },
      { value: 10000, label: "10s" },
    ];
    intervals.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label;
      if (value === state.intervalMs) option.selected = true;
      selectInterval.appendChild(option);
    });

    const btnTwoUp = document.createElement("button");
    btnTwoUp.className = "carousel-button";
    btnTwoUp.type = "button";
    btnTwoUp.setAttribute("aria-label", "Toggle two-up view");
    btnTwoUp.setAttribute(
      "title",
      state.twoUp
        ? "Switch to single view (2×) (T)"
        : "Switch to two-up view (1×) (T)"
    );
    btnTwoUp.textContent = state.twoUp ? "2×" : "1×";

    const selectPreviewCount = document.createElement("select");
    selectPreviewCount.className = "carousel-select";
    selectPreviewCount.setAttribute("aria-label", "Preview count");
    selectPreviewCount.setAttribute("title", "Number of preview images");
    const previewCounts = [3, 5, 10];
    previewCounts.forEach((count) => {
      const option = document.createElement("option");
      option.value = String(count);
      option.textContent = String(count);
      if (count === state.previewCount) option.selected = true;
      selectPreviewCount.appendChild(option);
    });

    const btnInfo = document.createElement("button");
    btnInfo.className = "carousel-button";
    btnInfo.type = "button";
    btnInfo.setAttribute("aria-label", "Show keyboard shortcuts");
    btnInfo.setAttribute("title", "Show keyboard shortcuts (?)");
    btnInfo.textContent = "ℹ";

    const btnClose = document.createElement("button");
    btnClose.className = "carousel-button";
    btnClose.type = "button";
    btnClose.setAttribute("aria-label", "Close carousel");
    btnClose.setAttribute("title", "Close carousel (Esc)");
    btnClose.textContent = "✕";

    controls.appendChild(btnPlayPause);
    controls.appendChild(btnRotate);
    controls.appendChild(selectInterval);
    controls.appendChild(btnTwoUp);
    controls.appendChild(selectPreviewCount);
    controls.appendChild(btnInfo);
    controls.appendChild(btnClose);

    root.appendChild(topbar);
    root.appendChild(stage);
    root.appendChild(caption);
    root.appendChild(previewRow);
    root.appendChild(navPrevWrap);
    root.appendChild(navNextWrap);
    root.appendChild(controls);
    overlay.appendChild(root);
    document.documentElement.appendChild(overlay);

    // Prevent background scroll
    document.body.style.overflow = "hidden";

    // Initial render
    renderToIndex(0);

    // Hotkey modal
    function createHotkeyModal() {
      const modal = document.createElement("div");
      modal.className = "carousel-hotkey-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Keyboard shortcuts");

      const modalContent = document.createElement("div");
      modalContent.className = "carousel-hotkey-modal-content";

      const modalHeader = document.createElement("div");
      modalHeader.className = "carousel-hotkey-modal-header";
      modalHeader.textContent = "Keyboard Shortcuts";

      const modalBody = document.createElement("div");
      modalBody.className = "carousel-hotkey-modal-body";

      const shortcuts = [
        { key: "← / →", desc: "Previous / Next image" },
        { key: "Space", desc: "Toggle autoplay" },
        { key: "P", desc: "Play / Pause" },
        { key: "R", desc: "Rotate image 90°" },
        { key: "T", desc: "Toggle two-up view" },
        { key: "Wheel", desc: "Navigate images" },
        { key: "Esc", desc: "Close carousel" },
        { key: "?", desc: "Show this help" },
      ];

      shortcuts.forEach(({ key, desc }) => {
        const row = document.createElement("div");
        row.className = "carousel-hotkey-row";

        const keyCell = document.createElement("div");
        keyCell.className = "carousel-hotkey-key";
        keyCell.textContent = key;

        const descCell = document.createElement("div");
        descCell.className = "carousel-hotkey-desc";
        descCell.textContent = desc;

        row.appendChild(keyCell);
        row.appendChild(descCell);
        modalBody.appendChild(row);
      });

      const modalClose = document.createElement("button");
      modalClose.className = "carousel-button";
      modalClose.textContent = "Close";
      modalClose.addEventListener("click", () => modal.remove());

      modalContent.appendChild(modalHeader);
      modalContent.appendChild(modalBody);
      modalContent.appendChild(modalClose);
      modal.appendChild(modalContent);

      overlay.appendChild(modal);

      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });

      return modal;
    }

    let hotkeyModal = null;
    function toggleHotkeyModal() {
      if (hotkeyModal && hotkeyModal.parentElement) {
        hotkeyModal.remove();
        hotkeyModal = null;
      } else {
        hotkeyModal = createHotkeyModal();
      }
    }

    // Handlers
    function onKey(e) {
      trapFocus(e);
      if (e.key === "Escape") {
        if (hotkeyModal && hotkeyModal.parentElement) {
          e.preventDefault();
          hotkeyModal.remove();
          hotkeyModal = null;
        } else {
          e.preventDefault();
          removeOverlay();
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        renderToIndex(state.index + (state.twoUp ? 2 : 1));
        if (state.autoplay) startAutoplay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        renderToIndex(state.index - (state.twoUp ? 2 : 1));
        if (state.autoplay) startAutoplay();
      } else if (e.code === "Space" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        toggleAutoplay(btnPlayPause);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const current = state.rotationsByIndex[state.index] || 0;
        const next = (current + 90) % 360;
        state.rotationsByIndex[state.index] = next;
        const imgEl = document.querySelector(
          "#image-carousel-overlay .carousel-image"
        );
        if (imgEl) imgEl.style.transform = `rotate(${next}deg)`;
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        state.twoUp = !state.twoUp;
        btnTwoUp.textContent = state.twoUp ? "2×" : "1×";
        btnTwoUp.setAttribute(
          "title",
          state.twoUp
            ? "Switch to single view (2×)"
            : "Switch to two-up view (1×)"
        );
        const imgEl2 = document.querySelector(
          "#image-carousel-overlay .carousel-image.secondary"
        );
        const stageEl = document.querySelector(
          "#image-carousel-overlay .carousel-stage"
        );
        if (stageEl) {
          stageEl.className = state.twoUp
            ? "carousel-stage two-up"
            : "carousel-stage";
        }
        if (imgEl2) {
          if (state.twoUp) imgEl2.removeAttribute("hidden");
          else imgEl2.setAttribute("hidden", "");
        }
        renderToIndex(state.index);
        if (state.autoplay) startAutoplay();
      } else if (e.key === "?" || e.key === "/") {
        e.preventDefault();
        toggleHotkeyModal();
      }
    }

    // Wheel to navigate (throttled)
    let lastWheelAt = 0;
    function onWheel(e) {
      const now = Date.now();
      if (now - lastWheelAt < 150) return; // throttle
      // Only act on vertical scrolling
      const dy = e.deltaY;
      if (Math.abs(dy) < 2) return;
      e.preventDefault();
      e.stopPropagation();
      lastWheelAt = now;
      const step = state.twoUp ? 2 : 1;
      if (dy > 0) {
        renderToIndex(state.index + step);
      } else {
        renderToIndex(state.index - step);
      }
      if (state.autoplay) startAutoplay();
    }

    btnPrev.addEventListener("click", () =>
      renderToIndex(state.index - (state.twoUp ? 2 : 1))
    );
    btnNext.addEventListener("click", () =>
      renderToIndex(state.index + (state.twoUp ? 2 : 1))
    );
    btnPlayPause.addEventListener("click", () => toggleAutoplay(btnPlayPause));
    selectInterval.addEventListener("change", (e) => {
      const newInterval = parseInt(e.target.value, 10);
      state.intervalMs = newInterval;
      localStorage.setItem("imageCarousel_intervalMs", String(newInterval));
      if (state.autoplay) startAutoplay();
    });
    btnRotate.addEventListener("click", () => {
      const current = state.rotationsByIndex[state.index] || 0;
      const next = (current + 90) % 360;
      state.rotationsByIndex[state.index] = next;
      const imgEl = document.querySelector(
        "#image-carousel-overlay .carousel-image"
      );
      if (imgEl) imgEl.style.transform = `rotate(${next}deg)`;
    });
    btnTwoUp.addEventListener("click", () => {
      state.twoUp = !state.twoUp;
      btnTwoUp.textContent = state.twoUp ? "2×" : "1×";
      btnTwoUp.setAttribute(
        "title",
        state.twoUp
          ? "Switch to single view (2×) (T)"
          : "Switch to two-up view (1×) (T)"
      );
      // Show/hide secondary image accordingly and re-render counters/rotation
      const imgEl2 = document.querySelector(
        "#image-carousel-overlay .carousel-image.secondary"
      );
      const stageEl = document.querySelector(
        "#image-carousel-overlay .carousel-stage"
      );
      if (stageEl) {
        stageEl.className = state.twoUp
          ? "carousel-stage two-up"
          : "carousel-stage";
      }
      if (imgEl2) {
        if (state.twoUp) imgEl2.removeAttribute("hidden");
        else imgEl2.setAttribute("hidden", "");
      }
      renderToIndex(state.index);
      if (state.autoplay) startAutoplay();
    });
    selectPreviewCount.addEventListener("change", (e) => {
      const newCount = parseInt(e.target.value, 10);
      state.previewCount = newCount;
      localStorage.setItem("imageCarousel_previewCount", String(newCount));
      renderPreviewThumbnails();
    });
    btnInfo.addEventListener("click", toggleHotkeyModal);
    btnClose.addEventListener("click", removeOverlay);
    topClose.addEventListener("click", removeOverlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) removeOverlay();
    });

    document.addEventListener("keydown", onKey, true);
    overlay.addEventListener("wheel", onWheel, { passive: false });
    // Swallow wheel/touch events at the document level while open to avoid page scroll
    const swallowWheelOrTouch = (e) => {
      // Only act while overlay exists
      if (!document.getElementById("image-carousel-overlay")) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", swallowWheelOrTouch, {
      capture: true,
      passive: false,
    });
    document.addEventListener("touchmove", swallowWheelOrTouch, {
      capture: true,
      passive: false,
    });
    overlay.addEventListener("remove", () => {
      document.removeEventListener("keydown", onKey, true);
      overlay.removeEventListener("wheel", onWheel, { passive: false });
      document.removeEventListener("wheel", swallowWheelOrTouch, {
        capture: true,
        passive: false,
      });
      document.removeEventListener("touchmove", swallowWheelOrTouch, {
        capture: true,
        passive: false,
      });
    });

    // Rotate on click (optional)
    img.addEventListener("click", () => {
      if (!state.rotateOnClick) return;
      const current = state.rotationsByIndex[state.index] || 0;
      const next = (current + 90) % 360;
      state.rotationsByIndex[state.index] = next;
      img.style.transform = `rotate(${next}deg)`;
    });
    img2.addEventListener("click", () => {
      if (!state.rotateOnClick) return;
      const idx2 = normalizeIndex(state.index + 1);
      if (idx2 === null) return;
      const current = state.rotationsByIndex[idx2] || 0;
      const next = (current + 90) % 360;
      state.rotationsByIndex[idx2] = next;
      img2.style.transform = `rotate(${next}deg)`;
    });

    // Focus first control for accessibility
    btnNext.focus();

    // Autoplay
    if (state.autoplay) startAutoplay();
  }

  // Message listener
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "open-carousel") {
      openCarousel();
    }
  });
})();
