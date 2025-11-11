# Change log

## [0.2.5] - 2025-11-11

### Fixed

- Prevent duplicate context menu creation error (`image-carousel-open`) by making menu setup idempotent

## [0.2.6] - 2025-11-11

### Fixed

- Hide scrollbar at the end of the preview images bar while keeping it scrollable

## [0.2.7] - 2025-11-11

### Added

- Close button in the top bar for quick dismissal of the carousel overlay

## [0.2.8] - 2025-11-11

### Fixed

- Two-up mode now enforces a strict 1/2 split: each image gets 50% width and consistent height to avoid uneven layouts

## [0.2.4] - 2025-11-11

### Fixed

- Prevent page scroll when navigating images with mouse wheel or touch in carousel mode
  - Added capture-phase `wheel`/`touchmove` blockers with `passive: false`
  - Stopped event propagation within overlay wheel handler
  - Applied `overscroll-behavior: contain` and `touch-action: none` on overlay

## [0.2.3] - 2025-01-XX

### Added

- Context menu entry "Open Image Carousel" enabled by default
- Option remains configurable in Options page

### Improved

- More robust context menu initialization on install and startup

## [0.2.2] - 2025-01-XX

### Added

- Keyboard shortcuts for all controls:
  - `P` or `Space`: Toggle play/pause
  - `R`: Rotate image 90°
  - `T`: Toggle two-up view
  - `?` or `/`: Show keyboard shortcuts help
- Information button (ℹ) in control bar to display keyboard shortcuts modal
- Hotkey information modal with all available keyboard shortcuts

### Improved

- Buttons made wider (1rem additional padding) for better usability
- Interval selector made slightly larger with increased padding and font size
- Fixed control buttons click handling (first 3 buttons were blocked by overlapping caption)

### Fixed

- Autoplay no longer starts automatically on carousel open - respects user's autoplay setting

## [0.2.1] - 2025-01-XX

### Added

- Preview thumbnails row showing adjacent images (configurable: 3, 5, or 10 previews)
- Tooltips on all control buttons with descriptions and keyboard shortcuts
- Page title displayed in top-left corner of carousel
- Interval selector in control bar (1s, 2s, 3s, 5s, 10s)
- Couple grouping in preview bar when 2-up mode is enabled (images grouped with borders)
- Enhanced lazy loading detection for WordPress lazy-load patterns
- Context menu option (configurable in Options)

### Improved

- Control bar made more compact with icon-only buttons
- Lazy image detection now handles placeholder images and data-lazy-type attributes
- Preview thumbnails show couples in 2-up mode (e.g., 3 previews = 6 images = 3 couples)

### Fixed

- Images inside `<a>` tags are now properly detected
- Placeholder images (lazy_placeholder.gif, etc.) are filtered out

## [0.2.0] - Initial release

### Features

- Fullscreen image carousel overlay
- Keyboard navigation (Arrow keys, Space, Esc)
- Mouse wheel navigation
- Autoplay with configurable interval
- Two-up view mode (side-by-side images)
- Image rotation (90° increments)
- Options page for configuration
- Lazy loading image detection
