// Helper terpusat identitas IP klien untuk rate limit.
// Ambil entri TERAKHIR x-forwarded-for (ditambahkan proxy terdekat),
// bukan pertama (dikontrol klien). Sanitasi agar aman sebagai kunci Map.

function parseTrustedProxyCount(): number {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  if (raw === undefined) return 1;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  return 1;
}

/** Kembalikan IP klien yang disanitasi (maks 64 char, hanya [0-9a-fA-F:.]). */
export function clientIp(request: Request): string {
  const count = parseTrustedProxyCount();
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length > 0) {
      const idx = Math.max(0, parts.length - count);
      return sanitize(parts[idx] ?? "local");
    }
  }
  const real = request.headers.get("x-real-ip");
  if (real && real.trim().length > 0) return sanitize(real.trim());
  return "local";
}

function sanitize(value: string): string {
  const cleaned = value.replace(/[^0-9a-fA-F:.]/g, "").slice(0, 64);
  return cleaned.length > 0 ? cleaned : "local";
}
