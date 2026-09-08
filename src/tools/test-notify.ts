import 'dotenv/config';
import { loadConfig } from '../config.js';
import { Notifier } from '../notify/index.js';
import { matches } from '../filter.js';
import type { Listing } from '../types.js';

/**
 * Sends one fake listing through the real notification path. Use it to verify
 * the Telegram token/chat id from your phone before trusting the watcher.
 */
async function main(): Promise<void> {
  const cfg = loadConfig();
  const notifier = new Notifier(cfg);

  if (!notifier.enabled) {
    console.error(
      'Noben kanal ni nastavljen. V .env vpisi TELEGRAM_BOT_TOKEN in TELEGRAM_CHAT_ID.',
    );
    process.exit(1);
  }

  const sample: Listing = {
    id: 'test:1',
    source: 'test',
    url: 'https://www.nepremicnine.net/oglasi-oddaja/ljubljana-mesto/posamezna-soba/',
    title: 'TEST: Enoposteljna soba, Ljubljana Bezigrad, takoj vseljivo',
    price: Math.max(cfg.minPrice, Math.min(cfg.maxPrice, 380)),
    areaM2: 18,
    location: 'Ljubljana Bezigrad',
    description: 'Testno obvestilo iz najem-watcherja. Ce to vidis na telefonu, vse dela.',
  };

  const ok = await notifier.notify(sample, matches(sample, cfg));
  if (!ok) {
    console.error('Poslati ni uspelo — preveri TELEGRAM_BOT_TOKEN in TELEGRAM_CHAT_ID zgoraj.');
    process.exit(1);
  }
  console.log('Poslano. Preveri telefon.');
}

void main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
