// Rate limiter token bucket (burst + refill).
//
// Backend:
// - In-memory: HANYA untuk single-instance/dev. Di serverless multi-instance
//   (Vercel) setiap instansi punya Map sendiri, sehingga limit bisa dilewati
//   dengan berpindah instansi (bucket per-instance tidak dibagi).
// - Upstash Redis REST: aktif otomatis bila env UPSTASH_REDIS_REST_URL dan
//   UPSTASH_REDIS_REST_TOKEN tersedia. Bucket dibagi antar instansi sehingga
//   limit berlaku global. Tanpa dependency baru (fetch murni).
//
// ponytail: check() tetap sinkron karena route memakainya langsung
// (`const limit = limiter.check(ip)`), dan file route tidak boleh diubah.
// Di mode Redis, hasil lokal dipakai untuk respons seketika, sementara
// evaluasi Redis berjalan asinkron dan mengunci kunci yang over-limit
// (denyCache) sehingga instansi lain ikut menolak dalam ~1 round-trip.
// Upgrade path: jadikan check() async (await di route) bila route boleh diubah.

import { redisConfigured, redisTokenBucket, type RateLimitResult } from "./rate-limit-redis.ts";

export type { RateLimitResult } from "./rate-limit-redis.ts";

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

// Dibaca sekali per proses: env deploy tidak berubah saat runtime.
const USE_REDIS = redisConfigured();

export function createRateLimiter(opts: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();
  // Kunci yang oleh Redis dinyatakan over-limit -> timestamp ms kapan boleh dicoba lagi.
  const denyCache = new Map<string, number>();
  let lastSweep = Date.now();

  function sweep(now: number): void {
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    const ttlMs = 60_000;
    for (const [key, b] of buckets) {
      if (now - b.last > ttlMs) buckets.delete(key);
    }
    for (const [key, until] of denyCache) {
      if (until <= now) denyCache.delete(key);
    }
  }

  /** Buang entri dengan nilai waktu tertua saat melewati MAX_BUCKETS. */
  function evictOldest<V>(map: Map<string, V>, valueOf: (value: V) => number): void {
    let oldestKey: string | undefined;
    let oldest = Infinity;
    for (const [key, value] of map) {
      const t = valueOf(value);
      if (t < oldest) {
        oldest = t;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) map.delete(oldestKey);
  }

  /** Konsumsi satu token dari bucket lokal (per-instance). */
  function consumeLocal(key: string, now: number): RateLimitResult {
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= MAX_BUCKETS) evictOldest(buckets, (b) => b.last);
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
  }

  /**
   * Evaluasi Redis asinkron (fire-and-forget). Hasil over-limit mengosongkan
   * bucket lokal dan mengisi denyCache agar request berikutnya - termasuk di
   * instansi lain yang sudah melihat cache ini - langsung ditolak.
   * Kegagalan Redis tidak pernah menggagalkan request (fallback ke hasil lokal).
   */
  function enforceRedis(key: string): void {
    void redisTokenBucket(key, opts.capacity, opts.refillPerSec)
      .then((result) => {
        const now = Date.now();
        if (result.ok) {
          denyCache.delete(key);
          return;
        }
        buckets.set(key, { tokens: 0, last: now });
        if (denyCache.size >= MAX_BUCKETS) evictOldest(denyCache, (until) => until);
        denyCache.set(key, now + result.retryAfterSeconds * 1000);
      })
      .catch(() => undefined);
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now);
      const local = consumeLocal(key, now);
      if (!USE_REDIS) return local;
      // Selalu evaluasi Redis (termasuk saat lokal menolak) agar kunci yang
      // benar-benar over-limit cepat terkunci lintas instansi.
      enforceRedis(key);
      const deniedUntil = denyCache.get(key);
      if (deniedUntil !== undefined && now < deniedUntil) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil((deniedUntil - now) / 1000)),
        };
      }
      return local;
    },
    size: () => buckets.size,
  };
}
