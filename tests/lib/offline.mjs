/**
 * Keeps browser tests off the real network. Every http(s) request from a page is answered with a
 * small static document, so a page at https://example.com/?scenario=a loads the same way on every
 * machine, with or without internet. Extension pages (chrome-extension:) are left alone.
 */

const STUB_HTML = '<!doctype html><html><head><meta charset="utf-8"><title>Offline fixture</title></head><body><h1>Offline fixture</h1></body></html>';

const prepared = new WeakSet();

export async function goOffline(page) {
  if (prepared.has(page)) return page;
  prepared.add(page);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return;
    if (/^https?:/i.test(request.url())) {
      request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB_HTML }).catch(() => {});
    } else {
      request.continue().catch(() => {});
    }
  });
  return page;
}

/** A new tab that never reaches the network. */
export async function newOfflinePage(browser) {
  return goOffline(await browser.newPage());
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
