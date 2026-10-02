/// <reference types="chrome" />

import type { HelloStats } from './index';

document.addEventListener('DOMContentLoaded', async () => {
  const greetingCountEl = (document.getElementById('greeting-count') || document.getElementById('actions-count')) as HTMLElement | null;
  const statusEl = (document.getElementById('status-message') || document.getElementById('co2-saved')) as HTMLElement | null;
  const resetBtn = (document.getElementById('reset-btn') || document.getElementById('reset-stats-btn')) as HTMLButtonElement | null;

  async function loadStats(): Promise<void> {
    const data = await chrome.storage.local.get('stats');
    const stats: HelloStats = (data['stats'] as HelloStats) || { greetingCount: 0 };
    if (greetingCountEl) {
      greetingCountEl.textContent = stats.greetingCount.toString();
    }
    if (statusEl) {
      statusEl.textContent = 'Active';
    }
  }

  resetBtn?.addEventListener('click', async () => {
    const resetStats: HelloStats = { greetingCount: 0 };
    await chrome.storage.local.set({ stats: resetStats });
    await loadStats();
  });

  await loadStats();
});