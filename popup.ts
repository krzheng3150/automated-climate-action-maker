/// <reference types="chrome" />

import type { HistoryScanResult, StreamStep } from './index';

document.addEventListener('DOMContentLoaded', async () => {
  const permissionCard = document.getElementById('permission-card') as HTMLElement | null;
  const grantBtn = document.getElementById('grant-btn') as HTMLButtonElement | null;
  const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement | null;
  const btnText = document.getElementById('btn-text') as HTMLElement | null;
  const pulseDot = document.getElementById('pulse-dot') as HTMLElement | null;
  const progressFill = document.getElementById('progress-fill') as HTMLElement | null;
  const stepTitle = document.getElementById('step-title') as HTMLElement | null;
  const stepDetail = document.getElementById('step-detail') as HTMLElement | null;

  const googleCountEl = document.getElementById('google-count') as HTMLElement | null;
  const nonGoogleCountEl = document.getElementById('non-google-count') as HTMLElement | null;
  const totalCountEl = document.getElementById('total-count') as HTMLElement | null;

  const domainsListEl = document.getElementById('domains-list') as HTMLElement | null;
  const lastUpdatedEl = document.getElementById('last-updated') as HTMLElement | null;
  const purgeBtn = document.getElementById('purge-btn') as HTMLButtonElement | null;

  async function checkPermissions(): Promise<boolean> {
    const hasPermission = await chrome.permissions.contains({ permissions: ['history'] });
    if (hasPermission) {
      if (permissionCard) permissionCard.style.display = 'none';
      if (scanBtn) scanBtn.disabled = false;
    } else {
      if (permissionCard) permissionCard.style.display = 'flex';
      if (scanBtn) scanBtn.disabled = true;
      if (stepTitle) stepTitle.textContent = 'Permission Required';
      if (stepDetail) {
        stepDetail.textContent = 'Grant local history permission to enable on-device analysis.';
      }
    }
    return hasPermission;
  }

  function renderResults(result: HistoryScanResult): void {
    if (googleCountEl) googleCountEl.textContent = result.googleCount.toLocaleString();
    if (nonGoogleCountEl) nonGoogleCountEl.textContent = result.nonGoogleCount.toLocaleString();
    if (totalCountEl) totalCountEl.textContent = result.total.toLocaleString();

    if (lastUpdatedEl) {
      const date = new Date(result.timestamp);
      lastUpdatedEl.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    if (domainsListEl) {
      if (!result.topDomains || result.topDomains.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'empty-state';
        emptyEl.textContent = 'No history visits detected in specified period.';
        domainsListEl.replaceChildren(emptyEl);
        return;
      }

      const items = result.topDomains.map((item) => {
        const row = document.createElement('div');
        row.className = 'domain-item';

        const name = document.createElement('span');
        name.className = 'domain-name';
        name.title = item.domain;
        name.textContent = item.domain;

        const count = document.createElement('span');
        count.className = 'domain-count';
        count.textContent = `${item.count} visits`;

        row.appendChild(name);
        row.appendChild(count);
        return row;
      });

      domainsListEl.replaceChildren(...items);
    }
  }

  async function loadCachedScan(): Promise<void> {
    const data = await chrome.storage.local.get('lastHistoryScan');
    const cached = data['lastHistoryScan'] as HistoryScanResult | undefined;
    if (cached) {
      renderResults(cached);
      if (stepTitle) stepTitle.textContent = 'Last Scan Loaded';
      if (stepDetail) {
        stepDetail.textContent = `Retrieved on-device aggregate scan (${cached.total} items across past ${cached.timeframeDays} days).`;
      }
      if (progressFill) progressFill.style.width = '100%';
    }
  }

  async function startTraceStream(): Promise<void> {
    if (!scanBtn) return;

    const hasPermission = await checkPermissions();
    if (!hasPermission) {
      const granted = await chrome.permissions.request({ permissions: ['history'] });
      if (!granted) return;
      await checkPermissions();
    }

    scanBtn.disabled = true;
    if (btnText) btnText.textContent = 'Computing On-Device...';
    pulseDot?.classList.add('active');
    if (progressFill) progressFill.style.width = '0%';
    if (stepTitle) stepTitle.textContent = 'Connecting...';
    if (stepDetail) stepDetail.textContent = 'Establishing secure local messaging port with background worker...';

    const port = chrome.runtime.connect({ name: 'acam-trace-stream' });

    port.postMessage({ action: 'start' });

    port.onMessage.addListener((data: StreamStep) => {
      if (progressFill) {
        progressFill.style.width = `${data.progress}%`;
      }
      if (stepTitle) stepTitle.textContent = data.title;
      if (stepDetail) stepDetail.textContent = data.detail;

      if (data.payload) {
        renderResults(data.payload);
      }

      if (data.done || data.error) {
        pulseDot?.classList.remove('active');
        scanBtn.disabled = false;
        if (btnText) btnText.textContent = 'Run On-Device Analysis';
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      pulseDot?.classList.remove('active');
      scanBtn.disabled = false;
      if (btnText) btnText.textContent = 'Run On-Device Analysis';
    });
  }

  grantBtn?.addEventListener('click', async () => {
    const granted = await chrome.permissions.request({ permissions: ['history'] });
    if (granted) {
      await checkPermissions();
      await startTraceStream();
    }
  });

  scanBtn?.addEventListener('click', startTraceStream);

  purgeBtn?.addEventListener('click', async () => {
    await chrome.storage.local.remove(['lastHistoryScan', 'footprintSnapshot']);
    if (googleCountEl) googleCountEl.textContent = '0';
    if (nonGoogleCountEl) nonGoogleCountEl.textContent = '0';
    if (totalCountEl) totalCountEl.textContent = '0';
    if (progressFill) progressFill.style.width = '0%';
    if (stepTitle) stepTitle.textContent = 'Cache Purged';
    if (stepDetail) stepDetail.textContent = 'Local scan metrics removed from browser storage.';
    if (lastUpdatedEl) lastUpdatedEl.textContent = 'Cache cleared';
    if (domainsListEl) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';
      emptyEl.textContent = 'Run analysis to inspect on-device domain frequency.';
      domainsListEl.replaceChildren(emptyEl);
    }
  });

  await checkPermissions();
  await loadCachedScan();
});
