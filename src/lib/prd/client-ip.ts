// Helper terpusat identitas IP klien untuk rate limit.
// Aturan kepercayaan proxy: reverse proxy tepercaya (Vercel/LB) menambahkan IP
// KE KANAN pada x-forwarded-for, jadi N = TRUSTED_PROXY_COUNT (default 1) entri
// paling kanan dianggap ditulis oleh proxy tepercaya dan dipakai sebagai
// identitas. Entri di kiri, serta SELURUH header lain (termasuk x-real-ip),
// dikontrol klien sehingga TIDAK dipercaya. Tanpa header tepercaya -> "unknown".

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
      return sanitize(parts[idx] ?? "unknown");
    }
  }
  // Tanpa header tepercaya: kembalikan kunci fallback aman. x-real-ip sengaja
  // TIDAK dipakai - klien bisa mengirimnya untuk memalsukan identitas.
  return "unknown";
}

function sanitize(value: string): string {
  const cleaned = value.replace(/[^0-9a-fA-F:.]/g, "").slice(0, 64);
  return cleaned.length > 0 ? cleaned : "unknown";
}
