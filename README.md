# Image Carousel Chrome Extension

A Chrome Manifest V3 extension that discovers images on any page and presents them in a fullscreen, keyboard-friendly carousel. Built for quick browsing with autoplay, rotations, two-up viewing, and accessibility in mind.

## Features

- Fullscreen overlay with keyboard, mouse, and touch navigation
- Autoplay with configurable intervals and preview thumbnails
- Two-up mode for side-by-side viewing
- Image rotation (90° increments) and rotate-on-click option
- Keyboard shortcuts modal and contextual tooltips
- Chrome context menu shortcut and options page
- Handles lazy-loaded images, `srcset`, and placeholder swaps
- Uses `chrome.storage.sync` so settings roam with your profile

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/image-carousel.git
   cd image-carousel
   ```
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the repository folder.
5. The extension icon appears in the toolbar; pin it for quick access.

## Usage

- Click the extension icon or use the context menu entry **Open Image Carousel** to scan the current tab.
- Navigate using arrow keys, mouse wheel, touchpad gestures, or on-screen buttons.
- Press `Space`/`P` to toggle autoplay, `R` to rotate, `T` to switch single/two-up view, and `?` to see available shortcuts.
- Close the carousel with `Esc` or the close button.

## Development

```bash
pnpm install
# Make code changes
# Optionally bump the version when preparing a release
pnpm bump:patch
```

- After changes, reload the extension at `chrome://extensions` → **Reload**.
- Test on pages with standard images, lazy-loaded assets, and `srcset` to verify detection.
- Follow repository conventions (double quotes, modular functions, accessibility, `chrome.storage.sync` defaults).

## Versioning

The project follows semantic versioning:

- Patch (`pnpm bump:patch`): fixes & small improvements (handled automatically after feature work)
- Minor/major: run `pnpm bump:minor` or `pnpm bump:major` when coordinating larger changes
- `package.json` and `manifest.json` are kept in sync by `tools/bump-version.js`

Each release must update `changelog.md` and commit with `Bump version to x.y.z`.

## Contributing

1. Fork the repository and create a feature branch.
2. Make changes with tests/verification where applicable.
3. Run linting or manual testing as needed.
4. Submit a pull request describing the changes and testing performed.

## License

MIT © contributors.

