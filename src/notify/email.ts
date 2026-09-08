import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config.js';
import type { Listing, MatchResult } from '../types.js';
import { log } from '../util/log.js';

/** Fallback channel: slower than Telegram, but survives a broken bot token. */
export class EmailNotifier {
  private transport?: Transporter;

  constructor(private readonly cfg: Config) {}

  get enabled(): boolean {
    return Boolean(this.cfg.smtpHost && this.cfg.smtpUser && this.cfg.smtpPass && this.cfg.emailTo);
  }

  private get mailer(): Transporter {
    this.transport ??= nodemailer.createTransport({
      host: this.cfg.smtpHost,
      port: this.cfg.smtpPort,
      secure: this.cfg.smtpPort === 465,
      auth: { user: this.cfg.smtpUser, pass: this.cfg.smtpPass },
    });
    return this.transport;
  }

  async send(subject: string, text: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      await this.mailer.sendMail({
        from: this.cfg.smtpUser,
        to: this.cfg.emailTo,
        subject,
        text,
      });
      return true;
    } catch (err) {
      log.error(`email send failed: ${String(err)}`);
      return false;
    }
  }

  async notify(listing: Listing, match: MatchResult): Promise<boolean> {
    const price = listing.price !== undefined ? `${listing.price} €` : 'cena ni navedena';
    return this.send(
      `[najem] ${listing.title.slice(0, 70)}`,
      [
        listing.title,
        price,
        listing.url,
        '',
        match.reasons.join(', '),
        '',
        this.cfg.inquiryTemplate,
      ].join('\n'),
    );
  }
}
