import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { log } from './util/log.js';

interface StoreFile {
  bootstrapped: boolean;
  ids: string[];
}

/** Keep at most this many ids; oldest are dropped. Enough for months of ads. */
const MAX_IDS = 20_000;

/**
 * Dedup memory as a plain JSON file — no database, survives restarts, and is
 * trivially inspectable/deletable when you want to re-bootstrap.
 */
export class Store {
  private ids = new Set<string>();
  private order: string[] = [];
  private dirty = false;
  bootstrapped = false;

  constructor(private readonly path: string) {}

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as StoreFile;
      this.order = Array.isArray(parsed.ids) ? parsed.ids : [];
      this.ids = new Set(this.order);
      this.bootstrapped = parsed.bootstrapped === true;
      log.info(`store: ${this.ids.size} znanih oglasov iz ${this.path}`);
    } catch {
      log.info(`store: nov zapis v ${this.path} (prvi zagon)`);
    }
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  add(id: string): void {
    if (this.ids.has(id)) return;
    this.ids.add(id);
    this.order.push(id);
    this.dirty = true;
    if (this.order.length > MAX_IDS) {
      const dropped = this.order.splice(0, this.order.length - MAX_IDS);
      for (const old of dropped) this.ids.delete(old);
    }
  }

  markBootstrapped(): void {
    this.bootstrapped = true;
    this.dirty = true;
  }

  /** Atomic write: temp file + rename, so a crash never truncates the store. */
  async flush(): Promise<void> {
    if (!this.dirty) return;
    const payload: StoreFile = { bootstrapped: this.bootstrapped, ids: this.order };
    const tmp = `${this.path}.tmp`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(tmp, JSON.stringify(payload), 'utf8');
      await rename(tmp, this.path);
      this.dirty = false;
    } catch (err) {
      log.error(`store: zapis ni uspel: ${String(err)}`);
    }
  }
}
