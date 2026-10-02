/// <reference types="chrome" />

import type { ExtensionMessage } from './index';

/**
 * Hello World Extension - Content Script
 * Injects a friendly Hello World banner into the web page.
 */
class HelloWorldContentScript {
  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    console.log('[HelloWorld] Content script initialized.');
    this.registerMessageListeners();
    this.displayHelloPrompt();
  }

  private registerMessageListeners(): void {
    chrome.runtime.onMessage.addListener(
      (
        message: ExtensionMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
      ) => {
        if (message.type === 'GET_STATUS') {
          sendResponse({ status: 'active', url: window.location.href });
        }
        return true;
      }
    );
  }

  private displayHelloPrompt(): void {
    if (document.getElementById('hello-world-host')) {
      return; // Already showing prompt
    }

    // Use Shadow DOM to prevent style leakage between website and extension
    this.container = document.createElement('div');
    this.container.id = 'hello-world-host';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const wrapper = document.createElement('div');
    wrapper.className = 'hello-banner';
    wrapper.innerHTML = `
      <style>
        .hello-banner {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          width: 300px;
          padding: 16px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          border: 1px solid #3b82f6;
          font-family: system-ui, -apple-system, sans-serif;
          color: #1f2937;
        }
        .hello-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .badge {
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          text-transform: uppercase;
        }
        .title {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }
        .description {
          font-size: 12px;
          color: #4b5563;
          margin: 6px 0 12px;
          line-height: 1.4;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        button {
          cursor: pointer;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }
        .btn-primary {
          background: #3b82f6;
          color: #ffffff;
          flex: 1;
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #6b7280;
        }
      </style>
      <div class="hello-header">
        <span class="badge">👋 Hello World</span>
      </div>
      <h4 class="title">Hello from Extension!</h4>
      <p class="description">Your browser extension is up and running on this page.</p>
      <div class="actions">
        <button id="greet-btn" class="btn-primary">Say Hello</button>
        <button id="dismiss-btn" class="btn-secondary">Dismiss</button>
      </div>
    `;

    this.shadowRoot.appendChild(wrapper);
    document.body.appendChild(this.container);

    wrapper.querySelector('#greet-btn')?.addEventListener('click', () => {
      this.sendGreeting();
    });

    wrapper.querySelector('#dismiss-btn')?.addEventListener('click', () => {
      this.removePrompt();
    });
  }

  private sendGreeting(): void {
    const message: ExtensionMessage = {
      type: 'HELLO',
    };

    chrome.runtime.sendMessage(message, (response: any) => {
      console.log('[HelloWorld] Response received:', response);
      this.removePrompt();
    });
  }

  private removePrompt(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
      this.shadowRoot = null;
    }
  }
}

new HelloWorldContentScript();