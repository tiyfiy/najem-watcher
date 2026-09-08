import type { AnyNode } from 'domhandler';
import type { Cheerio, CheerioAPI } from 'cheerio';

/**
 * Find the card element that belongs to one ad link.
 *
 * Portals put the price in a sibling of the title anchor, so we have to climb.
 * The climb stops as soon as the block holds a price OR would start covering a
 * second ad — without that guard, an ad with no visible price swallows the
 * whole grid and inherits its neighbour's price, area and title.
 */
export function adCard(
  $: CheerioAPI,
  anchor: Cheerio<AnyNode>,
  adPattern: RegExp,
): Cheerio<AnyNode> {
  let node = anchor.closest('li,article,div');
  if (node.length === 0) node = anchor.parent();

  for (let i = 0; i < 5; i++) {
    if (/€|EUR/i.test(node.text())) break;
    const parent = node.parent();
    if (parent.length === 0) break;

    const adLinks = new Set<string>();
    parent.find('a[href]').each((_, a) => {
      const href = $(a).attr('href')?.split('?')[0] ?? '';
      const id = adPattern.exec(href)?.[1];
      if (id) adLinks.add(id);
    });
    if (adLinks.size > 1) break;

    node = parent;
  }
  return node;
}
