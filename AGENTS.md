# Automated Climate Action Maker (ACAM) - Developer Guardrails & Architecture

This repository contains the browser extension for the **Automated Climate Action Maker (ACAM)**.
To maintain production readiness, user trust, and Chrome Web Store compliance, all code changes MUST strictly adhere to the following architectural contracts and development guardrails.

---

## 1. Absolute Rule: Zero Outbound Telemetry (Local-First Guarantee)

- **Strict Sandbox Requirement:** ACAM processes browsing signals 100% on the user's local machine. Under no circumstance may browsing history, URLs, hostnames, timestamps, or personal data leave localhost.
- **Forbidden Network Primitives:**
  - `fetch()`
  - `XMLHttpRequest`
  - `WebSocket`
  - `navigator.sendBeacon()`
  - `EventSource`
  - Remote script injections or remote analytics SDKs (e.g., Google Analytics, Mixpanel, Sentry).
- **Manifest Restrictions:**
  - `manifest.json` MUST NOT request unrestricted network `host_permissions` (e.g., `<all_urls>`, `*://*/*`, `https://*/*`) for the background worker.
  - Content Security Policy (CSP) must remain strictly locked to `'self'`.
- **What counts as zero telemetry:** User-initiated tab navigation (via `openOutbound()`) is allowed — the extension opens a URL, the browser loads it. The extension itself makes no network requests. This is the pattern used for feedback sharing (Google Apps Script URL).
- **CWS re-review trigger:** Any change that adds `host_permissions`, new Chrome permissions, or modifies CSP triggers a Chrome Web Store re-review (1-3+ business days). Flag this to the user before implementing — it's a higher bar than a code change.

---

## 2. Manifest V3 Lifecycle & Concurrency Rules

- **Stateless Service Workers:** Chromium suspends service workers after ~30 seconds of inactivity.
  - NEVER store persistent state in global memory variables inside `background.ts`. All state MUST be written to `chrome.storage.local`.
- **Timer Ban:**
  - NEVER use `setInterval()` in `background.ts`—it will silently terminate when the worker enters sleep.
  - All recurring background tasks MUST be scheduled using `chrome.alarms`.
- **Event-Driven Execution:** Background logic should wake up, complete processing in `< 50ms`, commit state, and let the worker terminate.

---

## 3. Data Governance & Privacy Minimization

- **No Raw URL Retention:** The extension must NEVER save full URLs, paths, or query parameters (which may contain auth tokens, search queries, or personal identifiers) to `chrome.storage.local`.
- **Domain Aggregation Only:** Only sanitized hostnames/domains (e.g., `google.com`, `github.com`) and numerical frequencies may be retained in persistent storage.
- **Bounded Storage Footprint:** Persistent domain frequency maps must be bounded (e.g., top 100 hostnames). Single-visit long-tail domains must be pruned periodically so LevelDB storage stays `< 2 MB`.
- **Atomic Purge Contract:** Every new `chrome.storage.local` key MUST be added to the purge handler in `popup.ts`. If you add a storage key to `STORAGE_KEYS`, also add it to the purge `chrome.storage.local.remove()` call.

---

## 4. DOM Security & Anti-XSS Rules

- **Shadow DOM Isolation:** All in-page UI injected by `content.ts` MUST be attached inside an isolated Shadow DOM (`attachShadow({ mode: 'open' })`) to prevent third-party host page scripts from reading or tampering with ACAM elements.
- **Safe DOM Construction:**
  - NEVER use `eval()`, `new Function()`, or dynamic code execution.
  - Prefer explicit DOM instantiation (`document.createElement`, `element.textContent`, or validated SVG/templates) over raw `innerHTML` containing external or URL-derived text.

---

## 5. Outbound Link Policy

- **Single choke point:** ALL external tab opens MUST go through `openOutbound()` in `src/outbound.ts`. Direct `chrome.tabs.create()` or `window.open()` in any other file will fail the static checker.
- This applies even for non-partner URLs (e.g., feedback sharing, docs links).
- Partner URLs and tagging are managed in the `OUTBOUND_PARTNERS` registry in `outbound.ts`.

---

## 6. Extension Message Bus

- All message types are defined in the `ExtensionMessage` type union in `src/index.ts`.
- When adding a new background message handler, you MUST add the message type string to this union or TypeScript will reject it.
- Point values for actions live in `src/rewards.ts` — never hardcode point values elsewhere.

---

## 7. Release & Versioning

**IMPORTANT: Pushing to master with a version bump in `manifest.json` triggers an automatic release to the Chrome Web Store.**

- CI auto-tags when the `version` field in `manifest.json` changes on a master push. The tag triggers the CWS release workflow (build → test → upload).
- **Before completing any task, ask the user: "Does this change need a version bump in `manifest.json`?"** Do not bump the version without explicit confirmation — an accidental bump triggers a CWS upload.
- There is no PR workflow. Code is pushed directly to master.
- The full test suite (`npm test`) must pass before pushing. This runs typecheck, static analysis, migration tests, diagnostics tests, outbound tests, food parser tests, swap tests, and runtime guardrails.

---

## 8. Verification & Pre-Commit Gates

Before pushing any code changes, the following checks MUST pass cleanly:
```bash
# Full suite (typecheck + static + all unit/integration/runtime tests)
npm test

# Or individually:
npm run typecheck          # Strict TypeScript validation
npm run build              # Production bundling
npm run check:guardrails   # Static AST + Dynamic Network/Perf Tests
```
