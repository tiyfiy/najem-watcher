import 'dotenv/config';
import { chromium } from 'playwright';
import { loadConfig } from '../config.js';

/**
 * One-off interactive Facebook login. Opens a real window, you log in by hand,
 * and the session is persisted in FACEBOOK_STATE_PATH so the scraper can reuse
 * it. Use a burner account — automated group reading violates FB's terms.
 */
async function main(): Promise<void> {
  const cfg = loadConfig();
  const ctx = await chromium.launchPersistentContext(cfg.facebookStatePath, {
    headless: false,
    userAgent: cfg.userAgent,
    viewport: { width: 1280, height: 1000 },
  });
  const page = await ctx.newPage();
  await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded' });

  console.log('Prijavi se v oknu, ki se je odprlo. Ko koncas, pritisni Enter tukaj.');
  const { promise, resolve } = Promise.withResolvers<void>();
  process.stdin.once('data', () => resolve());
  await promise;

  await ctx.close();
  console.log(`Seja shranjena v ${cfg.facebookStatePath}`);
}

void main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
