# automated-climate-action-maker (ACAM)

A TypeScript-based Web Browser Extension (Manifest V3) that demonstrates a **100% On-Device, Privacy-First Architecture** for climate action and behavioral insights:
- **On-Device History Pipeline**: Reads Chromium history on-device, aggregates Google vs. non-Google visits, and discovers domain frequencies without sending any data off the local machine.
- **Live Compute Stream**: Streams background compute steps to the foreground popup in real time across a persistent messaging port.
- **Contextual Interventions**: Injects non-intrusive circular shopping alternatives and civic actions on supported news and e-commerce websites.

## Project Structure

```
automated-climate-action-maker/
├── src/                      # Extension source code
│   ├── background.ts         # Service worker compute engine and trace stream emitter
│   ├── content.ts            # Content script with DOM scanner and Shadow DOM overlays
│   ├── popup.ts              # Foreground UI controller and stream event listener
│   ├── popup.html            # Non-terminal visual stream UI
│   ├── popup.css             # Popup styles (progress bar, pulsing stream dot, domain lists)
│   └── index.ts              # Shared data schemas, types, and default scan configurations
├── assets/                   # Visual & store assets
│   ├── icons/                # Extension runtime icons (16, 32, 48, 128 PNG)
│   ├── store/                # Chrome Web Store promo tiles (440x280, 1400x560)
│   └── screenshots/          # Store screenshots (1280x800)
├── scripts/                  # Bundling, analysis, and developer tooling
│   ├── build.mjs             # esbuild bundling pipeline (MV3 ESM service worker + IIFE scripts)
│   ├── pack-store.mjs        # Production packager for Chrome Web Store upload
│   ├── check-static.mjs      # Static AST code & manifest guardrails linter
│   ├── generate-icons.mjs    # Standard icon generator (16, 32, 48, 128 PNG)
│   ├── generate-store-assets.mjs # Promo tile and screenshot renderer
│   └── launch.mjs            # Interactive launcher script
├── tests/                    # Automated testing suite
│   ├── test-storage-migration.mjs # Storage migration & schema upgrade suite
│   ├── test-runtime-guardrails.mjs # Headless Puppeteer network firewall & isolation test
│   ├── test-history-stream.mjs # Headless Puppeteer stream verification suite
│   ├── test-e2e-all.mjs      # Full end-to-end multi-scenario subsystem test
│   └── test-runner.mjs       # Minimal smoke test
├── manifest.json             # Extension manifest (storage, history, alarms)
├── package.json              # Project dependencies and test scripts
├── tsconfig.json             # TypeScript strict configuration
└── PRIVACY_POLICY.md         # Public zero-telemetry privacy disclosure
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

### 4. Run Developer Guardrails Suite
Run static AST audits and headless Puppeteer network firewall assertions to ensure zero outbound telemetry, anti-eval security, and Shadow DOM encapsulation:
```bash
npm run check:guardrails
# or simply:
npm test
```

### 5. Run Full End-to-End Regression Suite
Tests all subsystems end-to-end: Scenario A civic actions, Scenario C circular redirects, background messaging, and persistent storage points:
```bash
npm run test:e2e
```

### 6. Package for Chrome Web Store
Runs all guardrails and packages a clean, store-ready ZIP archive without sourcemaps:
```bash
npm run pack:store
```

### 7. Load into Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `dist/` directory inside this repository.
4. Click the ACAM icon in your browser toolbar and hit **"Run On-Device Analysis"** to observe the live compute stream and raw domain frequency breakdown.
