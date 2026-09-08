import type { Config } from './config.js';
import type { Listing, MatchResult } from './types.js';

function haystack(listing: Listing): string {
  return [listing.title, listing.description, listing.location, listing.url]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matches(listing: Listing, cfg: Config): MatchResult {
  const text = haystack(listing);
  const reasons: string[] = [];
  let score = 0;

  const hit = cfg.exclude.find((word) => text.includes(word));
  if (hit) {
    return { ok: false, score: 0, reasons: [`vsebuje izključeno besedo: "${hit}"`] };
  }

  if (cfg.requireAny.length > 0) {
    const found = cfg.requireAny.find((word) => text.includes(word));
    if (!found) {
      return { ok: false, score: 0, reasons: ['ne vsebuje nobene zahtevane besede'] };
    }
    reasons.push(`ustreza: "${found}"`);
  }

  const total = (listing.price ?? 0) + (listing.extras ?? 0);
  if (listing.price !== undefined) {
    if (total > cfg.maxPrice) {
      return { ok: false, score: 0, reasons: [`predrago: ${total} € > ${cfg.maxPrice} €`] };
    }
    if (total < cfg.minPrice) {
      // Usually a bogus/teaser price, not a real deal.
      return { ok: false, score: 0, reasons: [`sumljivo poceni: ${total} €`] };
    }
    // Cheaper = higher score, capped.
    score += Math.max(0, Math.round(((cfg.maxPrice - total) / cfg.maxPrice) * 50));
    reasons.push(`cena ${total} €`);
  } else {
    // No price parsed: still notify (many good ads hide the price), just lower priority.
    score += 10;
    reasons.push('cena ni razvidna iz oglasa');
  }

  for (const word of cfg.boost) {
    if (text.includes(word)) {
      score += 8;
      reasons.push(`plus: "${word}"`);
    }
  }

  return { ok: true, score, reasons };
}
