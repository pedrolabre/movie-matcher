import { CacheService } from './CacheService.js';

interface CacheEntry {
  readonly value: unknown;
  readonly expiresAt: number | null;
}

export interface MemoryCacheServiceOptions {
  readonly defaultTtlSeconds?: number;
}

export class MemoryCacheService implements CacheService {
  private readonly store = new Map<string, CacheEntry>();
  private readonly defaultTtlSeconds: number;

  constructor(options?: MemoryCacheServiceOptions) {
    this.defaultTtlSeconds = options?.defaultTtlSeconds ?? 86400;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const effectiveTtl = ttlSeconds !== undefined ? ttlSeconds : this.defaultTtlSeconds;
    const expiresAt = effectiveTtl > 0 ? Date.now() + effectiveTtl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
