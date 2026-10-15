import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');
const assetsDir = path.join(projectRoot, 'assets', 'store');
mkdirSync(assetsDir, { recursive: true });

console.log('[Store Assets] Launching headless browser to generate CWS assets...');

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();

  // Helper for shared browser window template
  function wrapInBrowserWindow(addressText, contentHtml) {
    return `
    <div class="browser-window">
      <div class="browser-bar">
        <div class="dots">
          <div class="dot red"></div>
          <div class="dot yellow"></div>
          <div class="dot green"></div>
        </div>
        <div class="address-bar">${addressText}</div>
        <div class="browser-actions">
          <span class="toolbar-icon">🌿</span>
          <span class="toolbar-icon">⋮</span>
        </div>
      </div>
      <div class="content-area">
        ${contentHtml}
      </div>
    </div>
    `;
  }

  const baseStyles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1280px;
      height: 800px;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      overflow: hidden;
    }
    .browser-window {
      width: 1216px;
      height: 736px;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .browser-bar {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .dots { display: flex; gap: 7px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot.red { background: #ef4444; }
    .dot.yellow { background: #f59e0b; }
    .dot.green { background: #10b981; }
    .address-bar {
      flex: 1;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 7px 16px;
      font-size: 13px;
      color: #475569;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .browser-actions {
      display: flex;
      gap: 12px;
      color: #64748b;
      font-size: 16px;
    }
    .content-area {
      flex: 1;
      display: flex;
      position: relative;
      background: #f8fafc;
      overflow: hidden;
    }
  `;

  // =========================================================================
  // 1. Small Promo Tile (440x280)
  // =========================================================================
  console.log('[Store Assets] Rendering Promo Tile Small (440x280)...');
  const promoTileHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 440px;
        height: 280px;
        background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #ffffff;
        text-align: center;
        padding: 24px;
        overflow: hidden;
        position: relative;
      }
      .circle-bg {
        position: absolute;
        width: 320px;
        height: 320px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0) 70%);
        top: -60px;
        right: -60px;
      }
      .icon {
        font-size: 52px;
        margin-bottom: 8px;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.25));
      }
      h1 {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.5px;
        margin-bottom: 6px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      p {
        font-size: 13px;
        color: #a7f3d0;
        max-width: 340px;
        line-height: 1.4;
        margin-bottom: 12px;
      }
      .badge {
        display: inline-block;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(8px);
        padding: 5px 14px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #ecfdf5;
      }
    </style>
  </head>
  <body>
    <div class="circle-bg"></div>
    <div class="icon">🌿</div>
    <h1>Automated Climate Action</h1>
    <p>On-device browsing footprint analysis & sustainable choices with zero data egress.</p>
    <div class="badge">🔒 100% On-Device • Zero Telemetry</div>
  </body>
  </html>
  `;

  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  await page.setContent(promoTileHtml);
  const promoPath = path.join(assetsDir, 'promo-small-440x280.png');
  await page.screenshot({ path: promoPath, clip: { x: 0, y: 0, width: 440, height: 280 } });
  console.log(`[Store Asset] ✓ Generated ${promoPath} (440x280)`);

  // =========================================================================
  // 2. Marquee Promo Tile (1400x560)
  // =========================================================================
  console.log('[Store Assets] Rendering Marquee Promo Tile (1400x560)...');
  const marqueeHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1400px;
        height: 560px;
        background: linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #ffffff;
        padding: 80px 100px;
        overflow: hidden;
        position: relative;
      }
      .content { max-width: 720px; z-index: 2; }
      .badge-row { display: flex; gap: 12px; margin-bottom: 20px; }
      .pill {
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid rgba(16, 185, 129, 0.4);
        padding: 6px 16px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        color: #a7f3d0;
      }
      h1 {
        font-size: 52px;
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -1px;
        margin-bottom: 18px;
      }
      h1 span { color: #34d399; }
      p { font-size: 20px; color: #d1fae5; line-height: 1.5; }
      .card-preview {
        width: 380px;
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        padding: 28px;
        color: #111827;
        z-index: 2;
      }
      .card-preview .title { font-size: 18px; font-weight: 800; margin-bottom: 12px; color: #064e3b; }
      .card-preview .stat { font-size: 36px; font-weight: 800; color: #047857; margin-bottom: 4px; }
      .card-preview .sub { font-size: 13px; color: #6b7280; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="content">
      <div class="badge-row">
        <span class="pill">🌿 Privacy-First Climate Tech</span>
        <span class="pill">🔒 100% Local Execution</span>
      </div>
      <h1>Automated Climate Action <span>Maker</span></h1>
      <p>Analyze your browsing footprint on-device, discover circular shopping alternatives, and take civic climate actions—with zero outbound telemetry.</p>
    </div>
    <div class="card-preview">
      <div class="title">🌿 ACAM On-Device Summary</div>
      <div class="stat">65.0 kg</div>
      <div class="sub">Embodied CO₂ Avoided via Verified Circular Alternatives</div>
      <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #059669;">
        <span>🔒 Zero Data Transmitted</span>
        <span>✓ 100% On-Device</span>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
  await page.setContent(marqueeHtml);
  const marqueePath = path.join(assetsDir, 'marquee-promo-1400x560.png');
  await page.screenshot({ path: marqueePath, clip: { x: 0, y: 0, width: 1400, height: 560 } });
  console.log(`[Store Asset] ✓ Generated ${marqueePath} (1400x560)`);

  // =========================================================================
  // 3. Screenshot 1: Dashboard & On-Device Analysis (1280x800)
  // =========================================================================
  console.log('[Store Assets] Rendering Screenshot 1: Dashboard & Footprint Analysis (1280x800)...');
  const screenshot1Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      ${baseStyles}
      .dashboard-layout {
        display: flex;
        width: 100%;
        padding: 48px;
        gap: 56px;
        align-items: center;
      }
      .popup-mockup {
        width: 360px;
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border: 1px solid #e2e8f0;
        padding: 22px;
      }
      .info-side { flex: 1; }
      .header-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #ecfdf5;
        color: #065f46;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 4px 12px;
        border-radius: 999px;
        margin-bottom: 16px;
      }
      h2 { font-size: 34px; font-weight: 800; color: #0f172a; line-height: 1.25; margin-bottom: 16px; }
      h2 span { color: #059669; }
      p.lead { font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
      .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .feat-item {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px;
      }
      .feat-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
      .feat-desc { font-size: 12px; color: #64748b; line-height: 1.4; }
      .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0; }
      .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
      .stat-val { font-size: 18px; font-weight: 800; color: #0f172a; }
      .stat-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
      .domain-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
      .domain-name { font-weight: 600; color: #334155; }
      .domain-cnt { color: #059669; font-weight: 700; }
    </style>
  </head>
  <body>
    ${wrapInBrowserWindow('chrome-extension://acam/popup.html', `
      <div class="dashboard-layout">
        <div class="popup-mockup">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🌿</span>
              <strong style="font-size: 16px; color: #0f172a;">ACAM</strong>
            </div>
            <span style="background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px;">100% ON-DEVICE</span>
          </div>
          <div style="background: #ecfdf5; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: 700; color: #065f46;">LOCAL FOOTPRINT READY</div>
            <div style="font-size: 13px; font-weight: 800; color: #047857; margin-top: 2px;">500 visits analyzed locally</div>
          </div>
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-val" style="color: #4285f4;">142</div>
              <div class="stat-lbl">Google</div>
            </div>
            <div class="stat-card">
              <div class="stat-val" style="color: #059669;">358</div>
              <div class="stat-lbl">Non-Google</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">500</div>
              <div class="stat-lbl">Total</div>
            </div>
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #475569; margin: 12px 0 6px 0; text-transform: uppercase;">Top Domains (Raw Local Sample)</div>
          <div class="domain-row"><span class="domain-name">theguardian.com</span><span class="domain-cnt">48 visits</span></div>
          <div class="domain-row"><span class="domain-name">backmarket.com</span><span class="domain-cnt">32 visits</span></div>
          <div class="domain-row"><span class="domain-name">nytimes.com</span><span class="domain-cnt">26 visits</span></div>
          <div class="domain-row" style="border: none;"><span class="domain-name">github.com</span><span class="domain-cnt">24 visits</span></div>
          <div style="margin-top: 16px; padding-top: 10px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
            🔒 Zero outbound network requests
          </div>
        </div>
        <div class="info-side">
          <div class="header-pill">🛡️ Strict Local Sandbox</div>
          <h2>Analyze Browsing Emissions <span>Without Leaving Your Device</span></h2>
          <p class="lead">ACAM discovers your digital carbon habits by categorizing browsing patterns on-device. Zero history, URLs, or search terms are ever transmitted to the cloud.</p>
          <div class="feature-grid">
            <div class="feat-item">
              <div class="feat-title">💾 Sandboxed SQLite</div>
              <div class="feat-desc">Queries Chromium records directly on localhost with zero API egress.</div>
            </div>
            <div class="feat-item">
              <div class="feat-title">🧹 URL Minimization</div>
              <div class="feat-desc">Never retains full paths or query tokens. Bounded domain frequencies only.</div>
            </div>
            <div class="feat-item">
              <div class="feat-title">⚡ Zero Telemetry</div>
              <div class="feat-desc">No remote tracking SDKs, no Google Analytics, no third-party servers.</div>
            </div>
            <div class="feat-item">
              <div class="feat-title">🗑️ Atomic Purge</div>
              <div class="feat-desc">One click immediately wipes all stored snapshots from LevelDB storage.</div>
            </div>
          </div>
        </div>
      </div>
    `)}
  </body>
  </html>
  `;

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setContent(screenshot1Html);
  const screenshot1Path = path.join(assetsDir, 'screenshot-1-1280x800.png');
  await page.screenshot({ path: screenshot1Path, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`[Store Asset] ✓ Generated ${screenshot1Path} (1280x800)`);

  // =========================================================================
  // 4. Screenshot 2: Live Compute Stream & Progress Tracking (1280x800)
  // =========================================================================
  console.log('[Store Assets] Rendering Screenshot 2: Live Compute Stream (1280x800)...');
  const screenshot2Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      ${baseStyles}
      .stream-layout {
        display: flex;
        width: 100%;
        padding: 48px;
        gap: 56px;
        align-items: center;
      }
      .popup-mockup {
        width: 360px;
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
        padding: 22px;
      }
      .progress-bar-container {
        height: 8px;
        background: #e2e8f0;
        border-radius: 999px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .progress-fill {
        height: 100%;
        width: 65%;
        background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        border-radius: 999px;
      }
      .pulse-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.3);
      }
      .step-item {
        display: flex;
        gap: 12px;
        margin-bottom: 14px;
        font-size: 13px;
      }
      .step-icon {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .step-icon.done { background: #d1fae5; color: #047857; }
      .step-icon.active { background: #059669; color: #ffffff; }
      .step-icon.pending { background: #f1f5f9; color: #94a3b8; }
      .step-content strong { color: #0f172a; display: block; margin-bottom: 2px; }
      .step-content p { color: #64748b; font-size: 11px; line-height: 1.4; }
      .side-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    ${wrapInBrowserWindow('chrome-extension://acam/popup.html', `
      <div class="stream-layout">
        <div class="popup-mockup">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <strong style="font-size: 16px; color: #0f172a;">🌿 ACAM Live Engine</strong>
            <span style="font-size: 12px; font-weight: 700; color: #059669;">Step 2 of 3</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-fill"></div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <div class="pulse-dot"></div>
              <strong style="font-size: 13px; color: #0f172a;">Memory Ingestion Active</strong>
            </div>
            <p style="font-size: 12px; color: #64748b; line-height: 1.4;">
              Loaded 2,000 history items into local RAM. Evaluating regex & domain frequencies...
            </p>
          </div>
          <div class="step-item">
            <div class="step-icon done">✓</div>
            <div class="step-content">
              <strong>Step 1: Storage Initialized</strong>
              <p>Connected to Chromium on-device SQLite records (0 network traffic).</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon active">2</div>
            <div class="step-content">
              <strong>Step 2: Stream Evaluation</strong>
              <p>Extracting unique hostnames and classifying Google vs Non-Google.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon pending">3</div>
            <div class="step-content">
              <strong>Step 3: Snapshot Commit</strong>
              <p>Stores aggregate metrics in LevelDB and dispatches completion.</p>
            </div>
          </div>
        </div>
        <div style="flex: 1;">
          <span style="background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 999px;">Transparent Architecture</span>
          <h2 style="font-size: 34px; font-weight: 800; color: #0f172a; margin: 16px 0 12px 0;">Visual Live Compute Stream</h2>
          <p style="font-size: 16px; color: #475569; line-height: 1.6;">No hidden background telemetry. Watch ACAM's stream pipe local browsing items through an observable multi-step pipeline directly inside the popup interface.</p>
          <div class="side-card">
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Continuous Port Communication</div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              Built using Chrome's persistent messaging port (<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #059669;">chrome.runtime.connect</code>). The service worker streams progress updates to the foreground in &lt;1.5 seconds.
            </p>
          </div>
        </div>
      </div>
    `)}
  </body>
  </html>
  `;

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setContent(screenshot2Html);
  const screenshot2Path = path.join(assetsDir, 'screenshot-2-1280x800.png');
  await page.screenshot({ path: screenshot2Path, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`[Store Asset] ✓ Generated ${screenshot2Path} (1280x800)`);

  // =========================================================================
  // 5. Screenshot 3: Contextual Circular Shopping Nudge (1280x800)
  // =========================================================================
  console.log('[Store Assets] Rendering Screenshot 3: Circular Shopping Intervention (1280x800)...');
  const screenshot3Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      ${baseStyles}
      .store-page {
        width: 100%;
        display: flex;
        padding: 40px;
        gap: 40px;
        position: relative;
      }
      .product-preview {
        flex: 1;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 32px;
      }
      .prod-category { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px; }
      .prod-title { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
      .prod-price { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
      .prod-specs { font-size: 14px; color: #64748b; line-height: 1.6; max-width: 500px; }
      .shadow-dom-card {
        position: absolute;
        bottom: 40px;
        right: 40px;
        width: 360px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 18px;
        z-index: 100;
      }
      .card-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #d1fae5;
        color: #065f46;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 999px;
        margin-bottom: 8px;
      }
      .card-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
      .card-desc { font-size: 12px; color: #475569; line-height: 1.4; margin-bottom: 12px; }
      .target-box {
        background: #f1f5f9;
        border-left: 3px solid #10b981;
        padding: 8px 10px;
        border-radius: 4px;
        font-size: 12px;
        color: #334155;
        font-style: italic;
        margin-bottom: 12px;
      }
      .circular-buttons { display: flex; gap: 8px; }
      .c-btn {
        flex: 1;
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #10b981;
        border-radius: 8px;
        padding: 8px 4px;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    ${wrapInBrowserWindow('https://store.example.com/products/macbook-pro-m3', `
      <div class="store-page">
        <div class="product-preview">
          <div class="prod-category">Laptops &gt; High Performance</div>
          <div class="prod-title">MacBook Pro 16" - M3 Pro (36GB RAM, 512GB SSD)</div>
          <div class="prod-price">$2,499.00</div>
          <p class="prod-specs">Next-generation workstation silicon designed for high-throughput computing. In stock for immediate factory dispatch.</p>
          <div style="margin-top: 32px; display: flex; gap: 12px;">
            <button style="background: #0f172a; color: #fff; border: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px;">Add to Cart</button>
            <button style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">Save for Later</button>
          </div>
        </div>
        <div class="shadow-dom-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="card-badge">♻️ Compare Circular Options</span>
            <span style="color: #94a3b8; font-size: 18px; cursor: pointer;">×</span>
          </div>
          <div class="card-title">Find Refurbished Alternatives</div>
          <p class="card-desc">Manufacturing accounts for ~80% of electronics emissions. Compare verified second-life options to avoid high factory carbon.</p>
          <div class="target-box">Target: MacBook Pro M3 (Save up to ~65 kg CO₂e)</div>
          <div class="circular-buttons">
            <div class="c-btn">Back Market</div>
            <div class="c-btn">eBay Refurbished</div>
            <div class="c-btn">Swappa</div>
          </div>
        </div>
      </div>
    `)}
  </body>
  </html>
  `;

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setContent(screenshot3Html);
  const screenshot3Path = path.join(assetsDir, 'screenshot-3-1280x800.png');
  await page.screenshot({ path: screenshot3Path, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`[Store Asset] ✓ Generated ${screenshot3Path} (1280x800)`);

  // =========================================================================
  // 6. Screenshot 4: Civic Action Intervention (1280x800)
  // =========================================================================
  console.log('[Store Assets] Rendering Screenshot 4: Civic Action Intervention (1280x800)...');
  const screenshot4Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      ${baseStyles}
      .news-page {
        width: 100%;
        display: flex;
        padding: 40px;
        gap: 40px;
        position: relative;
      }
      .article-content {
        flex: 1;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 36px;
      }
      .tag { font-size: 12px; font-weight: 700; color: #dc2626; text-transform: uppercase; margin-bottom: 8px; }
      .art-title { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.3; margin-bottom: 14px; }
      .art-body { font-size: 14px; color: #475569; line-height: 1.7; }
      .shadow-dom-card {
        position: absolute;
        bottom: 40px;
        right: 40px;
        width: 360px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
        padding: 18px;
        z-index: 100;
      }
      .badge-civic {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #fef3c7;
        color: #92400e;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 999px;
        margin-bottom: 8px;
      }
      .primary-action-btn {
        width: 100%;
        background: #059669;
        color: #ffffff;
        border: none;
        padding: 10px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
      }
    </style>
  </head>
  <body>
    ${wrapInBrowserWindow('https://news.example.com/environment/clean-energy-transition-2026', `
      <div class="news-page">
        <div class="article-content">
          <div class="tag">Climate Policy &amp; Energy</div>
          <div class="art-title">Regional Clean Energy Transition Docket Moves to Public Comment Phase</div>
          <p class="art-body">Regulatory commissions have opened a 30-day window for constituent feedback regarding regional grid modernization and solar infrastructure upgrades across municipal districts...</p>
        </div>
        <div class="shadow-dom-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="badge-civic">🏛️ Civic Action Nudge</span>
            <span style="color: #94a3b8; font-size: 18px; cursor: pointer;">×</span>
          </div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 6px 0;">Turn Climate Anxiety into Action</div>
          <p style="font-size: 12px; color: #475569; line-height: 1.4; margin-bottom: 12px;">Reading climate policy? Send a 1-click prompt to your local representative supporting regional clean energy transition.</p>
          <div style="background: #f1f5f9; border-left: 3px solid #10b981; padding: 8px 10px; border-radius: 4px; font-size: 11px; color: #334155; font-style: italic; margin-bottom: 12px;">
            "Urging swift passage of renewable energy standards in our district..."
          </div>
          <div class="primary-action-btn">Send with 1-Click (+50 pts)</div>
        </div>
      </div>
    `)}
  </body>
  </html>
  `;

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setContent(screenshot4Html);
  const screenshot4Path = path.join(assetsDir, 'screenshot-4-1280x800.png');
  await page.screenshot({ path: screenshot4Path, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`[Store Asset] ✓ Generated ${screenshot4Path} (1280x800)`);

  // =========================================================================
  // 7. Screenshot 5: Data Sovereignty & User Control (1280x800)
  // =========================================================================
  console.log('[Store Assets] Rendering Screenshot 5: Data Sovereignty & User Control (1280x800)...');
  const screenshot5Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      ${baseStyles}
      .privacy-layout {
        display: flex;
        width: 100%;
        padding: 48px;
        gap: 56px;
        align-items: center;
      }
      .controls-card {
        width: 380px;
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
        padding: 24px;
      }
      .toggle-box {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 16px;
      }
      .purge-btn {
        width: 100%;
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
        border-radius: 8px;
        padding: 10px;
        font-weight: 700;
        font-size: 13px;
        text-align: center;
        cursor: pointer;
      }
      .security-box {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 18px;
        margin-bottom: 12px;
      }
    </style>
  </head>
  <body>
    ${wrapInBrowserWindow('chrome-extension://acam/popup.html', `
      <div class="privacy-layout">
        <div class="controls-card">
          <strong style="font-size: 16px; color: #0f172a; display: block; margin-bottom: 16px;">🌿 User Sovereignty Controls</strong>
          <div class="toggle-box">
            <div>
              <strong style="font-size: 13px; color: #0f172a; display: block;">Background Auto-Scan</strong>
              <span style="font-size: 11px; color: #64748b;">Activity-driven on-device batching</span>
            </div>
            <span style="background: #10b981; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px;">ENABLED</span>
          </div>
          <div class="toggle-box">
            <div>
              <strong style="font-size: 13px; color: #0f172a; display: block;">Shadow DOM Encapsulation</strong>
              <span style="font-size: 11px; color: #64748b;">Host scripts cannot inspect UI</span>
            </div>
            <span style="background: #10b981; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px;">LOCKED</span>
          </div>
          <div class="purge-btn">Purge Local Cache &amp; Delete Snapshots</div>
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 10px;">
            Atomically wipes all stored LevelDB metrics.
          </p>
        </div>
        <div style="flex: 1;">
          <span style="background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 999px;">Zero-Telemetry Guarantee</span>
          <h2 style="font-size: 34px; font-weight: 800; color: #0f172a; margin: 16px 0 12px 0;">Total Control Over Your Data</h2>
          <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">ACAM is designed from first principles with zero remote servers. You have total authority to configure scanning, inspect what is seen, or instantly delete everything.</p>
          <div class="security-box">
            <strong style="font-size: 14px; color: #065f46; display: flex; align-items: center; gap: 6px;">🔒 CSP Hardened to 'self'</strong>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Content Security Policy strictly blocks any external network connections from extension pages.</p>
          </div>
          <div class="security-box">
            <strong style="font-size: 14px; color: #065f46; display: flex; align-items: center; gap: 6px;">🚫 No Account or Login Required</strong>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Works immediately upon installation. No emails, authentication tokens, or personal identifiers collected.</p>
          </div>
        </div>
      </div>
    `)}
  </body>
  </html>
  `;

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setContent(screenshot5Html);
  const screenshot5Path = path.join(assetsDir, 'screenshot-5-1280x800.png');
  await page.screenshot({ path: screenshot5Path, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`[Store Asset] ✓ Generated ${screenshot5Path} (1280x800)`);

  console.log('\n[SUCCESS] All 7 Chrome Web Store promo & screenshot assets generated cleanly.');
} finally {
  await browser.close();
}
