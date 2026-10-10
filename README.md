# automated-climate-action-maker (ACAM)

A TypeScript-based Web Browser Extension (Manifest V3) that demonstrates a **100% On-Device, Privacy-First Architecture** for climate action and behavioral insights:
- **On-Device History Pipeline**: Reads Chromium history on-device, aggregates Google vs. non-Google visits, and discovers domain frequencies without sending any data off the local machine.
- **Live Compute Stream**: Streams background compute steps to the foreground popup in real time across a persistent messaging port.
- **Contextual Interventions**: Injects non-intrusive circular shopping alternatives and civic actions on supported news and e-commerce websites.

## Project Structure

```
automated-climate-action-maker/
├── build.mjs                 # esbuild bundling pipeline (MV3 ESM service worker + IIFE scripts)
├── package.json              # Project dependencies and test scripts
├── tsconfig.json             # TypeScript strict configuration
├── manifest.json             # Extension manifest (storage, activeTab, history)
├── popup.html                # Non-terminal visual stream UI
├── popup.css                 # Popup styles (progress bar, pulsing stream dot, domain lists)
├── popup.ts                  # Foreground UI controller and stream event listener
├── background.ts             # Service worker compute engine and trace stream emitter
├── content.ts                # Content script with DOM scanner and Shadow DOM overlays
├── index.ts                  # Shared data schemas, types, and default scan configurations
├── test-history-stream.mjs   # Headless Puppeteer verification suite
└── launch.mjs                # Interactive launcher script
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

### 3. Run Automated Stream Verification Test
Verify the background history ingestion, live streaming progress bar, domain aggregation, and cache purging headlessly via Puppeteer:
```bash
npm run test:stream
```

### 4. Load into Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `dist/` directory inside this repository.
4. Click the ACAM icon in your browser toolbar and hit **"Run On-Device Analysis"** to observe the live compute stream and raw domain frequency breakdown.
