/// <reference types="chrome" />

import type { ExtensionMessage, HelloStats } from './index';

/**
 * Automated Climate Action Maker (ACAM) - Background Service Worker
 * Manages climate impact state persistence and message handling.
 */

export interface ACAMStats extends HelloStats {
  totalCo2SavedKg: number;
  civicPoints: number;
  actionsCount: number;
}

interface RecordActionPayload {
  actionId: string;
  label: string;
  co2SavedKg: number;
  points: number;
}

chrome.runtime.onInstalled.addListener(async () => {
  const initialStats: ACAMStats = {
    greetingCount: 0,
    totalCo2SavedKg: 0,
    civicPoints: 0,
    actionsCount: 0,
  };

  const stored = await chrome.storage.local.get('stats');
  await chrome.storage.local.set({ stats: { ...initialStats, ...(stored['stats'] || {}) } });
  console.log('[ACAM] Extension installed and impact storage initialized.');
});

chrome.runtime.onMessage.addListener(
  ( 
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (message.type === 'HELLO') {
      handleGreeting().then((updatedStats) => {
        sendResponse({ success: true, message: 'Hello, World!', stats: updatedStats });
      });
      return true; // Keep message channel open for async response
    }
    
    const msg = message as any;

    if (msg.type === 'RECORD_ACTION') {
      recordClimateAction(msg.payload).then((updatedStats) => {
        sendResponse({ success: true, stats: updatedStats });
      });
      return true;
    }

    if (message.type === 'GET_STATUS') {
      chrome.storage.local.get('stats').then((data) => {
        sendResponse({
          status: 'active',
          stats: data['stats'] || { greetingCount: 0, totalCo2SavedKg: 0, civicPoints: 0, actionsCount: 0 },
        });
      });
      return true;
    }

    return false;
  }
);

async function recordClimateAction(payload: RecordActionPayload): Promise<ACAMStats> {
  const data = await chrome.storage.local.get('stats');
  const stats: ACAMStats = data['stats'] || {
    greetingCount: 0,
    totalCo2SavedKg: 0,
    civicPoints: 0,
    actionsCount: 0,
  };

  stats.totalCo2SavedKg = Number((stats.totalCo2SavedKg + (payload.co2SavedKg || 0)).toFixed(2));
  stats.civicPoints += payload.points || 0;
  stats.actionsCount += 1;
  stats.greetingCount += 1;

  await chrome.storage.local.set({ stats });
  console.log(`[ACAM] Action logged: ${payload.label}`, stats);
  return stats;
}

async function handleGreeting(): Promise<HelloStats> {
  return recordClimateAction({
    actionId: 'greeting',
    label: 'Greeting',
    co2SavedKg: 0,
    points: 1,
  });
}