import type { Config } from '../config.js';
import type { Listing, MatchResult } from '../types.js';
import { log } from '../util/log.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatTelegram(listing: Listing, match: MatchResult, cfg: Config): string {
  const price =
    listing.price !== undefined
      ? `${listing.price} €${listing.extras ? ` + ${listing.extras} € stroški` : ''}`
      : 'cena ni navedena';
  const area = listing.areaM2 ? ` · ${listing.areaM2} m²` : '';

  return [
    `🏠 <b>${escapeHtml(listing.title)}</b>`,
    `💶 ${escapeHtml(price)}${area}`,
    `📍 ${escapeHtml(listing.source)}${listing.location ? ` · ${escapeHtml(listing.location)}` : ''}`,
    `⭐ ${match.score} — ${escapeHtml(match.reasons.join(', '))}`,
    '',
    `<a href="${escapeHtml(listing.url)}">Odpri oglas</a>`,
    '',
    '<b>Sporočilo za kopiranje:</b>',
    `<pre>${escapeHtml(cfg.inquiryTemplate)}</pre>`,
  ].join('\n');
}

export class TelegramNotifier {
  constructor(private readonly cfg: Config) {}

  get enabled(): boolean {
    return Boolean(this.cfg.telegramToken && this.cfg.telegramChatId);
  }

  async send(text: string): Promise<boolean> {
    if (!this.enabled) return false;
    const url = `https://api.telegram.org/bot${this.cfg.telegramToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.cfg.telegramChatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });
      if (res.ok) return true;
      log.error(`telegram send failed: HTTP ${res.status} ${await res.text()}`);
    } catch (err) {
      log.error(`telegram send failed: ${String(err)}`);
    }
    return false;
  }

  async notify(listing: Listing, match: MatchResult): Promise<boolean> {
    return this.send(formatTelegram(listing, match, this.cfg));
  }
}
