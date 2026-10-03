/// <reference types="chrome" />

import type { ExtensionMessage } from './index';

/**
 * Automated Climate Action Maker (ACAM) - Content Script
 * Automatically detects matching websites and displays interactive climate interventions.
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
    this.scenario = this.detectScenario();
    if (!this.scenario) return;

    console.log(`[ACAM] Target page detected for ${this.scenario}. Arming trigger...`);
    this.armTrigger(this.scenario);
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

    // Scenario C: E-commerce shopping cart & checkout
    const isCheckout =
      hostname.includes('amazon.') ||
      hostname.includes('ebay.') ||
      hostname.includes('walmart.') ||
      hostname.includes('target.com') ||
      pathname.includes('/cart') ||
      pathname.includes('/checkout') ||
      pathname.includes('/basket') ||
      pathname.includes('/buy');

    if (isCheckout) {
      return 'scenario-c';
    }

    return null;
  }

  private armTrigger(scenario: ScenarioType): void {
    if (scenario === 'scenario-a') {
      // Trigger Scenario A when user scrolls or after 3 seconds of reading
      const onScroll = () => {
        if (window.scrollY > 120 && !this.triggered) {
          this.fire(scenario);
          window.removeEventListener('scroll', onScroll);
        }
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      setTimeout(() => {
        if (!this.triggered) {
          window.removeEventListener('scroll', onScroll);
          this.fire(scenario);
        }
      }, 3000);
    } else if (scenario === 'scenario-c') {
      // Trigger Scenario C automatically after 1.5 seconds on checkout page
      setTimeout(() => {
        if (!this.triggered) {
          this.fire(scenario);
        }
      }, 1500);
    }
  }

  private fire(scenario: ScenarioType): void {
    this.triggered = true;
    this.displayIntervention(scenario);
  }

  private displayIntervention(scenario: ScenarioType): void {
    if (document.getElementById('acam-overlay-host')) {
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'acam-overlay-host';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .acam-card {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        width: 320px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(12px);
        border-radius: 14px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(16, 185, 129, 0.25);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #111827;
        animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(16px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
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
      .success-box {
        text-align: center;
        padding: 8px 4px;
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

    const card = document.createElement('div');
    card.className = 'acam-card';

    if (scenario === 'scenario-a') {
      card.innerHTML = `
        <div class="acam-header">
          <span class="pill-badge active-civic">🏛️ Civic Action Nudge</span>
          <button id="close-btn" class="dismiss-btn">&times;</button>
        </div>
        <div class="title">Turn Climate Anxiety into Action</div>
        <p class="description">Reading climate policy? Send a 1-click prompt to your local representative supporting regional clean energy transition.</p>
        <div class="snippet-box">"Urging swift passage of renewable energy standards in our district..."</div>
        <div class="action-row" id="action-container">
          <button id="action-btn" class="btn btn-primary">Send with 1-Click (+50 pts)</button>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="acam-header">
          <span class="pill-badge passive-eco">🌱 Carbon Reduction</span>
          <button id="close-btn" class="dismiss-btn">&times;</button>
        </div>
        <div class="title">Consolidate Delivery & Save Fuel</div>
        <p class="description">Consolidated 3-day grouped shipping avoids unnecessary multi-vehicle trips for this order.</p>
        <div class="snippet-box">Estimated reduction: -1.8 kg CO₂ (equiv. to 220 phone charges)</div>
        <div class="action-row" id="action-container">
          <button id="action-btn" class="btn btn-primary">Auto-Optimize Shipping (-1.8 kg CO₂)</button>
        </div>
      `;
    }

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);
    document.body.appendChild(this.container);

    card.querySelector('#close-btn')?.addEventListener('click', () => {
      this.removePrompt();
    });

    card.querySelector('#action-btn')?.addEventListener('click', () => {
      this.executeAction(scenario, card);
    });
  }

  private executeAction(scenario: ScenarioType, card: HTMLElement): void {
    const actionContainer = card.querySelector('#action-container');
    if (!actionContainer) return;

    if (scenario === 'scenario-a') {
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
          actionContainer.innerHTML = `
            <div class="success-box">
              <div class="success-title">✓ Civic Comment Submitted!</div>
              <div class="success-sub">+50 points earned | Letter queued to rep's office</div>
            </div>
          `;
          setTimeout(() => this.removePrompt(), 2500);
        }
      );
    } else {
      chrome.runtime.sendMessage(
        {
          type: 'RECORD_ACTION',
          payload: {
            actionId: 'consolidated_shipping',
            label: 'Consolidated Eco Shipping',
            co2SavedKg: 1.8,
            points: 20,
          },
        },
        () => {
          actionContainer.innerHTML = `
            <div class="success-box">
              <div class="success-title">✓ Shipping Optimized!</div>
              <div class="success-sub">-1.8 kg CO₂ avoided on this delivery</div>
            </div>
          `;
          setTimeout(() => this.removePrompt(), 2500);
        }
      );
    }
  }

  private removePrompt(): void {
    if (this.container?.parentNode) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
}

new ACAMContentScript();