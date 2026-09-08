import * as cheerio from 'cheerio';
import type { Config } from '../config.js';
import type { Listing, Source } from '../types.js';
import { parsePrice, parseArea, absoluteUrl, normalize, sleep } from '../util/http.js';
import { fetchRendered } from '../util/browser.js';
import { adCard } from '../util/scrape.js';
import { log } from '../util/log.js';

/**
 * Detail pages look like /oglasi-oddaja/lj-center-resljeva-stanovanje_7375310/.
 * The trailing numeric id is what makes an ad unique — everything else on the
 * page under /oglasi-oddaja/ is a filter/navigation link.
 */
const AD_PATH = /\/oglasi-oddaja\/[^/]*_(\d{4,})\/?$/i;

/**
 * The site rewrites its markup every so often, so we do not hang on class
 * names: find anchors to ad detail pages, climb to the nearest ancestor that
 * carries a price (in practice `.property-box`), read the fields from there.
 * Verify with `npm run dump -- <url>` after a redesign.
 */
export function parseNepremicnine(html: string, baseUrl: string): Listing[] {
  const $ = cheerio.load(html);
  const byId = new Map<string, Listing>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const path = href.split('?')[0] ?? href;
    const adId = AD_PATH.exec(path)?.[1];
    if (!adId || byId.has(adId)) return;

    const url = absoluteUrl(path, baseUrl);

    const box = $(el).closest('.property-box');
    const node = box.length > 0 ? box : adCard($, $(el), AD_PATH);

    const blockText = normalize(node.text());
    const title =
      normalize($(el).attr('title') ?? '') ||
      normalize(node.find('h2,h3,.url-title-m').first().text()) ||
      slugToTitle(path);

    const img =
      node.find('img').first().attr('data-src') ?? node.find('img').first().attr('src');

    byId.set(adId, {
      id: `nepremicnine:${adId}`,
      source: 'nepremicnine.net',
      url,
      title: title.slice(0, 160),
      price: parsePrice(blockText),
      areaM2: parseArea(blockText),
      description: blockText.slice(0, 400),
      imageUrl: img ? absoluteUrl(img, baseUrl) : undefined,
    });
  });

  return [...byId.values()];
}

function slugToTitle(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? 'oglas';
  return last.replace(/_\d+$/, '').replace(/[-_]/g, ' ');
}

export function nepremicnineSource(cfg: Config): Source {
  return {
    name: 'nepremicnine.net',
    async fetchListings(): Promise<Listing[]> {
      const all: Listing[] = [];
      for (const url of cfg.nepremicnineUrls) {
        try {
          // Plain HTTP always gets 403 here (TLS fingerprinting), so this
          // source goes through a real headless browser.
          const html = await fetchRendered(url, cfg);
          const listings = parseNepremicnine(html, url);
          log.info(`nepremicnine.net: ${listings.length} oglasov iz ${url}`);
          all.push(...listings);
        } catch (err) {
          log.error(`nepremicnine.net failed for ${url}: ${String(err)}`);
        }
        await sleep(2500); // be polite between search pages
      }
      return all;
    },
  };
}
