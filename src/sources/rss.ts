import * as cheerio from 'cheerio';
import type { Config } from '../config.js';
import type { Listing, Source } from '../types.js';
import { fetchText, parsePrice, parseArea, normalize, sleep } from '../util/http.js';
import { log } from '../util/log.js';

/** Handles both RSS 2.0 (<item>) and Atom (<entry>). */
export function parseFeed(xml: string, feedUrl: string): Listing[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const listings: Listing[] = [];

  $('item, entry').each((_, el) => {
    const node = $(el);
    const title = normalize(node.find('title').first().text());
    const link =
      normalize(node.find('link').first().text()) ||
      node.find('link').first().attr('href') ||
      '';
    if (!link) return;

    const body = normalize(
      node.find('description').first().text() || node.find('summary,content').first().text(),
    );
    const guid = normalize(node.find('guid,id').first().text()) || link;
    const published = normalize(node.find('pubDate,updated,published').first().text());
    const haystack = `${title} ${body}`;

    listings.push({
      id: `rss:${guid}`,
      source: new URL(feedUrl).hostname,
      url: link,
      title: title.slice(0, 160) || link,
      price: parsePrice(haystack),
      areaM2: parseArea(haystack),
      description: body.slice(0, 400),
      publishedAt: published || undefined,
    });
  });

  return listings;
}

export function rssSource(cfg: Config): Source {
  return {
    name: 'rss',
    async fetchListings(): Promise<Listing[]> {
      const all: Listing[] = [];
      for (const url of cfg.rssUrls) {
        try {
          const xml = await fetchText(url, { userAgent: cfg.userAgent });
          const listings = parseFeed(xml, url);
          log.info(`rss: ${listings.length} vnosov iz ${url}`);
          all.push(...listings);
        } catch (err) {
          log.error(`rss failed for ${url}: ${String(err)}`);
        }
        await sleep(1000);
      }
      return all;
    },
  };
}
