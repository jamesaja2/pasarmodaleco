import { createClient, RedisClientType } from 'redis'

interface CacheClient {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

class InMemoryCache implements CacheClient {
  private store = new Map<string, { value: unknown; expiresAt: number | null }>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlSeconds?: number) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    this.store.set(key, { value, expiresAt })
  }

  async del(key: string) {
    this.store.delete(key)
  }
}

let redisClient: RedisClientType | null = null
let cacheClient: CacheClient | null = null

async function getRedisClient() {
  if (redisClient) return redisClient
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null

  redisClient = createClient({ url: redisUrl })
  redisClient.on('error', (err: unknown) => {
    console.error('Redis error:', err)
  })

  if (!redisClient.isOpen) {
    await redisClient.connect()
  }

  return redisClient
}

class RedisCache implements CacheClient {
  constructor(private client: RedisClientType) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch (error) {
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number) {
    const payload = JSON.stringify(value)
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, payload, { EX: ttlSeconds })
    } else {
      await this.client.set(key, payload)
    }
  }

  async del(key: string) {
    await this.client.del(key)
  }
}

export async function getCache(): Promise<CacheClient> {
  if (cacheClient) return cacheClient
  const client = await getRedisClient()
  if (client) {
    cacheClient = new RedisCache(client)
  } else {
    cacheClient = new InMemoryCache()
  }
  return cacheClient
}

export const CACHE_KEYS = {
  CURRENT_DAY: 'system:current_day',
  STOCK_PRICES: (day: number) => `prices:day:${day}`,
  COMPANIES: 'companies:all',
  LEADERBOARD: 'leaderboard:current',
  USER_PORTFOLIO: (userId: string) => `portfolio:user:${userId}`,
}
