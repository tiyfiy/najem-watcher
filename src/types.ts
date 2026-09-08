export interface Listing {
  /** Stable, source-scoped identity. Used for dedup across restarts. */
  id: string;
  source: string;
  url: string;
  title: string;
  /** Monthly rent in EUR, if the ad states one. */
  price?: number;
  /** Utilities/"stroski" on top of rent, if stated separately. */
  extras?: number;
  areaM2?: number;
  location?: string;
  description?: string;
  imageUrl?: string;
  /** Publication time when the source exposes one (RSS). */
  publishedAt?: string;
}

export interface MatchResult {
  ok: boolean;
  score: number;
  reasons: string[];
}

export interface Source {
  name: string;
  fetchListings(): Promise<Listing[]>;
}
