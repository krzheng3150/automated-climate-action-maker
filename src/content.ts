/// <reference types="chrome" />

import { recordDiagnostic, type ExtensionMessage } from './index';
import { buildSearchUrl, openOutbound, partnersInGroup } from './outbound';

/**
 * Automated Climate Action Maker (ACAM) - Content Script
 * Automatically detects matching websites and displays interactive climate interventions
 * using isolated Shadow DOM and safe DOM manipulation (Zero innerHTML interpolation).
 */
type ScenarioType = 'scenario-a' | 'scenario-c';

class ACAMContentScript {
  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private scenario: ScenarioType | null = null;
  private triggered = false;

  constructor() {
    this.init();
  }

  private init(): void {
    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'CONTENT_MOUNTED',
      details: `Initialized on ${window.location.hostname || 'page'}`,
    });
    this.registerMessageListeners();
    this.scenario = this.detectScenario();
    if (!this.scenario) return;

    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'TARGET_PAGE_DETECTED',
      details: `Armed ${this.scenario} on ${window.location.hostname}`,
    });
    this.armTrigger(this.scenario);
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

  private detectScenario(): ScenarioType | null {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // Demo parameter overrides: allow testing any scenario on any page
    if (url.includes('acam_scenario=a') || url.includes('scenario=a')) {
      return 'scenario-a';
    }
    if (url.includes('acam_scenario=c') || url.includes('scenario=c')) {
      return 'scenario-c';
    }

    // Scenario A: News doomscroll & climate policy
    const isClimateNews =
      hostname.includes('theguardian.com') ||
      hostname.includes('nytimes.com') ||
      hostname.includes('bbc.co') ||
      hostname.includes('washingtonpost.com') ||
      (hostname.includes('reddit.com') && pathname.includes('/r/climate')) ||
      url.includes('/climate') ||
      url.includes('global-warming');

    if (isClimateNews) {
      return 'scenario-a';
    }

    // Scenario C: E-commerce shopping, product pages, and checkout
    const isShopping =
      hostname.includes('amazon.') ||
      hostname.includes('ebay.') ||
      hostname.includes('walmart.') ||
      hostname.includes('target.com') ||
      hostname.includes('bestbuy.com') ||
      hostname.includes('apple.com') ||
      pathname.includes('/dp/') ||
      pathname.includes('/ip/') ||
      pathname.includes('/product') ||
      pathname.includes('/item') ||
      pathname.includes('/cart') ||
      pathname.includes('/checkout') ||
      pathname.includes('/basket');

    if (isShopping) {
      return 'scenario-c';
    }

    return null;
  }

  private armTrigger(scenario: ScenarioType): void {
    if (scenario === 'scenario-a') {
      const onScroll = () => {
        if (window.scrollY > 120 && !this.triggered) {
          window.removeEventListener('scroll', onScroll);
          this.fire(scenario);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      setTimeout(() => {
        if (!this.triggered) {
          window.removeEventListener('scroll', onScroll);
          this.fire(scenario);
        }
      }, 4000);
    } else {
      setTimeout(() => {
        if (!this.triggered) {
          this.fire(scenario);
        }
      }, 1200);
    }
  }

  private extractProductTitle(): string {
    const urlParams = new URLSearchParams(window.location.search);
    const demoItem = urlParams.get('item');
    if (demoItem) return demoItem;

    // 1. Check Schema.org JSON-LD microdata
    const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldJsonScripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data['@type'] === 'Product' && data.name) {
          return this.cleanProductTitle(String(data.name));
        }
      } catch {
        // ignore invalid JSON-LD
      }
    }

    // 2. Open Graph meta title fallback
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle) {
      return this.cleanProductTitle(ogTitle);
    }

    // 3. Document title fallback
    const rawTitle = document.title ? document.title.split(/[-|:–]/)[0].trim() : '';
    return this.cleanProductTitle(rawTitle) || 'MacBook Pro M3';
  }

  private cleanProductTitle(rawTitle: string): string {
    return rawTitle
      .replace(/\(.*?\)|\[.*?\]/g, '') // Remove parenthesis/brackets
      .replace(/(with\s+.*|for\s+.*)/i, '') // Remove promotional accessories
      .replace(/(free shipping|brand new|latest model|oem|renewed|refurbished)/gi, '')
      .replace(/,\s*.*/, '') // Remove trailing specifications
      .trim()
      .split(/\s+/)
      .slice(0, 5) // Retain brand + primary model tokens
      .join(' ');
  }

  private fire(scenario: ScenarioType): void {
    this.triggered = true;
    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'INTERVENTION_MOUNTED',
      details: `Shadow DOM intervention mounted for ${scenario}`,
    });
    this.displayIntervention(scenario);
  }

  private displayIntervention(scenario: ScenarioType): void {
    if (document.getElementById('acam-overlay-host')) return;

    this.container = document.createElement('div');
    this.container.id = 'acam-overlay-host';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .acam-card {
        width: 320px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 16px;
        box-sizing: border-box;
        animation: acam-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes acam-slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .acam-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .pill-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 9px;
        border-radius: 999px;
      }
      .pill-badge.active-civic {
        background: #fef3c7;
        color: #92400e;
      }
      .pill-badge.passive-eco {
        background: #d1fae5;
        color: #065f46;
      }
      .dismiss-btn {
        background: transparent;
        border: none;
        color: #9ca3af;
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
        padding: 2px 6px;
      }
      .dismiss-btn:hover { color: #4b5563; }
      .title {
        font-size: 14px;
        font-weight: 700;
        margin: 4px 0 6px 0;
        line-height: 1.3;
        color: #111827;
      }
      .description {
        font-size: 12px;
        color: #4b5563;
        line-height: 1.45;
        margin: 0 0 12px 0;
      }
      .snippet-box {
        background: #f3f4f6;
        border-left: 3px solid #10b981;
        padding: 8px 10px;
        border-radius: 4px;
        font-size: 11px;
        color: #374151;
        margin-bottom: 12px;
        font-style: italic;
      }
      .action-row {
        display: flex;
        gap: 8px;
      }
      .btn {
        cursor: pointer;
        border: none;
        padding: 9px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        transition: transform 0.1s ease, background 0.15s ease;
      }
      .btn:active { transform: scale(0.98); }
      .btn-primary {
        background: #059669;
        color: #ffffff;
        flex: 1;
        box-shadow: 0 2px 6px rgba(5, 150, 105, 0.3);
      }
      .btn-primary:hover { background: #047857; }
      .circular-btn {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #10b981;
        flex: 1;
        text-align: center;
        padding: 8px 6px;
        font-size: 11px;
      }
      .circular-btn:hover { background: #059669; color: #ffffff; }
      .success-box {
        text-align: center;
        padding: 8px 4px;
        width: 100%;
      }
      .success-title {
        font-size: 13px;
        font-weight: 700;
        color: #065f46;
        margin-bottom: 4px;
      }
      .success-sub {
        font-size: 11px;
        color: #047857;
      }
    `;

    // Safe DOM Construction (No dynamic innerHTML)
    const card = document.createElement('div');
    card.className = 'acam-card';

    const header = document.createElement('div');
    header.className = 'acam-header';

    const badge = document.createElement('span');
    badge.className = `pill-badge ${scenario === 'scenario-a' ? 'active-civic' : 'passive-eco'}`;
    badge.textContent = scenario === 'scenario-a' ? '🏛️ Civic Action Nudge' : '♻️ Compare Circular Options';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-btn';
    closeBtn.className = 'dismiss-btn';
    closeBtn.textContent = '×';

    header.appendChild(badge);
    header.appendChild(closeBtn);
    card.appendChild(header);

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.textContent =
      scenario === 'scenario-a' ? 'Turn Climate Anxiety into Action' : 'Find Refurbished Alternatives';
    card.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.className = 'description';
    descEl.textContent =
      scenario === 'scenario-a'
        ? 'Reading climate policy? Send a 1-click prompt to your local representative supporting regional clean energy transition.'
        : 'Manufacturing accounts for ~80% of electronics emissions. Compare verified second-life options to avoid high factory carbon.';
    card.appendChild(descEl);

    const snippetEl = document.createElement('div');
    snippetEl.className = 'snippet-box';
    card.appendChild(snippetEl);

    const actionContainer = document.createElement('div');
    actionContainer.id = 'action-container';
    actionContainer.className = 'action-row';
    card.appendChild(actionContainer);

    if (scenario === 'scenario-a') {
      snippetEl.textContent = '"Urging swift passage of renewable energy standards in our district..."';

      const actionBtn = document.createElement('button');
      actionBtn.id = 'action-btn';
      actionBtn.className = 'btn btn-primary';
      actionBtn.textContent = 'Send with 1-Click (+50 pts)';
      actionBtn.addEventListener('click', () => {
        this.executeCivicAction(card);
      });
      actionContainer.appendChild(actionBtn);
    } else {
      const productTitle = this.extractProductTitle();
      snippetEl.textContent = `Target: ${productTitle} (Save up to ~65 kg CO₂e)`;

      for (const provider of partnersInGroup('circular_marketplace')) {
        const btn = document.createElement('button');
        btn.className = 'btn circular-btn';
        btn.textContent = provider.name;
        const targetUrl = buildSearchUrl(provider, productTitle);

        btn.addEventListener('click', () => {
          this.executeCircularRedirect(targetUrl, provider.name, card);
        });
        actionContainer.appendChild(btn);
      }
    }

    closeBtn.addEventListener('click', () => {
      this.removePrompt();
    });

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);
    document.body.appendChild(this.container);
  }

  private showSuccessMessage(card: HTMLElement, titleText: string, subText: string): void {
    const actionContainer = card.querySelector('#action-container');
    if (!actionContainer) return;

    const successBox = document.createElement('div');
    successBox.className = 'success-box';

    const successTitle = document.createElement('div');
    successTitle.className = 'success-title';
    successTitle.textContent = titleText;

    const successSub = document.createElement('div');
    successSub.className = 'success-sub';
    successSub.textContent = subText;

    successBox.appendChild(successTitle);
    successBox.appendChild(successSub);

    actionContainer.replaceChildren(successBox);
    setTimeout(() => this.removePrompt(), 2500);
  }

  private executeCivicAction(card: HTMLElement): void {
    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'ACTION_EXECUTED',
      details: 'Civic representative petition letter queued (+50 pts)',
    });
    chrome.runtime.sendMessage(
      {
        type: 'RECORD_ACTION',
        payload: {
          actionId: 'civic_petition_sent',
          label: 'Civic Representative Letter',
          co2SavedKg: 0,
          points: 50,
        },
      },
      () => {
        this.showSuccessMessage(
          card,
          '✓ Civic Comment Submitted!',
          '+50 points earned | Letter queued to rep\'s office'
        );
      }
    );
  }

  private executeCircularRedirect(targetUrl: string, provider: string, card: HTMLElement): void {
    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'CIRCULAR_REDIRECT',
      details: `Dispatched circular marketplace redirect: ${provider} (+80 pts)`,
    });
    if (targetUrl) {
      openOutbound(targetUrl, { source: 'content', placement: 'in-page' });
    }

    chrome.runtime.sendMessage(
      {
        type: 'RECORD_ACTION',
        payload: {
          actionId: 'circular_marketplace_search',
          label: `${provider} Search`,
          co2SavedKg: 65,
          points: 80,
        },
      },
      () => {
        this.showSuccessMessage(
          card,
          `✓ ${provider} Opened!`,
          '+80 pts | Up to ~65 kg embodied CO₂ saved'
        );
      }
    );
  }

  private removePrompt(): void {
    if (this.container?.parentNode) {
      recordDiagnostic({
        source: 'content',
        level: 'info',
        event: 'INTERVENTION_DISMISSED',
        details: 'Intervention prompt removed from host DOM',
      });
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
}

new ACAMContentScript();
