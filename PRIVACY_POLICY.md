# Privacy Policy for Automated Climate Action Maker (ACAM)

*Last updated: October 2026*

The **Automated Climate Action Maker (ACAM)** browser extension is designed with a strict **Local-First, Zero-Telemetry Privacy Architecture**. This policy explains how ACAM handles your information and demonstrates our commitment to user privacy and data sovereignty.

---

## 1. Absolute Guarantee: Zero Outbound Telemetry

ACAM operates completely on your local device. Under no circumstance does ACAM transmit, sync, leak, or sell your browsing history, visited URLs, search queries, personal identifiers, or digital carbon metrics to external servers.

- **No Remote Servers:** We do not operate telemetry servers, analytics collectors, or cloud databases.
- **No Third-Party Analytics:** ACAM contains zero third-party tracking libraries, analytics scripts (e.g., Google Analytics, Mixpanel), or error-monitoring SDKs (e.g., Sentry).
- **Hardened Network Sandbox:** The extension's Content Security Policy (CSP) strictly locks execution to `'self'`, and the source code contains zero network egress primitives (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`).

---

## 2. Information Handled & On-Device Processing

ACAM processes certain browsing activity strictly within Chromium's local process memory:

### A. Browsing History & Domain Aggregation
- **What is accessed:** When you trigger an on-device scan or browse with auto-scan enabled, ACAM queries the local Chromium history database.
- **Sanitization & Minimization:** ACAM **never** retains full URLs, page paths, or query parameters (which may contain sensitive search terms or session tokens).
- **Domain-Level Frequencies:** ACAM extracts only top-level hostnames (e.g., `theguardian.com`, `backmarket.com`) and increments local numerical counters to calculate estimated embodied carbon footprints and behavioral archetypes.
- **Bounded Footprint:** Persisted domain maps are capped at a maximum of 100 entries in local browser storage (`chrome.storage.local`) to prevent storage bloat.

### B. Local Impact Metrics & Preferences
- Gamification counters (Civic Points, estimated kilograms of CO₂ avoided) and settings (Background Auto-Scan toggle) are stored locally in `chrome.storage.local`.

---

## 3. Chrome Permissions & Why They Are Needed

In accordance with the Chrome Web Store **Principle of Least Privilege**, ACAM only requests permissions that are directly necessary for its single purpose:

| Permission | Justification |
| :--- | :--- |
| `history` | Required to perform on-device categorization of your browsing activity to compute carbon footprint estimates and behavioral archetypes without external telemetry. |
| `storage` | Required to persist your on-device footprint snapshot, domain tallies, and user preference toggles within Chromium's local sandboxed LevelDB storage. |
| `alarms` | Required to schedule periodic, low-resource synchronization of local footprint data without running battery-draining continuous background timers. |

---

## 4. User Control & Data Deletion

You maintain complete control over your data:

- **Purge Local Cache:** Clicking the **"Purge Local Cache"** button in the ACAM popup immediately and atomically wipes all stored domain metrics, footprint snapshots, and queued visits from `chrome.storage.local`.
- **Toggle Background Auto-Scan:** You can disable real-time activity batching at any time via the toggle in the popup interface.
- **Uninstalling:** Removing the extension from your browser instantly deletes all extension storage and state held by Chromium.

---

## 5. Chrome Web Store Limited Use Disclosure

ACAM's use and transfer of information received from Google APIs adheres to the **Chrome Web Store User Data Policy**, including the **Limited Use** requirements:

1. Data is utilized exclusively to provide on-device carbon footprint insights and contextual sustainability prompts visible directly to the user.
2. Data is never transferred to third parties or used for personalized advertising, credit assessment, or data broker sales.
3. No human reads or has access to your browsing signals.

---

## 6. Open Source Verification & Contact

ACAM is open source and auditable. You can independently verify our zero-network guarantees and source code directly in our repository.

If you have questions, feedback, or security inquiries regarding ACAM's privacy practices, please open an issue in the official repository or contact the maintainers.
