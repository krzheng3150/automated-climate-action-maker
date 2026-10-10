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
- **Atomic Purge Contract:** Every storage key written by ACAM must be wiped when the user triggers the "Purge Local Cache" action.

---

## 4. DOM Security & Anti-XSS Rules

- **Shadow DOM Isolation:** All in-page UI injected by `content.ts` MUST be attached inside an isolated Shadow DOM (`attachShadow({ mode: 'open' })`) to prevent third-party host page scripts from reading or tampering with ACAM elements.
- **Safe DOM Construction:**
  - NEVER use `eval()`, `new Function()`, or dynamic code execution.
  - Prefer explicit DOM instantiation (`document.createElement`, `element.textContent`, or validated SVG/templates) over raw `innerHTML` containing external or URL-derived text.

---

## 5. Verification & Pre-Commit Gates

Before submitting any code changes, the following checks MUST pass cleanly:
```bash
# 1. Strict TypeScript validation
npm run typecheck

# 2. Production bundling
npm run build

# 3. Automated Guardrails Suite (Static AST + Dynamic Network/Perf Tests)
npm run check:guardrails
```
