# Chrome Web Store Submission Dossier & Developer Guide

*Extension:* **Automated Climate Action Maker (ACAM)**  
*Version:* `1.0.0`  
*Manifest Version:* `3`  
*Target Release:* Public Distribution (Chrome Web Store)

---

## 1. Store Listing Information (Listing Tab)

### Product Details
- **Extension Name:** `Automated Climate Action Maker`
- **Short Description (Manifest, max 132 chars):**
  > `Scans browsing footprints on-device to suggest and automate climate-positive decisions with zero network telemetry.`
- **Category:** `Productivity` (Secondary: `Lifestyle`)
- **Default Language:** `English`

### Detailed Description (Store Description Field, Markdown formatted for readability)
```markdown
Automated Climate Action Maker (ACAM) empowers you to understand your digital browsing footprint and take effortless climate action—with a strict guarantee of 100% on-device privacy and zero external network telemetry.

🌿 KEY FEATURES

1. On-Device Carbon Footprint Analysis:
   Inspect your local browsing activity to understand digital carbon patterns and domain distribution without exposing your personal history to the cloud.

2. Contextual Circular Economy Interventions:
   When viewing product and electronics pages across the web, ACAM highlights refurbished and second-life alternatives (e.g., Back Market, eBay Refurbished, Swappa) to avoid the heavy embodied carbon of new manufacturing.

3. Civic Climate Action Prompts:
   When reading regional climate policy and environmental journalism, ACAM surfaces 1-click civic engagement opportunities to voice support for renewable energy transitions to your representatives.

4. Gamified Impact & Civic Points:
   Earn civic points and track estimated kilograms of CO₂ avoided through conscious digital and circular habits.

5. Visual Live Compute Stream:
   Watch the on-device analysis execute step-by-step in real time directly inside the popup interface.

🔒 ABSOLUTE PRIVACY GUARANTEE: ZERO OUTBOUND TELEMETRY

ACAM is architected from the ground up to protect user data sovereignty:
• 100% Local Execution: All processing runs directly in your browser's local sandbox.
• Zero Network Primitives: The extension contains no fetch(), XMLHttpRequest, WebSocket, or remote tracking SDKs.
• No Cloud Servers: ACAM operates no telemetry endpoints, analytics collectors, or external databases.
• No Raw URL Retention: Full URLs, page paths, and query parameters are never written to storage. Only bounded, aggregated hostnames are tallied.
• Atomic User Purge: Clear all stored domain metrics and history snapshots at any time with a single click.

Open Source & Auditable: ACAM's complete source code and automated security guardrails are open for public verification.
```

---

## 2. Privacy Practices Tab (Submission Questionnaire)

### A. Single Purpose Statement
*Field: "Single Purpose Description"*
> Automated Climate Action Maker (ACAM) analyzes browsing activity on-device to compute digital carbon footprint estimates and delivers contextual, non-intrusive circular shopping alternatives and civic engagement prompts on climate-relevant web pages—operating 100% locally with zero external network telemetry.

---

### B. Permission Justifications
*Enter the corresponding justification into each generated permission field:*

#### 1. `history`
> **Justification:**  
> Required to read Chromium visit counts on-device. ACAM queries local history SQLite records to compute aggregate domain-level frequencies, calculate digital carbon projections, and assign behavioral archetypes. All processing occurs strictly within local browser memory with zero network egress. Full URLs, paths, and query parameters are never persisted, and persisted domain frequency tallies are capped at 100 entries. The user can atomically purge all stored data at any time.

#### 2. `storage`
> **Justification:**  
> Required to persist on-device digital footprint snapshots, cumulative CO₂ savings, earned civic impact points, and user preference toggles (such as the Background Auto-Scan switch) in sandboxed `chrome.storage.local`.

#### 3. `alarms`
> **Justification:**  
> Required to schedule periodic, low-frequency background synchronization (a 12-hour conservative fallback alarm) to aggregate pending visit tallies without running persistent, battery-draining background timers in the Manifest V3 service worker.

#### 4. Host Permissions / Content Script Match (`<all_urls>`)
> **Justification:**  
> The extension requires broad matching because its two primary features must function across an open and decentralized web:
> 1. Contextual Climate Journalism: Environmental news and policy articles are published across thousands of independent news portals, local newspapers, universities, and scientific blogs. Hardcoding a static domain list would break functionality on legitimate climate articles matching paths like `/climate` or `global-warming`.
> 2. Circular Marketplace Comparison: E-commerce occurs across an open web of retail storefronts. Broad matching allows ACAM to inspect product microdata (Schema.org / OpenGraph) to offer certified refurbished alternatives.
> 
> Security & Privacy Mitigations:
> • Zero Outbound Telemetry: The extension declares zero host permissions for network egress and its Content Security Policy is locked to 'self'.
> • Isolated Shadow DOM: All injected UI elements are encapsulated in an isolated Shadow DOM to prevent third-party host scripts from tampering with extension elements.
> • Safe DOM Construction: No dynamic code execution (eval, new Function) or innerHTML interpolation is used.

---

### C. Data Usage Declarations
Under the **Data usage** section, complete the checkboxes as follows:

| Category | Declare? | Purpose | Sold / Transferred / Advertised? |
| :--- | :--- | :--- | :--- |
| **Web History** | **YES** | Functionality of the extension | **NO** (Not sold, not transferred, not used for credit, not used for ads) |
| **Personally Identifiable Info (PII)** | **NO** | — | — |
| **Authentication Info** | **NO** | — | — |
| **Personal Communications** | **NO** | — | — |
| **Location Data** | **NO** | — | — |
| **Financial & Payment Info** | **NO** | — | — |
| **User Activity / Mouse clicks** | **NO** | — | — |
| **Website Content** | **NO** | — | — |

---

### D. Limited Use Certification Checkboxes
Confirm all four statements:
- [x] *I certify that the collection and use of user data is for single-purpose functionality.*
- [x] *I certify that user data is not transferred to third parties (except as permitted under policy).*
- [x] *I certify that user data is not used for personalized advertising.*
- [x] *I certify that user data is not used for creditworthiness determination.*

---

### E. Public Privacy Policy Link
- **Public URL:** `https://<YOUR_GITHUB_USERNAME>.github.io/automated-climate-action-maker/PRIVACY_POLICY`
- *(Must be reachable over HTTPS prior to submitting the form).*

---

### F. EU Digital Services Act (DSA) Trader Declaration
- **Declaration:** Select **"Non-Trader"** (unless registering as an incorporated commercial enterprise).
- Non-traders are exempt from displaying physical street addresses and personal phone numbers publicly on the Chrome Web Store listing.

---

## 3. Reviewer Testing Instructions & Demo Harness
Provide these instructions in the **"Notes for the reviewer"** box so the Google review team can verify the extension in under 60 seconds:

```
TESTING & VERIFICATION INSTRUCTIONS FOR REVIEWERS:

1. Live On-Device Compute Stream:
   - Click the ACAM icon in the Chrome toolbar.
   - Click "Run On-Device Analysis".
   - Observe the real-time progress stream (Storage Access -> Memory Ingestion -> Domain Classification -> Stored Locally).
   - Observe the Google vs. Non-Google visit tally and domain breakdown.

2. Contextual Interventions (Deterministic Test Harness):
   To test in-page interventions immediately without navigating to specific live shopping or news sites, open any webpage and append the demo query parameters:
   
   • Scenario A (Civic Action Nudge):
     Navigate to: https://example.com/?acam_scenario=a
     Scroll down 150px.
     Result: An encapsulated Shadow DOM card appears offering a 1-click civic message to a representative (+50 civic points).
     
   • Scenario C (Circular Electronics Nudge):
     Navigate to: https://example.com/?acam_scenario=c&item=MacBook+Pro+M3
     Wait 1.2s.
     Result: A Shadow DOM card appears offering refurbished search shortcuts on Back Market, eBay Refurbished, and Swappa (+80 civic points).

3. Zero Network Egress Verification:
   Open Chrome DevTools -> Network Tab. Filter by all requests. Trigger any action or scan. Zero outbound HTTP/HTTPS requests are dispatched by the extension background worker or content script.
```

---

## 4. Programmatic Publishing Pipeline (GitHub Actions + CWS API)

Once the initial item is manually created on the developer dashboard, you can automate future releases programmatically using the Chrome Web Store API.

### Required Secrets in GitHub Repository Settings (`Settings` -> `Secrets and variables` -> `Actions`):
- `CWS_CLIENT_ID`: Google Cloud OAuth2 Client ID
- `CWS_CLIENT_SECRET`: Google Cloud OAuth2 Client Secret
- `CWS_REFRESH_TOKEN`: Google Cloud OAuth2 Refresh Token
- `CWS_EXTENSION_ID`: The 32-character extension ID assigned by CWS after initial creation

### GitHub Actions Workflow File (`.github/workflows/release-cws.yml`):
```yaml
name: Publish to Chrome Web Store

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Test Guardrails
        run: npm test

      - name: Package Production ZIP
        run: npm run pack:store

      - name: Upload & Publish to Chrome Web Store
        uses: fregante/chrome-webstore-upload@v4
        with:
          client-id: ${{ secrets.CWS_CLIENT_ID }}
          client-secret: ${{ secrets.CWS_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CWS_REFRESH_TOKEN }}
          extension-id: ${{ secrets.CWS_EXTENSION_ID }}
          file-name: acam-v1.0.0.zip
          publish: true
```

---

## 5. Store Assets Upload Inventory (Verified 24-bit RGB PNG, No Alpha)

All 7 required and recommended visual assets have been pre-rendered at exact store pixel specifications:

| Asset Name | Target Canvas | File Path | In-Store Caption / Purpose |
| :--- | :--- | :--- | :--- |
| **Small Promo Tile** | `440 x 280` | `assets/store/promo-small-440x280.png` | Search results and category grid preview |
| **Marquee Promo Tile** | `1400 x 560` | `assets/store/marquee-promo-1400x560.png` | Featured hero banner on Chrome Web Store homepage |
| **Screenshot 1** | `1280 x 800` | `assets/store/screenshot-1-1280x800.png` | *100% On-Device Footprint Analysis Dashboard* |
| **Screenshot 2** | `1280 x 800` | `assets/store/screenshot-2-1280x800.png` | *Live Transparent Compute Stream & Progress Tracking* |
| **Screenshot 3** | `1280 x 800` | `assets/store/screenshot-3-1280x800.png` | *Compare Verified Refurbished & Circular Alternatives* |
| **Screenshot 4** | `1280 x 800` | `assets/store/screenshot-4-1280x800.png` | *Turn Climate News into Measurable Civic Action* |
| **Screenshot 5** | `1280 x 800` | `assets/store/screenshot-5-1280x800.png` | *Complete Data Sovereignty & User Control* |

