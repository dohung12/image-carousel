# Changelog

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
- Fixed control buttons clickability issue (first 3 buttons were unclickable due to overlapping caption)

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
