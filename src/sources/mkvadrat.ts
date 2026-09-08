import * as cheerio from 'cheerio';
import type { Config } from '../config.js';
import type { Listing, Source } from '../types.js';
import { fetchText, parsePrice, parseArea, absoluteUrl, normalize, sleep } from '../util/http.js';
import { adCard } from '../util/scrape.js';
import { log } from '../util/log.js';

/** Room pages are /seznam-prostih-sob/<id>; the whole card is that anchor. */
const AD_PATH = /\/seznam-prostih-sob\/(\d+)\/?$/i;

export function parseMkvadrat(html: string, baseUrl: string): Listing[] {
  const $ = cheerio.load(html);
  const byId = new Map<string, Listing>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const path = href.split('?')[0] ?? href;
    const adId = AD_PATH.exec(path)?.[1];
    if (!adId || byId.has(adId)) return;

    // The anchor is the card itself here; adCard covers a future redesign
    // where the price moves outside it.
    const node = /€|EUR/i.test($(el).text()) ? $(el) : adCard($, $(el), AD_PATH);
    const blockText = normalize(node.text());

    const kind = normalize(node.find('h4').first().text());
    const area = normalize(node.find('.tag').first().text());
    const address = normalize(node.find('.address').first().text()).replace(/^,\s*/, '');
    const title = [area, kind, address].filter(Boolean).join(' · ') || blockText.slice(0, 120);

    byId.set(adId, {
      id: `mkvadrat:${adId}`,
      source: 'mkvadrat.si',
      url: absoluteUrl(path, baseUrl),
      title: title.slice(0, 160),
      price: parsePrice(blockText),
      areaM2: parseArea(blockText),
      location: address || undefined,
      description: blockText.slice(0, 400),
    });
  });

  return [...byId.values()];
}

export function mkvadratSource(cfg: Config): Source {
  return {
    name: 'mkvadrat.si',
    async fetchListings(): Promise<Listing[]> {
      const all: Listing[] = [];
      for (const url of cfg.mkvadratUrls) {
        try {
          const html = await fetchText(url, { userAgent: cfg.userAgent });
          const listings = parseMkvadrat(html, url);
          log.info(`mkvadrat.si: ${listings.length} sob iz ${url}`);
          all.push(...listings);
        } catch (err) {
          log.error(`mkvadrat.si failed for ${url}: ${String(err)}`);
        }
        await sleep(1500);
      }
      return all;
    },
  };
}
