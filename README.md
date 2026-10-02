# automated-climate-action-maker

A TypeScript-based Web Browser Extension (Manifest V3) that scans web pages, detects carbon-intensive options (e.g., expedited shipping, travel routes), and nudges or automates climate-positive decisions.

## Project Structure

```
automated-climate-action-maker/
├── build.js              # esbuild compilation script (IIFE for content, ESM for background)
├── package.json          # Project metadata and dependencies
├── tsconfig.json         # TypeScript strict configuration
├── public/
│   ├── manifest.json     # Chrome / Web Extension Manifest V3
│   ├── popup.html        # Extension popup toolbar view
│   └── popup.css         # Popup styles
└── src/
    ├── types/            # Shared TypeScript data models and message schemas
    ├── background/       # Service worker handling storage and telemetry
    ├── content/          # Content script with DOM scanner and isolated Shadow DOM UI
    └── popup/            # Extension popup logic
```

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Extension
```bash
# One-time build
npm run build

# Watch mode during development
npm run watch

# Type check without emitting
npm run typecheck
```

The compiled extension files are output to `dist/`.

### 3. Load into Browser
1. Open Chrome or any Chromium-based browser and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `dist/` directory inside this repository.