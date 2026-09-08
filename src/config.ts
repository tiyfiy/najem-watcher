import { readFileSync } from 'node:fs';

function str(key: string, fallback = ''): string {
  const value = process.env[key];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function num(key: string, fallback: number): number {
  const parsed = Number.parseInt(str(key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Comma separated list -> trimmed, non-empty entries. */
function list(key: string, lowercase = false): string[] {
  return str(key)
    .split(',')
    .map((item) => (lowercase ? item.trim().toLowerCase() : item.trim()))
    .filter((item) => item.length > 0);
}

const DEFAULT_INQUIRY = `Pozdravljeni,

zanima me oglas za najem. Sem zanesljiv, nekadilec, brez hisnih ljubljenckov,
z rednimi prihodki in lahko priskrbim potrdilo o zaposlitvi ter reference.
Stanovanje bi si lahko ogledal/-a se danes ali jutri in sem pripravljen/-a
skleniti dolgorocno najemno pogodbo.

Ali je oglas se aktualen? Hvala in lep pozdrav.`;

export interface Config {
  telegramToken: string;
  telegramChatId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  emailTo: string;
  pollSeconds: number;
  jitterSeconds: number;
  dbPath: string;
  maxPrice: number;
  minPrice: number;
  requireAny: string[];
  exclude: string[];
  boost: string[];
  nepremicnineUrls: string[];
  bolhaUrls: string[];
  mkvadratUrls: string[];
  rssUrls: string[];
  facebookEnabled: boolean;
  facebookGroups: string[];
  facebookStatePath: string;
  inquiryTemplate: string;
  userAgent: string;
}

export function loadConfig(): Config {
  const inquiryFile = str('INQUIRY_TEMPLATE_FILE', 'inquiry.txt');
  let inquiryTemplate = DEFAULT_INQUIRY;
  try {
    const fromDisk = readFileSync(inquiryFile, 'utf8').trim();
    if (fromDisk.length > 0) inquiryTemplate = fromDisk;
  } catch {
    // File is optional; the built-in template is a sane default.
  }

  return {
    telegramToken: str('TELEGRAM_BOT_TOKEN'),
    telegramChatId: str('TELEGRAM_CHAT_ID'),
    smtpHost: str('SMTP_HOST'),
    smtpPort: num('SMTP_PORT', 587),
    smtpUser: str('SMTP_USER'),
    smtpPass: str('SMTP_PASS'),
    emailTo: str('EMAIL_TO'),
    pollSeconds: Math.max(30, num('POLL_SECONDS', 90)),
    jitterSeconds: Math.max(0, num('JITTER_SECONDS', 25)),
    dbPath: str('DB_PATH', './data/seen.json'),
    maxPrice: num('MAX_PRICE', 500),
    minPrice: num('MIN_PRICE', 150),
    requireAny: list('REQUIRE_ANY', true),
    exclude: list('EXCLUDE', true),
    boost: list('BOOST', true),
    nepremicnineUrls: list('NEPREMICNINE_URLS'),
    bolhaUrls: list('BOLHA_URLS'),
    mkvadratUrls: list('MKVADRAT_URLS'),
    rssUrls: list('RSS_URLS'),
    facebookEnabled: str('FACEBOOK_ENABLED', 'false').toLowerCase() === 'true',
    facebookGroups: list('FACEBOOK_GROUPS'),
    facebookStatePath: str('FACEBOOK_STATE_PATH', './data/fb-profile'),
    inquiryTemplate,
    userAgent: str(
      'USER_AGENT',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    ),
  };
}
