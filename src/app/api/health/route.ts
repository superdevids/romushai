// GET /api/health - self-check konfigurasi penyedia LLM (server-only).
// Tidak pernah mengembalikan API key utuh; hanya panjang key.
// Probe /models OPT-IN via ?probe=1 agar tidak jadi amplifikasi/DoS.
// Bila HEALTH_TOKEN di-set, detail penuh butuh header x-health-token yang cocok.

import { memoryHealth } from "@/lib/prd/memory";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 8_000;
const EXCERPT_LIMIT = 300;
// BETA: rate limit in-memory per IP (umum 20/menit; ?probe=1 dibatasi 5/menit).
const healthLimiter = createRateLimiter({ capacity: 20, refillPerSec: 20 / 60 });
const probeLimiter = createRateLimiter({ capacity: 5, refillPerSec: 5 / 60 });

interface ProviderProbe {
  ok: boolean;
  status: number | null;
  error: string | null;
  bodyExcerpt: string | null;
}

interface MemorySummary {
  exists: boolean;
  records: number;
  promoted: number;
  lastWriteAt: number | null;
}

/** Ambil env SAAT REQUEST (bukan module scope) supaya perubahan .env terdeteksi setelah restart. */
function readConfig(): { baseUrl: string; modelSmall: string; modelStrong: string; apiKey: string | undefined } {
  return {
    baseUrl: (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
    modelSmall: process.env.LLM_MODEL_SMALL ?? "gpt-4o-mini",
    modelStrong: process.env.LLM_MODEL_STRONG ?? "gpt-4o",
    apiKey: process.env.LLM_API_KEY,
  };
}

/** Fingerprint aman: hanya panjang key, tanpa karakter key sama sekali. */
export function keyFingerprint(key: string | undefined): string {
  if (!key) return "(tidak ada)";
  return `(len=${key.length})`;
}

async function probeModels(baseUrl: string, apiKey: string): Promise<ProviderProbe> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    // GET {baseUrl}/models = panggilan termurah yang membuktikan key + base URL.
    const res = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
      cache: "no-store",
    });
    let excerpt: string | null = null;
    try {
      const text = (await res.text()).replace(/\s+/g, " ").trim();
      excerpt = text ? (text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}...` : text) : null;
    } catch {
      excerpt = null;
    }
    return { ok: res.ok, status: res.status, error: null, bodyExcerpt: excerpt };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: null,
      error: aborted ? `Timeout ${PROBE_TIMEOUT_MS} ms saat menghubungi ${baseUrl}/models.` : "Koneksi ke penyedia gagal.",
      bodyExcerpt: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request): Promise<Response> {
  const limited = healthLimiter.check(clientIp(request));
  if (!limited.ok) {
    return Response.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${limited.retryAfterSeconds} detik.` },
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  const healthToken = process.env.HEALTH_TOKEN;
  // Fail-closed di produksi: tanpa HEALTH_TOKEN, endpoint hanya membalas status
  // minimal (tanpa baseUrl/model/keyFingerprint) supaya tidak bocor ke publik.
  if (process.env.NODE_ENV === "production" && !healthToken) {
    return Response.json(
      { ok: false, hint: "HEALTH_TOKEN wajib diatur di produksi untuk membuka detail health." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (healthToken) {
    const provided = request.headers.get("x-health-token");
    if (provided !== healthToken) {
      // 404 sengaja agar tidak mengungkap keberadaan endpoint.
      return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
    }
  }

  const { baseUrl, modelSmall, modelStrong, apiKey } = readConfig();
  // Status memori bersifat diagnostik: TIDAK pernah throw dan TIDAK memblokir health.
  // Field path absolut dibuang di sini (memory.ts milik agent lain, tidak disentuh).
  let memory: MemorySummary | null = null;
  try {
    const full = await memoryHealth();
    memory = { exists: full.exists, records: full.records, promoted: full.promoted, lastWriteAt: full.lastWriteAt };
  } catch {
    memory = null;
  }

  const wantProbe = new URL(request.url).searchParams.get("probe") === "1";
  if (wantProbe) {
    // Probe memanggil penyedia LLM: batasnya lebih ketat agar tidak jadi amplifikasi.
    const probeLimited = probeLimiter.check(clientIp(request));
    if (!probeLimited.ok) {
      return Response.json(
        { error: `Terlalu banyak permintaan probe. Coba lagi dalam ${probeLimited.retryAfterSeconds} detik.` },
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": String(probeLimited.retryAfterSeconds) },
        },
      );
    }
  }

  const payload = {
    ok: false,
    baseUrl,
    models: { small: modelSmall, strong: modelStrong },
    keyPresent: Boolean(apiKey),
    keyFingerprint: keyFingerprint(apiKey),
    probe: null as ProviderProbe | null,
    memory,
    hint: "",
  };

  if (!apiKey) {
    payload.hint =
      "LLM_API_KEY belum diatur. Set di .env lalu RESTART dev server - Next hanya membaca .env saat boot.";
    return Response.json(payload, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  if (!wantProbe) {
    payload.ok = true;
    payload.hint = "Konfigurasi terbaca. Tambahkan ?probe=1 untuk menguji koneksi ke penyedia.";
    return Response.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const probe = await probeModels(baseUrl, apiKey);
  payload.probe = probe;
  payload.ok = probe.ok;
  if (!probe.ok) {
    if (probe.status === 401) {
      payload.hint = "Key ditolak (401). Periksa LLM_API_KEY lalu restart dev server setelah mengubah .env.";
    } else if (probe.status === 403) {
      payload.hint = "Akses ditolak (403). Key valid tapi tidak berizin untuk endpoint/model ini.";
    } else if (probe.status === 404) {
      payload.hint = "Endpoint 404. Periksa LLM_BASE_URL - harus berakhir pada /v1 untuk OpenAI-compatible.";
    } else if (probe.status === null) {
      payload.hint = "Penyedia tidak terjangkau dari server. Cek jaringan/proxy/firewall.";
    } else {
      payload.hint = `Penyedia membalas HTTP ${probe.status}. Lihat bodyExcerpt.`;
    }
  }

  return Response.json(payload, {
    status: probe.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
