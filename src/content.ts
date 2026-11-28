/// <reference types="chrome" />

import { recordDiagnostic, resolveNudgeCooldown, STORAGE_KEYS, type ExtensionMessage } from './index';
import { buildSearchUrl, openOutbound, partnersInGroup, type OutboundPartner } from './outbound';
import { detectRecipe } from './recipe-detect';
import { REWARDS } from './rewards';
import type { RecipeSuggestionView } from './food/suggest';

/**
 * Automated Climate Action Maker (ACAM) - Content Script
 * Automatically detects matching websites and displays interactive climate interventions
 * using isolated Shadow DOM and safe DOM manipulation (Zero innerHTML interpolation).
 */
type ScenarioType = 'scenario-a' | 'scenario-c';
type ProductCategory = 'electronics' | 'fashion' | 'books' | 'home';

const DEFAULT_COOLDOWN_HOURS = 22;

const FREQUENCY_PRESETS = [
  { label: 'Always', hours: 0 },
  { label: '22h', hours: 22 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
  { label: 'Off', hours: -1 },
] as const;

type NudgeCooldowns = Partial<Record<ProductCategory, number>>;
type NudgeCategoryOverrides = Partial<Record<ProductCategory, number>>;

interface CategoryConfig {
  group: NonNullable<OutboundPartner['group']>;
  badge: string;
  title: string;
  description: string;
  co2Note: string;
}

const CATEGORY_CONFIG: Record<ProductCategory, CategoryConfig> = {
  electronics: {
    group: 'circular_marketplace',
    badge: '♻️ Compare Circular Options',
    title: 'Find Refurbished Alternatives',
    description: 'Manufacturing accounts for ~80% of electronics emissions. Compare verified second-life options to avoid high factory carbon.',
    co2Note: 'Save up to ~65 kg CO₂e',
  },
  fashion: {
    group: 'secondhand_fashion',
    badge: '♻️ Shop Secondhand',
    title: 'Find Pre-Loved Alternatives',
    description: 'The fashion industry produces ~10% of global carbon emissions. Buying secondhand extends garment life and skips new production.',
    co2Note: 'Save up to ~20 kg CO₂e per garment',
  },
  books: {
    group: 'used_books',
    badge: '📚 Buy Used',
    title: 'Find Used Copies',
    description: 'A new book produces ~7 kg CO₂e in paper, printing, and shipping. Used books skip all of that.',
    co2Note: 'Save up to ~7 kg CO₂e',
  },
  home: {
    group: 'secondhand_home',
    badge: '♻️ Shop Pre-Owned',
    title: 'Find Secondhand Alternatives',
    description: 'Furniture manufacturing has a significant carbon footprint. Pre-owned pieces skip the factory entirely.',
    co2Note: 'Avoid manufacturing emissions',
  },
};

const FOOD_STYLES = `
      .detail-list {
        margin: 0 0 12px 0;
        padding: 0 0 0 16px;
        font-size: 11px;
        color: #374151;
        line-height: 1.5;
      }
      .fine-print {
        font-size: 10px;
        color: #6b7280;
        line-height: 1.4;
        margin: 0 0 12px 0;
      }
      .btn-quiet {
        background: transparent;
        color: #6b7280;
        border: 1px solid #e5e7eb;
      }
      .btn-quiet:hover { background: #f3f4f6; }
      .feedback-section {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
      }
      .feedback-label {
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 6px;
      }
      .feedback-vote-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      .vote-btn {
        flex: 1;
        padding: 6px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #f9fafb;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.15s ease;
      }
      .vote-btn:hover { background: #f3f4f6; }
      .vote-btn.selected {
        border-color: #059669;
        background: #ecfdf5;
      }
      .feedback-comment {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 11px;
        font-family: inherit;
        resize: vertical;
        min-height: 32px;
        max-height: 80px;
        margin-bottom: 8px;
      }
      .feedback-comment::placeholder { color: #9ca3af; }
      .btn-feedback {
        width: 100%;
        padding: 7px;
        border: none;
        border-radius: 6px;
        background: #059669;
        color: white;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-feedback:hover { background: #047857; }
      .btn-feedback:disabled { background: #d1d5db; cursor: default; }
`;

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
    if (!this.scenario) {
      this.armRecipeDetection();
      return;
    }

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

    // Scenario C: E-commerce product pages and checkout
    // Require a product-path signal — homepages and landing pages are excluded.
    const isShoppingDomain =
      hostname.includes('amazon.') ||
      hostname.includes('ebay.') ||
      hostname.includes('walmart.') ||
      hostname.includes('target.com') ||
      hostname.includes('bestbuy.com') ||
      hostname.includes('apple.com') ||
      hostname.includes('newegg.com') ||
      hostname.includes('bhphotovideo.com') ||
      hostname.includes('nordstrom.com') ||
      hostname.includes('macys.com') ||
      hostname.includes('hm.com') ||
      hostname.includes('zara.com') ||
      hostname.includes('nike.com') ||
      hostname.includes('gap.com') ||
      hostname.includes('oldnavy.com') ||
      hostname.includes('asos.com') ||
      hostname.includes('shein.com') ||
      hostname.includes('uniqlo.com') ||
      hostname.includes('forever21.com') ||
      hostname.includes('lululemon.com') ||
      hostname.includes('barnesandnoble.com') ||
      hostname.includes('wayfair.com') ||
      hostname.includes('ikea.com') ||
      hostname.includes('potterybarn.com') ||
      hostname.includes('crateandbarrel.com') ||
      hostname.includes('westelm.com') ||
      hostname.includes('overstock.com');

    const isProductPath =
      pathname.includes('/dp/') ||
      pathname.includes('/ip/') ||
      pathname.includes('/product') ||
      pathname.includes('/item') ||
      pathname.includes('/gp/product') ||
      pathname.includes('/cart') ||
      pathname.includes('/checkout') ||
      pathname.includes('/basket') ||
      /\/[a-z]+-[a-z]+-[a-z]+\/\d/.test(pathname) ||
      pathname.includes('/shop/') ||
      pathname.includes('/buy/') ||
      pathname.includes('/p/');

    if (isProductPath) {
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
      setTimeout(async () => {
        if (this.triggered) return;
        const category = this.detectProductCategory();
        const allowed = await this.checkCooldown(category);
        if (!allowed) {
          recordDiagnostic({
            source: 'content',
            level: 'info',
            event: 'NUDGE_SUPPRESSED',
            details: `Cooldown active for ${category}`,
          });
          return;
        }
        const flexible = await this.checkFlexibility(category);
        if (!flexible) {
          recordDiagnostic({
            source: 'content',
            level: 'info',
            event: 'NUDGE_SUPPRESSED',
            details: `Low flexibility for ${category}`,
          });
          return;
        }
        this.fire(scenario);
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

  private detectProductCategory(): ProductCategory {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    if (hostname.includes('bestbuy.com') || hostname.includes('apple.com') ||
        hostname.includes('newegg.com') || hostname.includes('bhphotovideo.com')) {
      return 'electronics';
    }
    if (hostname.includes('nordstrom.com') || hostname.includes('macys.com') ||
        hostname.includes('hm.com') || hostname.includes('zara.com') ||
        hostname.includes('nike.com') || hostname.includes('gap.com') ||
        hostname.includes('oldnavy.com') || hostname.includes('asos.com') ||
        hostname.includes('shein.com') || hostname.includes('uniqlo.com') ||
        hostname.includes('forever21.com') || hostname.includes('lululemon.com')) {
      return 'fashion';
    }
    if (hostname.includes('barnesandnoble.com')) return 'books';
    if (hostname.includes('wayfair.com') || hostname.includes('ikea.com') ||
        hostname.includes('potterybarn.com') || hostname.includes('crateandbarrel.com') ||
        hostname.includes('westelm.com') || hostname.includes('overstock.com')) {
      return 'home';
    }

    if (/\/(?:clothing|fashion|shoes|apparel|womens|mens)(?:\/|$)/.test(pathname)) return 'fashion';
    if (/\/(?:books|kindle|audiobooks)(?:\/|$)/.test(pathname)) return 'books';
    if (/\/(?:furniture|home-?decor|patio|bed-bath)(?:\/|$)/.test(pathname)) return 'home';

    return 'electronics';
  }

  private async checkCooldown(category: ProductCategory): Promise<boolean> {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.NUDGE_COOLDOWNS,
      STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES,
      STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY,
    ]);
    return resolveNudgeCooldown({
      category,
      now: Date.now(),
      cooldowns: data[STORAGE_KEYS.NUDGE_COOLDOWNS] ?? {},
      overrides: data[STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES] ?? {},
      globalFrequencyHours: data[STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY],
    });
  }

  private checkFlexibility(category: ProductCategory): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'CHECK_SECONDHAND_NUDGE', payload: { category } },
        (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve(true);
            return;
          }
          resolve(resp.show);
        }
      );
    });
  }

  private async recordNudgeShown(category: ProductCategory): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.NUDGE_COOLDOWNS);
    const cooldowns: NudgeCooldowns = data[STORAGE_KEYS.NUDGE_COOLDOWNS] ?? {};
    cooldowns[category] = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEYS.NUDGE_COOLDOWNS]: cooldowns });
  }

  private async setFrequencyOverride(category: ProductCategory, hours: number): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES);
    const overrides: NudgeCategoryOverrides = data[STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES] ?? {};
    overrides[category] = hours;
    await chrome.storage.local.set({ [STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES]: overrides });
  }

  private buildFrequencyDial(category: ProductCategory): HTMLElement {
    const row = document.createElement('div');
    row.className = 'frequency-row';

    const label = document.createElement('span');
    label.className = 'frequency-label';
    label.textContent = 'Notify every';
    row.appendChild(label);

    const dial = document.createElement('div');
    dial.className = 'frequency-dial';

    const loadActive = async () => {
      const data = await chrome.storage.local.get([
        STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES,
        STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY,
      ]);
      const overrides: NudgeCategoryOverrides = data[STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES] ?? {};
      return overrides[category] ?? data[STORAGE_KEYS.NUDGE_GLOBAL_FREQUENCY] ?? DEFAULT_COOLDOWN_HOURS;
    };

    for (const preset of FREQUENCY_PRESETS) {
      const btn = document.createElement('button');
      btn.className = `freq-btn${preset.hours === -1 ? ' off' : ''}`;
      btn.textContent = preset.label;

      loadActive().then((active) => {
        if (preset.hours === active) btn.classList.add('active');
      });

      btn.addEventListener('click', () => {
        for (const sibling of dial.querySelectorAll('.freq-btn')) {
          sibling.classList.remove('active');
        }
        btn.classList.add('active');

        this.setFrequencyOverride(category, preset.hours);
        recordDiagnostic({
          source: 'content',
          level: 'info',
          event: 'NUDGE_FREQUENCY_CHANGED',
          details: `Category: ${category}, set to: ${preset.label} (${preset.hours}h)`,
        });

        if (preset.hours === -1) {
          setTimeout(() => this.removePrompt(), 600);
        }
      });

      dial.appendChild(btn);
    }

    row.appendChild(dial);
    return row;
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

  private static styleSheet(): string {
    return `
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
      .circular-btn.clicked {
        background: #059669; color: #ffffff;
        cursor: default; opacity: 0.8;
      }
      .circular-btn.clicked:hover { opacity: 0.8; }
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
      .frequency-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
      }
      .frequency-label {
        font-size: 10px;
        color: #9ca3af;
        white-space: nowrap;
      }
      .frequency-dial {
        display: flex;
        gap: 4px;
        flex: 1;
      }
      .freq-btn {
        flex: 1;
        padding: 3px 0;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        background: #f9fafb;
        color: #6b7280;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s ease;
      }
      .freq-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
      .freq-btn.active {
        background: #ecfdf5;
        border-color: #10b981;
        color: #065f46;
      }
      .freq-btn.off { color: #ef4444; }
      .freq-btn.off.active {
        background: #fef2f2;
        border-color: #f87171;
        color: #dc2626;
      }
    ` + FOOD_STYLES;
  }

  private displayIntervention(scenario: ScenarioType): void {
    if (document.getElementById('acam-overlay-host')) return;

    this.container = document.createElement('div');
    this.container.id = 'acam-overlay-host';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = ACAMContentScript.styleSheet();

    // Safe DOM Construction (No dynamic innerHTML)
    const card = document.createElement('div');
    card.className = 'acam-card';

    const header = document.createElement('div');
    header.className = 'acam-header';

    const category = scenario === 'scenario-c' ? this.detectProductCategory() : null;
    const catConfig = category ? CATEGORY_CONFIG[category] : null;

    const badge = document.createElement('span');
    badge.className = `pill-badge ${scenario === 'scenario-a' ? 'active-civic' : 'passive-eco'}`;
    badge.textContent = scenario === 'scenario-a' ? '🏛️ Civic Action Nudge' : (catConfig?.badge ?? '♻️ Compare Circular Options');

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
      scenario === 'scenario-a' ? 'Turn Climate Anxiety into Action' : (catConfig?.title ?? 'Find Refurbished Alternatives');
    card.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.className = 'description';
    descEl.textContent =
      scenario === 'scenario-a'
        ? 'Reading climate policy? Send a 1-click prompt to your local representative supporting regional clean energy transition.'
        : (catConfig?.description ?? 'Manufacturing accounts for ~80% of electronics emissions. Compare verified second-life options to avoid high factory carbon.');
    card.appendChild(descEl);

    const snippetEl = document.createElement('div');
    snippetEl.className = 'snippet-box';
    card.appendChild(snippetEl);

    const actionContainer = document.createElement('div');
    actionContainer.id = 'action-container';
    actionContainer.className = 'action-row';
    card.appendChild(actionContainer);

    if (scenario === 'scenario-c' && category) {
      recordDiagnostic({
        source: 'content',
        level: 'info',
        event: 'NUDGE_SHOWN',
        details: `Category: ${category}`,
      });
    }

    if (scenario === 'scenario-a') {
      snippetEl.textContent = 'Finding relevant climate actions for your region...';

      const actionBtn = document.createElement('button');
      actionBtn.id = 'action-btn';
      actionBtn.className = 'btn btn-primary';
      actionBtn.textContent = 'Take Action (+50 pts)';
      actionBtn.disabled = true;
      actionContainer.appendChild(actionBtn);

      chrome.runtime.sendMessage({ type: 'GET_CIVIC_ACTIONS' }, (resp) => {
        if (!resp || !resp.actions || resp.actions.length === 0) {
          snippetEl.textContent = '"Urging swift passage of renewable energy standards in our district..."';
          actionBtn.textContent = 'Send with 1-Click (+50 pts)';
          actionBtn.disabled = false;
          actionBtn.addEventListener('click', () => {
            this.executeCivicAction(card, null);
          });
          return;
        }

        const topAction = resp.actions[0];
        const sigText = topAction.signatures ? ` — ${topAction.signatures.toLocaleString()} signatures` : '';
        snippetEl.textContent = `${topAction.title}${sigText}`;

        const regionLabel = resp.region.countryName || resp.region.country;
        titleEl.textContent = `Climate Action in ${regionLabel}`;
        descEl.textContent = topAction.frame || `${topAction.platform}: Take action on a real ${topAction.type} relevant to your browsing interests.`;

        actionBtn.textContent = `Take Action (+50 pts)`;
        actionBtn.disabled = false;
        actionBtn.addEventListener('click', () => {
          this.executeCivicAction(card, topAction.url);
        });
      });
    } else {
      const productTitle = this.extractProductTitle();
      snippetEl.textContent = `Target: ${productTitle} (${catConfig?.co2Note ?? 'Save up to ~65 kg CO₂e'})`;

      const group = catConfig?.group ?? 'circular_marketplace';
      const partners = partnersInGroup(group);
      const btnMap: Record<string, HTMLButtonElement> = {};

      for (const provider of partners) {
        const btn = document.createElement('button');
        btn.className = 'btn circular-btn';
        btn.textContent = provider.name;
        const targetUrl = buildSearchUrl(provider, productTitle);

        btn.addEventListener('click', () => {
          if (btn.classList.contains('clicked')) return;
          if (category) this.recordNudgeShown(category);
          recordDiagnostic({
            source: 'content',
            level: 'info',
            event: 'NUDGE_CLICKED',
            details: `Category: ${category}, partner: ${provider.name}`,
          });
          btn.classList.add('clicked');
          btn.textContent = `✓ ${provider.name}`;
          this.executeCircularRedirectQuiet(targetUrl, provider.name);
        });
        actionContainer.appendChild(btn);
        btnMap[provider.id] = btn;
      }

      chrome.runtime.sendMessage(
        { type: 'CHECK_AVAILABILITY', payload: { group, query: productTitle } },
        (resp) => {
          const avail: Record<string, boolean> = resp?.availability ?? {};
          let anyVisible = false;
          for (const [id, btn] of Object.entries(btnMap)) {
            if (avail[id] === true) {
              anyVisible = true;
            } else {
              btn.style.display = 'none';
            }
          }
          if (!anyVisible) {
            card.remove();
            return;
          }
          snippetEl.textContent = `Target: ${productTitle} (${catConfig?.co2Note ?? 'Save up to ~65 kg CO₂e'})`;
          card.style.display = '';
        },
      );

      const freqRow = this.buildFrequencyDial(category!);
      card.appendChild(freqRow);
    }

    const recId = scenario === 'scenario-a' ? 'civic_action' : `circular_${category ?? 'unknown'}`;
    const recTitle = scenario === 'scenario-a' ? 'Civic Action' : `${category ?? 'Shopping'} Nudge`;
    card.appendChild(this.buildFeedbackSection(recId, recTitle));

    closeBtn.addEventListener('click', () => {
      if (category) {
        this.recordNudgeShown(category);
        recordDiagnostic({
          source: 'content',
          level: 'info',
          event: 'NUDGE_DISMISSED',
          details: `Category: ${category}`,
        });
      }
      this.removePrompt();
    });

    if (scenario !== 'scenario-a') {
      card.style.display = 'none';
    }

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);
    document.body.appendChild(this.container);
  }

  /** Looks for a recipe once the page has had time to render, and asks the background for a swap. */
  private armRecipeDetection(): void {
    setTimeout(() => {
      if (this.triggered) return;
      const recipe = detectRecipe(document);
      if (!recipe) return;
      recordDiagnostic({
        source: 'content',
        level: 'info',
        event: 'RECIPE_DETECTED',
        details: `via=${recipe.via} ingredients=${recipe.ingredients.length}`,
      });
      chrome.runtime.sendMessage(
        {
          type: 'ANALYZE_RECIPE',
          payload: {
            name: recipe.name,
            ingredients: recipe.ingredients,
            recipeYield: recipe.recipeYield,
            keywords: recipe.keywords,
            category: recipe.category,
            cuisine: recipe.cuisine,
          },
        },
        (response?: { suggestion?: RecipeSuggestionView | null }) => {
          if (chrome.runtime.lastError) return;
          const suggestion = response?.suggestion;
          if (suggestion && !this.triggered) this.displayFoodCard(suggestion);
        }
      );
    }, 1500);
  }

  private displayFoodCard(view: RecipeSuggestionView): void {
    if (document.getElementById('acam-overlay-host')) return;
    this.triggered = true;
    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'INTERVENTION_MOUNTED',
      details: `Shadow DOM intervention mounted for food swap ${view.ruleId}`,
    });

    this.container = document.createElement('div');
    this.container.id = 'acam-overlay-host';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ACAMContentScript.styleSheet();

    const card = document.createElement('div');
    card.className = 'acam-card';

    const header = document.createElement('div');
    header.className = 'acam-header';
    const badge = document.createElement('span');
    badge.className = 'pill-badge passive-eco';
    badge.textContent = '🥗 Lower-carbon swap';
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-btn';
    closeBtn.className = 'dismiss-btn';
    closeBtn.textContent = '×';
    header.append(badge, closeBtn);

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.textContent = view.title;

    const descEl = document.createElement('p');
    descEl.className = 'description';
    descEl.textContent = view.summary;

    const list = document.createElement('ul');
    list.className = 'detail-list';
    list.id = 'swap-amounts';
    const lines = [
      `${view.fromLabel}: ${view.fromGramsBefore} g → ${view.fromGramsAfter} g`,
      `${view.toLabel}: add ${view.toGrams} g`,
      view.dishReductionPercent !== null
        ? `Whole recipe: about ${view.dishReductionPercent}% less CO₂e`
        : `Those ingredients: about ${view.lineReductionPercent}% less CO₂e`,
    ];
    for (const line of lines) {
      const item = document.createElement('li');
      item.textContent = line;
      list.appendChild(item);
    }

    const fine = document.createElement('p');
    fine.className = 'fine-print';
    fine.textContent = `${view.caveat ?? ''} Based on ${view.evidenceCount} published recipes. Estimates only.`.trim();

    const actionContainer = document.createElement('div');
    actionContainer.id = 'action-container';
    actionContainer.className = 'action-row';

    const acceptBtn = document.createElement('button');
    acceptBtn.id = 'swap-accept-btn';
    acceptBtn.className = 'btn btn-primary';
    acceptBtn.textContent = "I'll cook it this way";
    acceptBtn.addEventListener('click', () => this.acceptFoodSwap(view, card));

    const skipBtn = document.createElement('button');
    skipBtn.id = 'swap-skip-btn';
    skipBtn.className = 'btn btn-quiet';
    skipBtn.textContent = 'Not for me';
    skipBtn.addEventListener('click', () => this.removePrompt());
    actionContainer.append(acceptBtn, skipBtn);

    card.append(header, titleEl, descEl, list, fine, actionContainer);
    closeBtn.addEventListener('click', () => this.removePrompt());
    this.shadowRoot.append(style, card);
    document.body.appendChild(this.container);
  }

  private acceptFoodSwap(view: RecipeSuggestionView, card: HTMLElement): void {
    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'ACTION_EXECUTED',
      details: `Food swap accepted: ${view.ruleId}`,
    });
    chrome.runtime.sendMessage(
      {
        type: 'RECORD_ACTION',
        payload: {
          actionId: `food_swap_${view.ruleId}`,
          label: view.title,
          co2SavedKg: view.co2eSavedKg,
          points: REWARDS.foodSwap.points,
        },
      },
      () => {
        this.showSuccessMessage(
          card,
          '✓ Nice swap!',
          `About ${view.co2eSavedKg} kg CO₂e saved`,
          { recId: `food_swap_${view.ruleId}`, recTitle: view.title }
        );
      }
    );
  }

  private showSuccessMessage(
    card: HTMLElement,
    titleText: string,
    subText: string,
    recContext?: { recId: string; recTitle: string }
  ): void {
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
  }

  private buildFeedbackSection(recId: string, recTitle: string): HTMLElement {
    const feedback = document.createElement('div');
    feedback.className = 'feedback-section';

    const label = document.createElement('div');
    label.className = 'feedback-label';
    label.textContent = 'Was this helpful? (+10 pts)';

    const voteRow = document.createElement('div');
    voteRow.className = 'feedback-vote-row';

    const upBtn = document.createElement('button');
    upBtn.className = 'vote-btn';
    upBtn.textContent = '\u{1F44D} Yes';

    const downBtn = document.createElement('button');
    downBtn.className = 'vote-btn';
    downBtn.textContent = '\u{1F44E} No';

    let selectedVote: 'up' | 'down' | null = null;

    const onVote = (vote: 'up' | 'down') => {
      selectedVote = vote;
      upBtn.className = vote === 'up' ? 'vote-btn selected' : 'vote-btn';
      downBtn.className = vote === 'down' ? 'vote-btn selected' : 'vote-btn';
      submitBtn.disabled = false;
    };

    upBtn.addEventListener('click', () => onVote('up'));
    downBtn.addEventListener('click', () => onVote('down'));
    voteRow.append(upBtn, downBtn);

    const commentInput = document.createElement('textarea');
    commentInput.className = 'feedback-comment';
    commentInput.placeholder = 'Tell us why (optional)';
    commentInput.rows = 1;

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-feedback';
    submitBtn.textContent = 'Submit Feedback (+10 pts)';
    submitBtn.disabled = true;

    submitBtn.addEventListener('click', () => {
      if (!selectedVote) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      chrome.runtime.sendMessage(
        {
          type: 'RECORD_FEEDBACK',
          payload: { recId, recTitle, vote: selectedVote, comment: commentInput.value.trim() },
        },
        () => {
          submitBtn.textContent = '✓ Thanks! +10 pts';
        }
      );
    });

    feedback.append(label, voteRow, commentInput, submitBtn);
    return feedback;
  }

  private executeCivicAction(card: HTMLElement, actionUrl: string | null): void {
    if (actionUrl) {
      openOutbound(actionUrl, { source: 'content', placement: 'civic-action' });
    }

    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'ACTION_EXECUTED',
      details: `Civic action opened (+50 pts)${actionUrl ? '' : ' (generic fallback)'}`,
    });
    chrome.runtime.sendMessage(
      {
        type: 'RECORD_ACTION',
        payload: {
          actionId: 'civic_petition_sent',
          label: 'Civic Action',
          co2SavedKg: REWARDS.civicLetter.co2SavedKg,
          points: REWARDS.civicLetter.points,
        },
      },
      () => {
        this.showSuccessMessage(
          card,
          '✓ Civic Action Opened!',
          '+50 points earned | Every signature counts'
        );
      }
    );
  }

  private executeCircularRedirectQuiet(targetUrl: string, provider: string): void {
    recordDiagnostic({
      source: 'content',
      level: 'info',
      event: 'CIRCULAR_REDIRECT',
      details: `Dispatched circular marketplace redirect: ${provider} (+80 pts)`,
    });
    if (targetUrl) {
      openOutbound(targetUrl, { source: 'content', placement: 'in-page' });
    }

    chrome.runtime.sendMessage({
      type: 'RECORD_ACTION',
      payload: {
        actionId: 'circular_marketplace_search',
        label: `${provider} Search`,
        co2SavedKg: REWARDS.circularSearch.co2SavedKg,
        points: REWARDS.circularSearch.points,
      },
    });
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
