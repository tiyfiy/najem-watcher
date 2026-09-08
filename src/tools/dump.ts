import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from '../config.js';
import { fetchText } from '../util/http.js';
import { fetchRendered, closeBrowser } from '../util/browser.js';
import { parseNepremicnine } from '../sources/nepremicnine.js';
import { parseBolha } from '../sources/bolha.js';
import { parseMkvadrat } from '../sources/mkvadrat.js';
import { parseFeed } from '../sources/rss.js';
import type { Listing } from '../types.js';

/**
 * Diagnostic: fetch one search URL, run the matching parser, print what it
 * understood and save the raw HTML to dump.html for inspection.
 *   npm run dump -- "https://www.nepremicnine.net/oglasi-oddaja/..."
 * Add --browser to force the headless-browser path for any URL.
 */
async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url || url.startsWith('--')) {
    console.error('uporaba: npm run dump -- "<url iskanja>" [--browser]');
    process.exit(1);
  }

  const cfg = loadConfig();
  const host = new URL(url).hostname;
  const useBrowser = host.includes('nepremicnine') || process.argv.includes('--browser');
  const body = useBrowser
    ? await fetchRendered(url, cfg)
    : await fetchText(url, { userAgent: cfg.userAgent });
  await closeBrowser();
  await writeFile('dump.html', body, 'utf8');

  let listings: Listing[];
  if (host.includes('nepremicnine')) listings = parseNepremicnine(body, url);
  else if (host.includes('bolha')) listings = parseBolha(body, url);
  else if (host.includes('mkvadrat')) listings = parseMkvadrat(body, url);
  else if (/^\s*(<\?xml|<rss|<feed)/i.test(body)) listings = parseFeed(body, url);
  else listings = parseNepremicnine(body, url);

  console.log(`\n${listings.length} oglasov razbranih iz ${url}`);
  console.log(`raw HTML shranjen v dump.html (${body.length} bajtov)${useBrowser ? ' [browser]' : ''}\n`);
  for (const l of listings.slice(0, 15)) {
    console.log(`- ${l.price ?? '?'} € | ${l.areaM2 ?? '?'} m² | ${l.title.slice(0, 70)}`);
    console.log(`  ${l.url}`);
  }
  if (listings.length === 0) {
    console.log('Nic najdenega: odpri dump.html in preveri, kaksne so povezave do oglasov.');
  }
}

void main().catch(async (err) => {
  console.error(String(err));
  await closeBrowser();
  process.exit(1);
});
