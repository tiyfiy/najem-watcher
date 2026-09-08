import { chromium } from 'playwright';
import type { Config } from '../config.js';
import type { Listing, Source } from '../types.js';
import { normalize, sleep } from '../util/http.js';
import { log } from '../util/log.js';

/**
 * OPTIONAL and against Facebook's terms of service — use a burner account.
 * Log in once with `npm run fb:login`; the session lives in a persistent
 * profile directory (FACEBOOK_STATE_PATH) that this source reuses.
 */
export function facebookSource(cfg: Config): Source {
  return {
    name: 'facebook',
    async fetchListings(): Promise<Listing[]> {
      const ctx = await chromium.launchPersistentContext(cfg.facebookStatePath, {
        headless: true,
        userAgent: cfg.userAgent,
        viewport: { width: 1280, height: 1000 },
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });

      const all: Listing[] = [];
      try {
        for (const groupUrl of cfg.facebookGroups) {
          const page = await ctx.newPage();
          try {
            await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
            await page.waitForTimeout(4000);
            if (/login|checkpoint/.test(page.url())) {
              log.warn('facebook: seja je potekla — pozeni `npm run fb:login`');
              break;
            }

            const posts = await page.evaluate(() => {
              const out: { id: string; text: string; url: string }[] = [];
              for (const el of Array.from(document.querySelectorAll('div[role="article"]'))) {
                const text = (el as HTMLElement).innerText ?? '';
                if (text.trim().length < 40) continue;
                const link = el.querySelector<HTMLAnchorElement>(
                  'a[href*="/posts/"], a[href*="permalink"]',
                );
                out.push({
                  id: link?.href ?? text.slice(0, 120),
                  text,
                  url: link?.href ?? location.href,
                });
              }
              return out;
            });

            for (const post of posts) {
              const text = normalize(post.text);
              all.push({
                id: `facebook:${post.id.split('?')[0]}`,
                source: 'facebook',
                url: post.url.split('?')[0] ?? post.url,
                title: text.slice(0, 120),
                description: text.slice(0, 400),
              });
            }
            log.info(`facebook: ${posts.length} objav iz ${groupUrl}`);
          } catch (err) {
            log.error(`facebook failed for ${groupUrl}: ${String(err)}`);
          } finally {
            await page.close();
          }
          await sleep(5000);
        }
      } finally {
        await ctx.close();
      }
      return all;
    },
  };
}
