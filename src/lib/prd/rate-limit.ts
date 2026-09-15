// Rate limiter in-memory (token bucket) untuk mode single-instance.
// ponytail: ganti ke Upstash Redis bila deploy multi-instance (lihat README).

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Kapasitas bucket = burst maksimum yang diizinkan seketika. */
  capacity: number;
  /** Isi ulang token per detik (mis. 3/menit = 0.05). */
  refillPerSec: number;
}

interface Bucket {
  tokens: number;
  last: number;
}

// Batas jumlah bucket agar Map tidak tumbuh tanpa batas (kunci IP bisa tak terbatas).
const MAX_BUCKETS = 10_000;

export function createRateLimiter(opts: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  function sweep(now: number): void {
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    const ttlMs = 60_000;
    for (const [key, b] of buckets) {
      if (now - b.last > ttlMs) buckets.delete(key);
    }
  }

  /** Buang bucket dengan `last` tertua saat melewati MAX_BUCKETS. */
  function evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestLast = Infinity;
    for (const [key, b] of buckets) {
      if (b.last < oldestLast) {
        oldestLast = b.last;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now);
      let bucket = buckets.get(key);
      if (!bucket) {
        if (buckets.size >= MAX_BUCKETS) evictOldest();
        bucket = { tokens: opts.capacity, last: now };
        buckets.set(key, bucket);
      }
      bucket.tokens = Math.min(
        opts.capacity,
        bucket.tokens + ((now - bucket.last) / 1000) * opts.refillPerSec,
      );
      bucket.last = now;
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { ok: true, retryAfterSeconds: 0 };
      }
      const retryAfterSeconds = Math.max(1, Math.ceil((1 - bucket.tokens) / opts.refillPerSec));
      return { ok: false, retryAfterSeconds };
    },
    size: () => buckets.size,
  };
}