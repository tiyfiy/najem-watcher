export function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export interface FetchOptions {
  userAgent: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * GET a page as text. Retries transient failures with backoff; a 403/429 is
 * treated as "we are too fast" and surfaced after the retries are spent so the
 * caller can log it and keep the loop alive.
 */
export async function fetchText(url: string, opts: FetchOptions): Promise<string> {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': opts.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sl-SI,sl;q=0.9,en;q=0.6',
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function absoluteUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

/**
 * Slovenian money in free text: "450 €", "450,00 EUR", "1.250 €",
 * "5.700,00 €/mesec". Thousands are grouped with a dot or a non-breaking
 * space, never a plain space — allowing that would turn "6. nad. 800,00 €"
 * (floor, then rent) into 6800. The lookbehind stops the same bleed from a
 * digit or a floor marker like "VP/3 720,00 €".
 */
const MONEY = String.raw`(?<![\d/])(\d{1,3}(?:[.\u00A0]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:€|EUR\b)`;
const MONTHLY_RE = new RegExp(`${MONEY}\\s*(?:\\/|\\s)\\s*mes`, 'gi');
const ANY_MONEY_RE = new RegExp(MONEY, 'gi');

function toAmount(raw: string): number | undefined {
  const value = Number.parseFloat(
    raw.replace(/[\u00A0 ]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'),
  );
  return Number.isFinite(value) && value >= 50 && value <= 20_000 ? Math.round(value) : undefined;
}

export function parsePrice(text: string): number | undefined {
  // An explicit "…€/mesec" is the rent; anything else in the block may be a
  // deposit, agency fee or price per m2.
  for (const m of text.matchAll(MONTHLY_RE)) {
    const amount = toAmount(m[1] ?? '');
    if (amount !== undefined) return amount;
  }

  const candidates: number[] = [];
  for (const m of text.matchAll(ANY_MONEY_RE)) {
    const amount = toAmount(m[1] ?? '');
    if (amount !== undefined) candidates.push(amount);
  }
  // "450 € + 80 € stroski": the rent is the larger of the two.
  return candidates.length > 0 ? Math.max(...candidates) : undefined;
}

export function parseArea(text: string): number | undefined {
  const m = /(\d{1,4}(?:[.,]\d{1,2})?)\s*m(?:2|²|\^2)\b/i.exec(text);
  if (!m) return undefined;
  const value = Number.parseFloat((m[1] ?? '').replace(',', '.'));
  return Number.isFinite(value) && value > 3 && value < 1000 ? Math.round(value) : undefined;
}
