/// <reference types="chrome" />

import {
  FEEDBACK_APPS_SCRIPT_URL,
  STORAGE_KEYS,
  formatFeedbackTSV,
  recordDiagnostic,
  type DiagnosticEntry,
  type HistoryScanResult,
  type RecommendationFeedback,
  type StreamStep,
} from './index';
import { openOutbound } from './outbound';

document.addEventListener('DOMContentLoaded', async () => {
  const permissionCard = document.getElementById('permission-card') as HTMLElement | null;
  const grantBtn = document.getElementById('grant-btn') as HTMLButtonElement | null;
  const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement | null;
  const btnText = document.getElementById('btn-text') as HTMLElement | null;
  const pulseDot = document.getElementById('pulse-dot') as HTMLElement | null;
  const progressFill = document.getElementById('progress-fill') as HTMLElement | null;
  const stepTitle = document.getElementById('step-title') as HTMLElement | null;
  const stepDetail = document.getElementById('step-detail') as HTMLElement | null;

  const purgeBtn = document.getElementById('purge-btn') as HTMLButtonElement | null;

  const diagnosticsListEl = document.getElementById('diagnostics-list') as HTMLElement | null;
  const diagnosticsCountEl = document.getElementById('diagnostics-count') as HTMLElement | null;
  const copyDiagBtn = document.getElementById('copy-diag-btn') as HTMLButtonElement | null;
  const clearDiagBtn = document.getElementById('clear-diag-btn') as HTMLButtonElement | null;

  const feedbackCountEl = document.getElementById('feedback-count') as HTMLElement | null;
  const copyFeedbackBtn = document.getElementById('copy-feedback-btn') as HTMLButtonElement | null;
  const shareFeedbackBtn = document.getElementById('share-feedback-btn') as HTMLButtonElement | null;

  function renderDiagnostics(logs: DiagnosticEntry[]): void {
    if (diagnosticsCountEl) {
      diagnosticsCountEl.textContent = `${logs.length} event${logs.length === 1 ? '' : 's'}`;
    }

    if (!diagnosticsListEl) return;

    if (!logs || logs.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';
      emptyEl.textContent = 'No diagnostic events recorded yet.';
      diagnosticsListEl.replaceChildren(emptyEl);
      return;
    }

    // Render in reverse chronological order (newest first)
    const items = [...logs].reverse().map((entry) => {
      const row = document.createElement('div');
      row.className = 'diag-entry';

      const meta = document.createElement('div');
      meta.className = 'diag-meta';

      const time = document.createElement('span');
      time.className = 'diag-time';
      const d = new Date(entry.timestamp);
      time.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const sourceBadge = document.createElement('span');
      sourceBadge.className = `diag-source diag-source-${entry.source}`;
      sourceBadge.textContent = entry.source;

      meta.appendChild(time);
      meta.appendChild(sourceBadge);

      const eventTitle = document.createElement('div');
      eventTitle.className = 'diag-event';
      eventTitle.textContent = entry.event;

      row.appendChild(meta);
      row.appendChild(eventTitle);

      if (entry.details) {
        const detailsEl = document.createElement('div');
        detailsEl.className = 'diag-details';
        detailsEl.textContent = entry.details;
        row.appendChild(detailsEl);
      }

      return row;
    });

    diagnosticsListEl.replaceChildren(...items);
  }

  async function loadDiagnostics(): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS_LOG);
    const logs = Array.isArray(data[STORAGE_KEYS.DIAGNOSTICS_LOG])
      ? (data[STORAGE_KEYS.DIAGNOSTICS_LOG] as DiagnosticEntry[])
      : [];
    renderDiagnostics(logs);
  }

  copyDiagBtn?.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS_LOG);
    const logs = Array.isArray(data[STORAGE_KEYS.DIAGNOSTICS_LOG])
      ? data[STORAGE_KEYS.DIAGNOSTICS_LOG]
      : [];
    try {
      await navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
      if (copyDiagBtn) {
        const orig = copyDiagBtn.textContent;
        copyDiagBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          if (copyDiagBtn) copyDiagBtn.textContent = orig;
        }, 1500);
      }
    } catch {
      // Ignore clipboard write restrictions
    }
  });

  clearDiagBtn?.addEventListener('click', async () => {
    await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS_LOG]: [] });
    renderDiagnostics([]);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.DIAGNOSTICS_LOG]) {
      const newLogs = changes[STORAGE_KEYS.DIAGNOSTICS_LOG].newValue;
      renderDiagnostics(Array.isArray(newLogs) ? newLogs : []);
    }
  });

  const nudgeOverridesListEl = document.getElementById('nudge-overrides-list') as HTMLElement | null;

  function formatCooldown(hours: number): string {
    if (hours === -1) return 'Disabled';
    if (hours === 0) return 'Always';
    if (hours < 24) return `Every ${hours}h`;
    const days = Math.round(hours / 24);
    return `Every ${days}d`;
  }

  async function loadNudgeOverrides(): Promise<void> {
    if (!nudgeOverridesListEl) return;
    const data = await chrome.storage.local.get(STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES);
    const overrides: Record<string, number> = data[STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES] ?? {};
    const entries = Object.entries(overrides);

    if (entries.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'nudge-empty';
      empty.textContent = 'No per-category overrides — adjust from nudge cards';
      nudgeOverridesListEl.replaceChildren(empty);
      return;
    }

    const rows = entries.map(([category, hours]) => {
      const row = document.createElement('div');
      row.className = 'nudge-override-row';

      const info = document.createElement('div');
      info.className = 'nudge-override-info';

      const catLabel = document.createElement('span');
      catLabel.className = 'nudge-override-category';
      catLabel.textContent = category;

      const valLabel = document.createElement('span');
      valLabel.className = `nudge-override-value${hours === -1 ? ' disabled' : ''}`;
      valLabel.textContent = formatCooldown(hours);

      info.appendChild(catLabel);
      info.appendChild(valLabel);

      const resetBtn = document.createElement('button');
      resetBtn.className = 'nudge-reset-btn';
      resetBtn.textContent = 'Reset';
      resetBtn.addEventListener('click', async () => {
        const fresh = await chrome.storage.local.get(STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES);
        const current: Record<string, number> = fresh[STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES] ?? {};
        delete current[category];
        await chrome.storage.local.set({ [STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES]: current });
        await loadNudgeOverrides();
      });

      row.appendChild(info);
      row.appendChild(resetBtn);
      return row;
    });

    nudgeOverridesListEl.replaceChildren(...rows);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES]) {
      loadNudgeOverrides();
    }
  });

  const GLOBAL_FREQ_PRESETS = [
    { label: 'Always', hours: 0 },
    { label: '22h', hours: 22 },
    { label: '3d', hours: 72 },
    { label: '7d', hours: 168 },
    { label: '30d', hours: 720 },
    { label: 'Off', hours: -1 },
  ] as const;

  const globalFreqDialEl = document.getElementById('global-frequency-dial') as HTMLElement | null;

  async function loadGlobalFrequency(): Promise<void> {
    if (!globalFreqDialEl) return;
    const data = await chrome.storage.local.get(STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY);
    const current: number | undefined = data[STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY];

    globalFreqDialEl.replaceChildren();

    for (const preset of GLOBAL_FREQ_PRESETS) {
      const btn = document.createElement('button');
      btn.className = 'freq-btn popup-freq-btn';
      if (preset.hours === -1) btn.classList.add('off');
      btn.textContent = preset.label;

      const isActive = current == null ? preset.hours === 22 : preset.hours === current;
      if (isActive) btn.classList.add('active');

      btn.addEventListener('click', async () => {
        for (const sibling of globalFreqDialEl.querySelectorAll('.freq-btn')) {
          sibling.classList.remove('active');
        }
        btn.classList.add('active');
        await chrome.storage.local.set({
          [STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY]: preset.hours,
        });
      });

      globalFreqDialEl.appendChild(btn);
    }
  }

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

  async function loadCachedScan(): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.LAST_HISTORY_SCAN);
    const cached = data[STORAGE_KEYS.LAST_HISTORY_SCAN] as HistoryScanResult | undefined;
    if (cached) {
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
    await chrome.storage.local.remove([
      STORAGE_KEYS.LAST_HISTORY_SCAN,
      STORAGE_KEYS.FOOTPRINT_SNAPSHOT,
      STORAGE_KEYS.LAST_INCREMENTAL_TIMESTAMP,
      STORAGE_KEYS.PENDING_VISITS,
      STORAGE_KEYS.DIAGNOSTICS_LOG,
      STORAGE_KEYS.FEEDBACK_LOG,
      STORAGE_KEYS.USER_REGION_OVERRIDE,
      STORAGE_KEYS.NUDGE_COOLDOWNS,
      STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES,
      STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY,
      STORAGE_KEYS.USER_LOCATION_ESTIMATE,
      STORAGE_KEYS.BROWSING_PROFILE,
    ]);
    renderDiagnostics([]);
    if (progressFill) progressFill.style.width = '0%';
    if (stepTitle) stepTitle.textContent = 'Cache Purged';
    if (stepDetail) stepDetail.textContent = 'Local scan metrics removed from browser storage.';
  });

  async function loadFeedbackCount(): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.FEEDBACK_LOG);
    const entries: RecommendationFeedback[] = Array.isArray(data[STORAGE_KEYS.FEEDBACK_LOG])
      ? data[STORAGE_KEYS.FEEDBACK_LOG]
      : [];
    if (feedbackCountEl) {
      feedbackCountEl.textContent = `${entries.length} vote${entries.length === 1 ? '' : 's'}`;
    }
  }

  copyFeedbackBtn?.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(STORAGE_KEYS.FEEDBACK_LOG);
    const entries: RecommendationFeedback[] = Array.isArray(data[STORAGE_KEYS.FEEDBACK_LOG])
      ? data[STORAGE_KEYS.FEEDBACK_LOG]
      : [];
    if (entries.length === 0) {
      if (copyFeedbackBtn) copyFeedbackBtn.textContent = 'No feedback yet';
      setTimeout(() => { if (copyFeedbackBtn) copyFeedbackBtn.textContent = 'Copy Feedback'; }, 1500);
      return;
    }
    try {
      await navigator.clipboard.writeText(formatFeedbackTSV(entries));
      if (copyFeedbackBtn) {
        copyFeedbackBtn.textContent = '✓ Copied!';
        setTimeout(() => { if (copyFeedbackBtn) copyFeedbackBtn.textContent = 'Copy Feedback'; }, 1500);
      }
    } catch {
      // Clipboard write not available
    }
  });

  shareFeedbackBtn?.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(STORAGE_KEYS.FEEDBACK_LOG);
    const entries: RecommendationFeedback[] = Array.isArray(data[STORAGE_KEYS.FEEDBACK_LOG])
      ? data[STORAGE_KEYS.FEEDBACK_LOG]
      : [];
    if (entries.length === 0) {
      if (shareFeedbackBtn) shareFeedbackBtn.textContent = 'No feedback yet';
      setTimeout(() => { if (shareFeedbackBtn) shareFeedbackBtn.textContent = 'Share Feedback'; }, 1500);
      return;
    }
    const tsv = formatFeedbackTSV(entries);
    if (FEEDBACK_APPS_SCRIPT_URL) {
      const encoded = encodeURIComponent(tsv.slice(0, 1800));
      openOutbound(`${FEEDBACK_APPS_SCRIPT_URL}?feedback=${encoded}`, { source: 'popup', placement: 'share-feedback' });
    } else {
      try {
        await navigator.clipboard.writeText(tsv);
        if (shareFeedbackBtn) {
          shareFeedbackBtn.textContent = '✓ Copied to clipboard!';
          setTimeout(() => { if (shareFeedbackBtn) shareFeedbackBtn.textContent = 'Share Feedback'; }, 1500);
        }
      } catch {
        // Clipboard write not available
      }
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.FEEDBACK_LOG]) {
      const entries = changes[STORAGE_KEYS.FEEDBACK_LOG].newValue;
      const count = Array.isArray(entries) ? entries.length : 0;
      if (feedbackCountEl) {
        feedbackCountEl.textContent = `${count} vote${count === 1 ? '' : 's'}`;
      }
    }
  });

  await checkPermissions();
  await loadCachedScan();
  await loadGlobalFrequency();
  await loadNudgeOverrides();
  await loadDiagnostics();
  await loadFeedbackCount();
  await recordDiagnostic({
    source: 'popup',
    level: 'info',
    event: 'POPUP_INITIALIZED',
    details: 'Foreground popup stream interface mounted',
  });
});
