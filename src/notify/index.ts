import type { Config } from '../config.js';
import type { Listing, MatchResult } from '../types.js';
import { TelegramNotifier } from './telegram.js';
import { EmailNotifier } from './email.js';
import { log } from '../util/log.js';
import { sleep } from '../util/http.js';

/**
 * Fans a hit out to every configured channel. Telegram is the primary path;
 * email only fires when Telegram is not configured or its send failed, so a
 * working bot never doubles up your inbox.
 */
export class Notifier {
  private readonly telegram: TelegramNotifier;
  private readonly email: EmailNotifier;

  constructor(private readonly cfg: Config) {
    this.telegram = new TelegramNotifier(cfg);
    this.email = new EmailNotifier(cfg);
    if (!this.telegram.enabled && !this.email.enabled) {
      log.warn('noben kanal za obvescanje ni nastavljen — nastavi TELEGRAM_* v .env');
    }
  }

  get enabled(): boolean {
    return this.telegram.enabled || this.email.enabled;
  }

  async notify(listing: Listing, match: MatchResult): Promise<boolean> {
    log.info(`obvestilo (${match.score}): ${listing.title.slice(0, 80)} — ${listing.url}`);
    const sent = this.telegram.enabled ? await this.telegram.notify(listing, match) : false;
    const ok = sent || (await this.email.notify(listing, match));
    // Telegram rate limit for a single chat is ~1 msg/s; stay well under it.
    await sleep(1200);
    return ok;
  }

  /** Plain status line (startup, errors) — no listing attached. */
  async info(text: string): Promise<boolean> {
    const sent = this.telegram.enabled ? await this.telegram.send(text) : false;
    return sent || (await this.email.send('[najem] obvestilo', text));
  }
}
