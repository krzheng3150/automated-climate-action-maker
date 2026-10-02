/// <reference types="chrome" />

import type { ExtensionMessage, HelloStats } from './index';

/**
 * Hello World Extension - Background Service Worker
 * Manages state persistence and message handling.
 */

chrome.runtime.onInstalled.addListener(async () => {
  const initialStats: HelloStats = {
    greetingCount: 0,
  };

  const stored = await chrome.storage.local.get('stats');
  if (!stored['stats']) {
    await chrome.storage.local.set({ stats: initialStats });
  }

  console.log('[HelloWorld] Extension installed and storage initialized.');
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

    if (message.type === 'GET_STATUS') {
      chrome.storage.local.get('stats').then((data) => {
        sendResponse({ status: 'active', stats: data['stats'] || { greetingCount: 0 } });
      });
      return true;
    }

    return false;
  }
);

async function handleGreeting(): Promise<HelloStats> {
  const data = await chrome.storage.local.get('stats');
  const stats: HelloStats = (data['stats'] as HelloStats) || { greetingCount: 0 };

  stats.greetingCount += 1;

  await chrome.storage.local.set({ stats });
  console.log(`[HelloWorld] Greeting recorded! Total greetings: ${stats.greetingCount}`);

  return stats;
}