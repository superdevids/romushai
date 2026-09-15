// Klien Upstash Redis REST berbasis fetch murni (TANPA dependency baru).
// Backend rate limit terdistribusi untuk deploy multi-instance (Vercel):
// semua instansi berbagi bucket yang sama di Redis sehingga limit tidak
// bisa dilewati hanya dengan berpindah instansi.
//
// Protokol: POST {UPSTASH_REDIS_REST_URL} dengan body JSON
// ["EVAL", <script>, "1", <key>, <argv...>] dan header
// Authorization: Bearer {UPSTASH_REDIS_REST_TOKEN}.

/** Bentuk hasil konsumsi token (diimpor ulang oleh rate-limit.ts). */
export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

const URL_ENV = "UPSTASH_REDIS_REST_URL";
const TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";
const KEY_PREFIX = "ratelimit:";
// Timeout ketat: rate limit tidak boleh memperlambat request secara signifikan.
const TIMEOUT_MS = 2_000;

// Token bucket atomik via EVAL (satu round-trip, atomic di Redis):
// - ARGV[1] = capacity, ARGV[2] = refill per milidetik, ARGV[3] = now (ms).
// - Bucket disimpan sebagai hash {t: tokens, ts: timestamp terakhir}.
// - Return [ok(0|1), retryAfterSeconds].
const BUCKET_SCRIPT = `
local cap = tonumber(ARGV[1])
local per_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local d = redis.call('HMGET', KEYS[1], 't', 'ts')
local tokens = tonumber(d[1])
local ts = tonumber(d[2])
if tokens == nil or ts == nil then
  tokens = cap
  ts = now
end
if now > ts then
  tokens = math.min(cap, tokens + (now - ts) * per_ms)
end
local ok = 0
if tokens >= 1 then
  tokens = tokens - 1
  ok = 1
end
redis.call('HSET', KEYS[1], 't', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.floor(cap / per_ms) * 2 + 60000)
if ok == 1 then
  return {1, 0}
end
local retry = math.max(1, math.ceil((1 - tokens) / per_ms / 1000))
return {0, retry}
`;

/** True bila env Upstash REST lengkap; backend terdistribusi aktif. */
export function redisConfigured(): boolean {
  return (
    typeof process.env[URL_ENV] === "string" &&
    (process.env[URL_ENV] as string).length > 0 &&
    typeof process.env[TOKEN_ENV] === "string" &&
    (process.env[TOKEN_ENV] as string).length > 0
  );
}

/**
 * Konsumsi satu token dari bucket terdistribusi. Melempar error bila
 * Redis gagal/tidak terkonfigurasi - caller yang memutuskan fallback.
 */
export async function redisTokenBucket(
  key: string,
  capacity: number,
  refillPerSec: number,
): Promise<RateLimitResult> {
  const url = process.env[URL_ENV];
  const token = process.env[TOKEN_ENV];
  if (!url || !token) throw new Error("env Upstash REST tidak lengkap");
  // Pagar bawah: refill 0 memicu pembagian nol di skrip Lua.
  const perMs = Math.max(refillPerSec, 1e-9) / 1000;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      BUCKET_SCRIPT,
      "1",
      `${KEY_PREFIX}${key}`,
      String(capacity),
      String(perMs),
      String(Date.now()),
    ]),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`upstash rest ${res.status}`);
  const parsed: unknown = await res.json();
  const result = (parsed as { result?: unknown }).result;
  if (!Array.isArray(result)) throw new Error("upstash rest: respons tidak terduga");
  const ok = Number(result[0]) === 1;
  const retryAfterSeconds = ok ? 0 : Math.max(1, Math.ceil(Number(result[1]) || 1));
  return { ok, retryAfterSeconds };
}
