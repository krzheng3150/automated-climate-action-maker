/**
 * Keeps browser tests off the real network. Every http(s) request from a page is answered with a
 * small static document, so a page at https://example.com/?scenario=a loads the same way on every
 * machine, with or without internet. Extension pages (chrome-extension:) are left alone.
 */

const STUB_HTML = '<!doctype html><html><head><meta charset="utf-8"><title>Offline fixture</title></head><body><h1>Offline fixture</h1></body></html>';

const prepared = new WeakSet();
// Shared by every page, so routes registered for one tab also work for tabs prepared by keepBrowserOffline.
const servedPages = {};

/** Pages served for specific URLs (any other http(s) URL gets the stub). Keys are full URLs without the query string. */
export async function goOffline(page, routes = {}) {
  Object.assign(servedPages, routes);
  if (prepared.has(page)) return page;
  prepared.add(page);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return;
    if (/^https?:/i.test(request.url())) {
      const body = servedPages[request.url().split('?')[0]] ?? STUB_HTML;
      request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body }).catch(() => {});
    } else {
      request.continue().catch(() => {});
    }
  });
  return page;
}

/** A new tab that never reaches the network. */
export async function newOfflinePage(browser, routes = {}) {
  return goOffline(await browser.newPage(), routes);
}

/** Also covers tabs the extension opens itself (for example partner links). */
export function keepBrowserOffline(browser) {
  browser.on('targetcreated', async (target) => {
    if (target.type() !== 'page') return;
    try {
      const page = await target.page();
      if (page) await goOffline(page);
    } catch {
      // The tab closed before it could be prepared.
    }
  });
}
