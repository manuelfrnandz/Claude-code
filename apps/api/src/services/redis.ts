import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

const FALLBACK_WARNING =
  '[REDIS FALLBACK] Using in-memory Map — sessions will be lost on restart. Set REDIS_URL to fix this.';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface MapEntry {
  value: string;
  expiresAt: number | null;
}

class MemoryClient implements RedisClient {
  private store = new Map<string, MapEntry>();

  private alive(entry: MapEntry): boolean {
    return entry.expiresAt === null || Date.now() < entry.expiresAt;
  }

  async get(key: string): Promise<string | null> {
    logger.warn(FALLBACK_WARNING);
    const entry = this.store.get(key);
    if (!entry || !this.alive(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    logger.warn(FALLBACK_WARNING);
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    logger.warn(FALLBACK_WARNING);
    this.store.delete(key);
  }

  async incr(key: string): Promise<number> {
    logger.warn(FALLBACK_WARNING);
    const entry = this.store.get(key);
    const current = entry && this.alive(entry) ? parseInt(entry.value, 10) : 0;
    const next = current + 1;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }
}

// ─── IORedis wrapper ──────────────────────────────────────────────────────────

class IoRedisClient implements RedisClient {
  constructor(private readonly redis: IORedis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }
}

// ─── Factory — try Redis, fall back to Map ────────────────────────────────────

async function createRedisClient(): Promise<RedisClient> {
  return new Promise((resolve) => {
    const redis = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      connectTimeout: 3000,
    });

    const fallback = (): void => {
      redis.disconnect();
      logger.warn(FALLBACK_WARNING);
      resolve(new MemoryClient());
    };

    const timer = setTimeout(fallback, 3000);

    redis.connect().then(() => {
      clearTimeout(timer);
      logger.info({ url: config.REDIS_URL }, 'Redis connected');
      resolve(new IoRedisClient(redis));
    }).catch(fallback);
  });
}

// Singleton — resolved once at startup, shared across all modules
let clientPromise: Promise<RedisClient> | null = null;

export function getRedisClient(): Promise<RedisClient> {
  if (!clientPromise) clientPromise = createRedisClient();
  return clientPromise;
}

// BullMQ requires its own IORedis connection with maxRetriesPerRequest: null
export function createBullConnection(): IORedis {
  return new IORedis(config.BULL_REDIS_URL, { maxRetriesPerRequest: null });
}
