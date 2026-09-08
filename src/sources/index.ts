import type { Config } from '../config.js';
import type { Source } from '../types.js';
import { nepremicnineSource } from './nepremicnine.js';
import { bolhaSource } from './bolha.js';
import { mkvadratSource } from './mkvadrat.js';
import { rssSource } from './rss.js';
import { facebookSource } from './facebook.js';

/** Only sources with at least one configured URL are activated. */
export function buildSources(cfg: Config): Source[] {
  const sources: Source[] = [];
  if (cfg.nepremicnineUrls.length > 0) sources.push(nepremicnineSource(cfg));
  if (cfg.bolhaUrls.length > 0) sources.push(bolhaSource(cfg));
  if (cfg.mkvadratUrls.length > 0) sources.push(mkvadratSource(cfg));
  if (cfg.rssUrls.length > 0) sources.push(rssSource(cfg));
  if (cfg.facebookEnabled && cfg.facebookGroups.length > 0) sources.push(facebookSource(cfg));
  return sources;
}
