import { chromium, type Browser } from 'playwright';
import type { Config } from '../config.js';
import { log } from './log.js';

/**
 * Some portals (nepremicnine.net) reject every non-browser TLS handshake with
 * HTTP 403, so plain `fetch` can never read them. One headless Chromium is
 * launched lazily and kept alive for the whole process; each page load gets a
 * fresh context so cookies do not accumulate into a fingerprint.
 */
let launching: Promise<Browser> | undefined;

function getBrowser(): Promise<Browser> {
  // Assignment must happen synchronously: sources run concurrently, and an
  // `await` before it lets every caller spawn its own Chromium. The orphans
  // then keep the event loop alive and the process never exits.
  launching ??= chromium
    .launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    .then((browser) => {
      log.info('browser: headless chromium zagnan');
      // A crashed browser must not be handed out again.
      browser.on('disconnected', () => {
        launching = undefined;
      });
      return browser;
    })
    .catch((err: unknown) => {
      launching = undefined;
      throw err;
    });
  return launching;
}

export async function fetchRendered(url: string, cfg: Config): Promise<string> {
  const ctx = await (await getBrowser()).newContext({
    userAgent: cfg.userAgent,
    locale: 'sl-SI',
    viewport: { width: 1366, height: 900 },
  });
  try {
    const page = await ctx.newPage();
    // Images/fonts/media are pure bandwidth for a text scrape.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'font' || type === 'media') return route.abort();
      return route.continue();
    });
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()} for ${url}`);
    // Listing grids finish rendering shortly after DOMContentLoaded.
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await ctx.close();
  }
}

export async function closeBrowser(): Promise<void> {
  const pending = launching;
  if (!pending) return;
  launching = undefined;
  await pending.then((browser) => browser.close()).catch(() => undefined);
}
