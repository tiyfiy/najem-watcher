import * as cheerio from 'cheerio';
import type { Config } from '../config.js';
import type { Listing, Source } from '../types.js';
import { parsePrice, parseArea, absoluteUrl, normalize, sleep } from '../util/http.js';
import { fetchRendered } from '../util/browser.js';
import { adCard } from '../util/scrape.js';
import { log } from '../util/log.js';

/** Detail pages end in -oglas-<id>, e.g. /nepremicnine/…-32.00-m2-oglas-15528280. */
const AD_PATH = /-oglas-(\d{5,})\/?$/i;

/**
 * Same defensive strategy as the nepremicnine parser: anchors to detail pages,
 * then climb to the nearest ancestor that carries a price.
 */
export function parseBolha(html: string, baseUrl: string): Listing[] {
  const $ = cheerio.load(html);
  const byId = new Map<string, Listing>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const path = href.split('?')[0] ?? href;
    const adId = AD_PATH.exec(path)?.[1];
    if (!adId || byId.has(adId)) return;

    const node = adCard($, $(el), AD_PATH);

    const blockText = normalize(node.text());
    const anchorText = normalize($(el).attr('title') ?? $(el).text());
    const title =
      anchorText.length > 8
        ? anchorText
        : normalize(node.find('h3,h2,.entity-title').first().text()) ||
          (path.split('/').pop() ?? 'oglas').replace(/-/g, ' ');

    const img = node.find('img').first().attr('src') ?? node.find('img').first().attr('data-src');

    byId.set(adId, {
      id: `bolha:${adId}`,
      source: 'bolha.com',
      url: absoluteUrl(path, baseUrl),
      title: title.slice(0, 160),
      price: parsePrice(blockText),
      areaM2: parseArea(blockText),
      description: blockText.slice(0, 400),
      imageUrl: img ? absoluteUrl(img, baseUrl) : undefined,
    });
  });

  return [...byId.values()];
}

export function bolhaSource(cfg: Config): Source {
  return {
    name: 'bolha.com',
    async fetchListings(): Promise<Listing[]> {
      const all: Listing[] = [];
      for (const url of cfg.bolhaUrls) {
        try {
          // Plain HTTP gets a Radware bot-manager captcha page (HTTP 200 with
          // no ads), so this source also goes through the headless browser.
          const html = await fetchRendered(url, cfg);
          const listings = parseBolha(html, url);
          log.info(`bolha.com: ${listings.length} oglasov iz ${url}`);
          all.push(...listings);
        } catch (err) {
          log.error(`bolha.com failed for ${url}: ${String(err)}`);
        }
        await sleep(2500);
      }
      return all;
    },
  };
}
