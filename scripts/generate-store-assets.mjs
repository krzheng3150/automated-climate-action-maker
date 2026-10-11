import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');
const assetsDir = path.join(projectRoot, 'assets', 'store');
mkdirSync(assetsDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();

  // 1. Small Promo Tile (440x280)
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
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
        padding: 4px 12px;
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

  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 2 });
  await page.setContent(promoTileHtml);
  const promoPath = path.join(assetsDir, 'promo-small-440x280.png');
  await page.screenshot({ path: promoPath, clip: { x: 0, y: 0, width: 440, height: 280 } });
  console.log(`[Store Asset] Generated ${promoPath} (440x280)`);

  // 2. Marquee Promo Tile (1400x560)
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
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #ffffff;
        padding: 80px 100px;
        overflow: hidden;
        position: relative;
      }
      .content {
        max-width: 720px;
        z-index: 2;
      }
      .badge-row {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
      }
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
      h1 span {
        color: #34d399;
      }
      p {
        font-size: 20px;
        color: #d1fae5;
        line-height: 1.5;
      }
      .card-preview {
        width: 380px;
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        padding: 28px;
        color: #111827;
        z-index: 2;
      }
      .card-preview .title {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 12px;
        color: #065f46;
      }
      .card-preview .stat {
        font-size: 32px;
        font-weight: 800;
        color: #047857;
        margin-bottom: 4px;
      }
      .card-preview .sub {
        font-size: 13px;
        color: #6b7280;
        line-height: 1.4;
      }
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

  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 2 });
  await page.setContent(marqueeHtml);
  const marqueePath = path.join(assetsDir, 'marquee-promo-1400x560.png');
  await page.screenshot({ path: marqueePath, clip: { x: 0, y: 0, width: 1400, height: 560 } });
  console.log(`[Store Asset] Generated ${marqueePath} (1400x560)`);

  // 3. Store Screenshot (1280x800)
  const screenshotHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1280px;
        height: 800px;
        background: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
      }
      .browser-window {
        width: 1100px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        border: 1px solid #e5e7eb;
      }
      .browser-bar {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        padding: 12px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .dots {
        display: flex;
        gap: 6px;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }
      .dot.red { background: #ef4444; }
      .dot.yellow { background: #f59e0b; }
      .dot.green { background: #10b981; }
      .address-bar {
        flex: 1;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 13px;
        color: #4b5563;
      }
      .content-area {
        height: 580px;
        display: flex;
        padding: 40px;
        gap: 40px;
        background: #fafafa;
      }
      .popup-box {
        width: 360px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
        padding: 20px;
        border: 1px solid #e5e7eb;
      }
      .info-side {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .info-side h2 {
        font-size: 32px;
        font-weight: 800;
        color: #064e3b;
        margin-bottom: 16px;
      }
      .info-side p {
        font-size: 16px;
        color: #4b5563;
        line-height: 1.6;
        margin-bottom: 24px;
      }
      .feature-list {
        list-style: none;
      }
      .feature-list li {
        font-size: 14px;
        color: #065f46;
        font-weight: 600;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
    </style>
  </head>
  <body>
    <div class="browser-window">
      <div class="browser-bar">
        <div class="dots">
          <div class="dot red"></div>
          <div class="dot yellow"></div>
          <div class="dot green"></div>
        </div>
        <div class="address-bar">chrome-extension://acam/popup.html</div>
      </div>
      <div class="content-area">
        <div class="popup-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="font-weight: 800; font-size: 18px; color: #065f46;">🌿 ACAM</span>
            <span style="background: #ecfdf5; color: #065f46; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px;">100% On-Device</span>
          </div>
          <div style="background: #ecfdf5; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="font-size: 11px; color: #065f46; font-weight: 700;">ON-DEVICE HISTORY STREAM</div>
            <div style="font-size: 13px; font-weight: 700; color: #047857; margin-top: 4px;">Computation Complete</div>
            <div style="font-size: 11px; color: #059669; margin-top: 2px;">2,000 local SQLite items classified</div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px;">
            <div style="background: #f9fafb; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #6b7280;">Google Hits</div>
              <div style="font-size: 16px; font-weight: 800; color: #111827;">142</div>
            </div>
            <div style="background: #f9fafb; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #6b7280;">Non-Google</div>
              <div style="font-size: 16px; font-weight: 800; color: #111827;">358</div>
            </div>
            <div style="background: #f9fafb; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #6b7280;">Total Visits</div>
              <div style="font-size: 16px; font-weight: 800; color: #111827;">500</div>
            </div>
          </div>
          <div style="font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 12px;">
            🔒 Zero outbound network requests
          </div>
        </div>
        <div class="info-side">
          <h2>Private Climate Intelligence In Your Browser</h2>
          <p>ACAM computes your browsing footprint locally without transmitting URLs, personal records, or session tokens to the cloud.</p>
          <ul class="feature-list">
            <li>✓ 100% on-device SQLite analysis</li>
            <li>✓ Zero outbound network requests (CSP strictly locked)</li>
            <li>✓ Instant circular economy alternatives on product pages</li>
            <li>✓ Atomic local cache purge at any time</li>
          </ul>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.setContent(screenshotHtml);
  const screenshotPath = path.join(assetsDir, 'screenshot-1-1280x800.png');
  await page.screenshot({ path: screenshotPath, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`[Store Asset] Generated ${screenshotPath} (1280x800)`);
} finally {
  await browser.close();
}
