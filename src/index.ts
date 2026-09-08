import 'dotenv/config';
import { loadConfig } from './config.js';
import { Store } from './store.js';
import { buildSources } from './sources/index.js';
import { matches } from './filter.js';
import { Notifier } from './notify/index.js';
import { sleep } from './util/http.js';
import { closeBrowser } from './util/browser.js';
import { log } from './util/log.js';
import type { Listing } from './types.js';

const runOnce = process.argv.includes('--once');
let stopping = false;

async function runCycle(
  cfg: ReturnType<typeof loadConfig>,
  store: Store,
  notifier: Notifier,
): Promise<void> {
  const sources = buildSources(cfg);
  if (sources.length === 0) {
    log.warn('noben vir ni nastavljen — poglej .env');
    return;
  }

  const results = await Promise.allSettled(sources.map((s) => s.fetchListings()));
  const listings: Listing[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') listings.push(...r.value);
    else log.error(`vir ${sources[i]?.name} je padel: ${String(r.reason)}`);
  });

  const fresh = listings.filter((l) => !store.has(l.id));
  log.info(`cikel: ${listings.length} oglasov, ${fresh.length} novih`);

  // First run: remember everything silently so you don't get 200 pings.
  if (!store.bootstrapped) {
    for (const l of listings) store.add(l.id);
    store.markBootstrapped();
    await store.flush();
    await notifier.info(
      `✅ Najem-watcher zagnan. Prvi cikel: ${listings.length} obstoječih oglasov zabeleženih, obveščal te bom samo o novih.`,
    );
    return;
  }

  const hits = fresh
    .map((listing) => ({ listing, match: matches(listing, cfg) }))
    .filter(({ match }) => match.ok)
    .sort((a, b) => b.match.score - a.match.score);

  for (const l of fresh) store.add(l.id);
  await store.flush();

  for (const { listing, match } of hits) {
    if (stopping) break;
    await notifier.notify(listing, match);
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = new Store(cfg.dbPath);
  await store.load();
  const notifier = new Notifier(cfg);

  log.info(`start: interval ${cfg.pollSeconds}s (+/-${cfg.jitterSeconds}s), max ${cfg.maxPrice} €`);

  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    log.info('zaustavljam…');
    await store.flush();
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  while (!stopping) {
    const started = Date.now();
    try {
      await runCycle(cfg, store, notifier);
    } catch (err) {
      log.error(`cikel je padel: ${String(err)}`);
    }
    if (runOnce) break;

    const jitter = Math.round((Math.random() * 2 - 1) * cfg.jitterSeconds * 1000);
    const wait = Math.max(10_000, cfg.pollSeconds * 1000 + jitter - (Date.now() - started));
    await sleep(wait);
  }
  await store.flush();
  await closeBrowser();
}

void main().catch((err) => {
  log.error(`fatalna napaka: ${String(err)}`);
  process.exit(1);
});
